import { NextRequest } from 'next/server'
import { Readable } from 'node:stream'
import { apiError, ApiError } from '@/lib/utils/api-response'
import { getDb } from '@/lib/db-lazy'
import { PrivateFileStore } from '@/lib/storage/private-file-store'
import { LEGACY_STORAGE_KEY_PREFIX, isLegacyStorageKey } from '@/lib/storage/storage-key'
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
 * Entrega ANÓNIMA de una evidencia de runtime publicada explícitamente
 * (ADR-001 D12).
 *
 * Contraparte pública de `GET /api/evidence/[id]/file` (D2): esa ruta sigue
 * intacta y exige sesión + `VIEW_ALL_FINDINGS` para TODA evidencia de
 * runtime, publicada o no. Esta ruta es la ÚNICA vía anónima, y solo entrega
 * bytes cuando `Evidence.visibility === 'PUBLIC_REPORT'`.
 *
 * Igual que la ruta privada: ningún `fs`/`path` aquí, toda resolución de
 * filesystem pasa por `PrivateFileStore` (D3); la `storageKey` sale de la
 * BD a partir del `id` de la URL y nunca del cliente.
 *
 * Orden NORMATIVO:
 *   1. lookup de Evidence (PRIVATE / inexistente / borrada / finding borrado
 *      / legacy → mismo 404 indistinguible, para no permitir enumeración)
 *   2. validación de estado (PENDING / objeto ausente)
 *   3. apertura del objeto
 *   4. bytes
 */

function baseHeaders(): Headers {
  const headers = new Headers()
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'no-store')
  return headers
}

/**
 * PRIVATE, inexistente, borrada, finding borrado y legacy comparten el mismo
 * 404: distinguirlos filtraría qué evidencia existe y cuál es pública.
 */
function notFound() {
  return apiError(new ApiError('NOT_FOUND', 'Evidence not found', undefined, 404))
}

function storageFailure(context: string, error: StorageError) {
  console.error(`[public/evidence/file] ${context}:`, error)

  if (error instanceof StorageConfigError) {
    return apiError(
      new ApiError('STORAGE_UNAVAILABLE', 'Evidence storage is unavailable', undefined, 503),
    )
  }

  return apiError(new ApiError('INTERNAL_ERROR', 'Could not read evidence', undefined, 500))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: evidenceId } = await params

  // ---- 1. Lookup ------------------------------------------------------------
  // Solo evidencia activa, de finding activo, y PUBLIC_REPORT. La cláusula
  // anti-legacy es defensa en profundidad: la visibilidad legacy nunca la
  // decide este flag (D9), así que una fila legacy jamás debería tener
  // visibility = PUBLIC_REPORT, pero si ocurriera, no debe alcanzar
  // PrivateFileStore (que rechaza claves legacy/*, D3).
  const db = getDb()
  const evidence = await db.evidence.findFirst({
    where: {
      id: evidenceId,
      deletedAt: null,
      finding: { deletedAt: null },
      visibility: 'PUBLIC_REPORT',
      NOT: { storageKey: { startsWith: LEGACY_STORAGE_KEY_PREFIX } },
    },
    select: {
      id: true,
      storageKey: true,
      url: true,
      mimeType: true,
      originalFilename: true,
    },
  })

  if (!evidence) return notFound()
  if (isLegacyStorageKey(evidence.storageKey)) return notFound()

  // ---- 2. Estado -------------------------------------------------------------
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

  // ---- 3. Tamaño real y rango -------------------------------------------------
  let size: number
  try {
    size = (await PrivateFileStore.stat(evidence.storageKey)).size
  } catch (err) {
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

  // ---- 4. Bytes ---------------------------------------------------------------
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

  if (openedSize !== size) {
    stream.destroy()
    console.error(
      `[public/evidence/file] size mismatch for evidence ${evidence.id}: stat=${size} opened=${openedSize}`,
    )
    return apiError(
      new ApiError('INTERNAL_ERROR', 'Could not read evidence', undefined, 500),
    )
  }

  const headers = baseHeaders()
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
