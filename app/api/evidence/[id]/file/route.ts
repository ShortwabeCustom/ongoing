import { NextRequest } from 'next/server'
import { Readable } from 'node:stream'
import { apiError, ApiError } from '@/lib/utils/api-response'
import { getDb } from '@/lib/db-lazy'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { PrivateFileStore } from '@/lib/storage/private-file-store'
import { isLegacyStorageKey } from '@/lib/storage/storage-key'
import {
  InvalidStorageKeyError,
  StorageConfigError,
  StorageError,
  StorageIOError,
} from '@/lib/storage/storage-errors'
import { inlineContentDisposition } from '@/lib/http/content-disposition'
import { contentRange, parseRange, unsatisfiedContentRange } from '@/lib/http/range'

export const dynamic = 'force-dynamic'

/**
 * Entrega autenticada de una evidencia de runtime.
 *
 * ADR-001 (P1-B) — D2 (única vía de entrega), D3 (frontera de path/fs),
 * D5.1 (readiness marker), D7 (privada por defecto), D13 (Range/206),
 * D14 (fail-closed).
 *
 * Orden NORMATIVO:
 *   1. RBAC  — antes de cualquier consulta, para no permitir enumeración
 *   2. lookup de Evidence
 *   3. validación de estado
 *   4. apertura del objeto
 *   5. bytes
 *
 * Este handler NO importa `fs` ni `path`: toda operación de filesystem pasa por
 * `PrivateFileStore`.
 */

/** Cabeceras comunes a todas las respuestas, incluidas 206 y 416. */
function baseHeaders(): Headers {
  const headers = new Headers()
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'private, no-store')
  headers.set('Vary', 'Cookie')
  return headers
}

/**
 * Los cuatro casos de 404 —inexistente, evidencia borrada, finding borrado y
 * legacy— comparten contrato externo: distinguirlos filtraría la existencia de
 * evidencias que el solicitante no debe poder enumerar.
 */
function notFound() {
  return apiError(new ApiError('NOT_FOUND', 'Evidence not found', undefined, 404))
}

/**
 * Traduce un fallo del almacén sin filtrar NADA al cliente: ni rutas, ni errno,
 * ni `storageKey`, ni stack. La causa se conserva solo en el log del servidor.
 */
function storageFailure(context: string, error: StorageError) {
  console.error(`[evidence/file] ${context}:`, error)

  if (error instanceof StorageConfigError) {
    return apiError(
      new ApiError('STORAGE_UNAVAILABLE', 'Evidence storage is unavailable', undefined, 503),
    )
  }

  // InvalidStorageKeyError, ESTORAGEUNSAFE y cualquier otro error de E/S se
  // colapsan en un 500 genérico.
  return apiError(new ApiError('INTERNAL_ERROR', 'Could not read evidence', undefined, 500))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ---- 1. RBAC, ANTES del lookup ------------------------------------------
  const { valid, error } = await checkRBAC(request, {
    allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
  })
  if (!valid) return error

  const { id: evidenceId } = await params

  // ---- 2. Lookup -----------------------------------------------------------
  // Evidencia activa Y finding activo, en una sola consulta.
  const db = getDb()
  const evidence = await db.evidence.findFirst({
    where: { id: evidenceId, deletedAt: null, finding: { deletedAt: null } },
    select: {
      id: true,
      storageKey: true,
      url: true,
      mimeType: true,
      originalFilename: true,
    },
  })

  if (!evidence) return notFound()

  // ---- 3. Estado -----------------------------------------------------------
  // El material legacy no se sirve por esta ruta (D9): mismo 404.
  if (isLegacyStorageKey(evidence.storageKey)) return notFound()

  // `url === null` ⇒ upload PENDING (D5.1): la fila existe pero no es
  // entregable. No es un 404 (existe) ni un 500 (no es un fallo del sistema).
  if (!evidence.url) {
    return apiError(
      new ApiError(
        'UPLOAD_INCOMPLETE',
        'Evidence upload has not been confirmed yet',
        undefined,
        409,
      ),
    )
  }

  // ---- 4. Tamaño real y rango ---------------------------------------------
  let size: number
  try {
    size = (await PrivateFileStore.stat(evidence.storageKey)).size
  } catch (err) {
    // Una fila CONFIRMED sin objeto en disco es el estado que D5.3 reconoce
    // como posible tras una muerte de proceso: 410, no 404.
    if (err instanceof StorageIOError && err.errno === 'ENOENT') {
      return apiError(
        new ApiError('OBJECT_MISSING', 'Evidence object is no longer available', undefined, 410),
      )
    }
    if (err instanceof StorageError) return storageFailure('stat failed', err)
    throw err
  }

  const range = parseRange(request.headers.get('range'), size)

  if (range.kind === 'unsatisfiable') {
    const headers = baseHeaders()
    headers.set('Content-Range', unsatisfiedContentRange(size))
    return new Response(null, { status: 416, headers })
  }

  const isPartial = range.kind === 'satisfiable'
  const start = isPartial ? range.start : 0
  const end = isPartial ? range.end : size - 1
  const length = size === 0 ? 0 : end - start + 1

  // ---- 5. Bytes ------------------------------------------------------------
  let stream: Readable
  let openedSize: number
  try {
    ;({ stream, size: openedSize } = await PrivateFileStore.getStream(
      evidence.storageKey,
      isPartial ? start : undefined,
      isPartial ? end : undefined,
    ))
  } catch (err) {
    if (err instanceof StorageIOError && err.errno === 'ENOENT') {
      return apiError(
        new ApiError('OBJECT_MISSING', 'Evidence object is no longer available', undefined, 410),
      )
    }
    if (err instanceof InvalidStorageKeyError || err instanceof StorageError) {
      return storageFailure('getStream failed', err)
    }
    throw err
  }

  // El tamaño con el que se calcularon `Content-Length`, `Content-Range` y el
  // propio rango viene del `stat` previo; los bytes vienen de una apertura
  // POSTERIOR. Si el objeto cambió entre ambas, las cabeceras describirían un
  // objeto distinto del que se sirve —cuerpo truncado o rango mentiroso—, así
  // que se falla cerrado sin emitir un solo byte.
  //
  // La `storageKey` es inmutable (D15-bis.1), de modo que esto no debería
  // ocurrir en el flujo normal; pero la corrección de la respuesta no puede
  // depender de esa invariante.
  if (openedSize !== size) {
    stream.destroy()
    console.error(
      `[evidence/file] size mismatch for evidence ${evidence.id}: stat=${size} opened=${openedSize}`,
    )
    return apiError(
      new ApiError('INTERNAL_ERROR', 'Could not read evidence', undefined, 500),
    )
  }

  const headers = baseHeaders()
  // Content-Type SOLO desde la BD: nunca de la petición, la extensión, el
  // sniffing del contenido ni la storageKey (D5.5 / §3.1).
  headers.set('Content-Type', evidence.mimeType)
  headers.set('Content-Length', String(length))
  headers.set('Content-Disposition', inlineContentDisposition(evidence.originalFilename))
  headers.set('X-Content-Type-Options', 'nosniff')

  if (isPartial) {
    headers.set('Content-Range', contentRange(start, end, size))
  }

  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: isPartial ? 206 : 200,
    headers,
  })
}
