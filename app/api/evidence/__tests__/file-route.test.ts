// @vitest-environment node
/**
 * ADR-001 §3.1 — GET /api/evidence/{id}/file.
 *
 * Contrato completo: RBAC antes del lookup, los cuatro 404 indistinguibles,
 * 409 para PENDING, 410 para objeto ausente, Range/206/416, cabeceras exactas y
 * cero filtración de detalles internos del almacén.
 *
 * El almacén se ejercita de verdad contra el filesystem (los mismos helpers de
 * `lib/storage`), no mockeado: así el test cubre también la lectura real.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import path from 'node:path'
import fs from 'node:fs'

const mockRBAC = vi.hoisted(() => ({ checkRBAC: vi.fn() }))
const mockEvidence = vi.hoisted(() => ({ findFirst: vi.fn() }))

// Mock completo: el módulo real de RBAC arrastra Lucia y `db-lazy`.
vi.mock('@/lib/middleware/rbac', () => ({
  checkRBAC: mockRBAC.checkRBAC,
  RBAC_PERMISSIONS: {
    CREATE_FINDING: ['OWNER', 'QA_LEAD', 'DESIGNER', 'DEVELOPER'],
    VIEW_ALL_FINDINGS: ['OWNER', 'QA_LEAD', 'DESIGNER', 'DEVELOPER', 'BUSINESS_REVIEWER', 'VIEWER'],
  },
}))
vi.mock('@/lib/db-lazy', () => ({ getDb: () => ({ evidence: mockEvidence }) }))

const { GET } = await import('@/app/api/evidence/[id]/file/route')
const { PrivateFileStore } = await import('@/lib/storage/private-file-store')
const { EVIDENCE_STORAGE_DIR_ENV, __resetEvidenceStorageRootForTests } = await import(
  '@/lib/storage/storage-root'
)
const { cleanupRoots, makeValidRoot } = await import('@/lib/storage/__tests__/test-roots')

const ORIGINAL = process.env[EVIDENCE_STORAGE_DIR_ENV]
const KEY = 'findings/find_1/ev_1/captura.png'
const BODY = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz') // 36 bytes

const ROW = {
  id: 'ev_1',
  storageKey: KEY,
  url: '/api/evidence/ev_1/file',
  mimeType: 'image/png',
  originalFilename: 'captura.png',
}

let root: string
let originalUmask: number

function call(rangeHeader?: string) {
  const headers = new Headers()
  if (rangeHeader) headers.set('range', rangeHeader)
  const request = new NextRequest('http://localhost/api/evidence/ev_1/file', { headers })
  return GET(request, { params: Promise.resolve({ id: 'ev_1' }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  root = makeValidRoot()
  process.env[EVIDENCE_STORAGE_DIR_ENV] = root
  __resetEvidenceStorageRootForTests()
  originalUmask = process.umask(0o000)
  mockRBAC.checkRBAC.mockResolvedValue({ valid: true, user: { id: 'user_1' } })
  mockEvidence.findFirst.mockResolvedValue(ROW)
})

afterEach(() => {
  process.umask(originalUmask)
  if (ORIGINAL === undefined) delete process.env[EVIDENCE_STORAGE_DIR_ENV]
  else process.env[EVIDENCE_STORAGE_DIR_ENV] = ORIGINAL
  __resetEvidenceStorageRootForTests()
})

afterAll(() => {
  cleanupRoots()
})

async function bodyBuffer(response: Response): Promise<Buffer> {
  return Buffer.from(await response.arrayBuffer())
}

// ---------------------------------------------------------------- AUTH ------

describe('AUTH', () => {
  it('anónimo ⇒ 401 y el lookup NO se ejecuta', async () => {
    mockRBAC.checkRBAC.mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401 }),
    })

    expect((await call()).status).toBe(401)
    expect(mockEvidence.findFirst).not.toHaveBeenCalled()
  })

  it('autenticado sin permiso ⇒ 403 y el lookup NO se ejecuta', async () => {
    mockRBAC.checkRBAC.mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ code: 'FORBIDDEN' }), { status: 403 }),
    })

    expect((await call()).status).toBe(403)
    expect(mockEvidence.findFirst).not.toHaveBeenCalled()
  })

  it('exige VIEW_ALL_FINDINGS', async () => {
    await PrivateFileStore.put(KEY, BODY)
    await call()
    expect(mockRBAC.checkRBAC).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowedRoles: expect.arrayContaining(['VIEWER']) }),
    )
  })
})

// ----------------------------------------------------------------- 404 ------

describe('404 — contrato externo idéntico en los cuatro casos', () => {
  async function snapshot(response: Response) {
    return {
      status: response.status,
      body: await response.text(),
      contentType: response.headers.get('content-type'),
    }
  }

  it('evidencia inexistente / borrada / finding borrado ⇒ 404', async () => {
    mockEvidence.findFirst.mockResolvedValue(null)
    expect((await call()).status).toBe(404)
  })

  it('legacy ⇒ 404', async () => {
    mockEvidence.findFirst.mockResolvedValue({
      ...ROW,
      storageKey: 'legacy/public/images/captura.png',
      url: '/images/captura.png',
    })
    expect((await call()).status).toBe(404)
  })

  it('el 404 por ausencia y el 404 por legacy son indistinguibles', async () => {
    mockEvidence.findFirst.mockResolvedValue(null)
    const missing = await snapshot(await call())

    mockEvidence.findFirst.mockResolvedValue({
      ...ROW,
      storageKey: 'legacy/x.png',
      url: '/images/x.png',
    })
    const legacy = await snapshot(await call())

    expect(legacy).toEqual(missing)
  })

  it('la query exige evidencia activa y finding activo', async () => {
    mockEvidence.findFirst.mockResolvedValue(null)
    await call()
    expect(mockEvidence.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ev_1', deletedAt: null, finding: { deletedAt: null } },
      }),
    )
  })
})

// --------------------------------------------------------------- ESTADO -----

describe('ESTADO', () => {
  it('runtime PENDING (url null) ⇒ 409 UPLOAD_INCOMPLETE', async () => {
    mockEvidence.findFirst.mockResolvedValue({ ...ROW, url: null })

    const response = await call()
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('UPLOAD_INCOMPLETE')
  })

  it('fila CONFIRMED sin objeto en disco ⇒ 410 OBJECT_MISSING', async () => {
    const response = await call() // no se hizo put
    expect(response.status).toBe(410)
    expect((await response.json()).code).toBe('OBJECT_MISSING')
  })
})

// -------------------------------------------------------------- STORAGE -----

describe('STORAGE — errores sin filtración', () => {
  async function assertNoLeak(response: Response) {
    const text = await response.text()
    expect(text).not.toContain(KEY)
    expect(text).not.toContain('findings/')
    expect(text).not.toContain(root)
    expect(text).not.toContain('ENOENT')
    expect(text).not.toContain('EACCES')
    expect(text).not.toContain('ESTORAGEUNSAFE')
    expect(text).not.toContain('storageKey')
    expect(text).not.toContain('stack')
  }

  it('root inválido ⇒ 503 STORAGE_UNAVAILABLE', async () => {
    process.env[EVIDENCE_STORAGE_DIR_ENV] = '/tmp/no-vale'
    __resetEvidenceStorageRootForTests()

    const response = await call()
    expect(response.status).toBe(503)
    const clone = response.clone()
    expect((await clone.json()).code).toBe('STORAGE_UNAVAILABLE')
    await assertNoLeak(response)
  })

  it('storageKey inválida ⇒ 500 genérico', async () => {
    mockEvidence.findFirst.mockResolvedValue({ ...ROW, storageKey: 'findings/../../etc/passwd' })

    const response = await call()
    expect(response.status).toBe(500)
    await assertNoLeak(response)
  })

  it('symlink final ⇒ 500 genérico y JAMÁS los bytes externos', async () => {
    const outside = makeValidRoot()
    const secret = path.join(outside, 'secreto.txt')
    fs.writeFileSync(secret, 'CONTENIDO-EXTERNO-SECRETO', { mode: 0o600 })

    const dir = path.join(root, path.dirname(KEY))
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    for (const p of ['findings', 'findings/find_1', 'findings/find_1/ev_1']) {
      fs.chmodSync(path.join(root, p), 0o700)
    }
    fs.symlinkSync(secret, path.join(root, KEY))

    const response = await call()
    expect(response.status).toBe(500)

    const text = await response.clone().text()
    expect(text).not.toContain('CONTENIDO-EXTERNO-SECRETO')
    await assertNoLeak(response)
  })

  it('modo != 0600 ⇒ 500 genérico', async () => {
    await PrivateFileStore.put(KEY, BODY)
    fs.chmodSync(path.join(root, KEY), 0o644)

    const response = await call()
    expect(response.status).toBe(500)
    await assertNoLeak(response)
  })
})

// -------------------------------------------------- SIZE CONSISTENCY --------

describe('consistencia entre stat y getStream', () => {
  it('si el tamaño abierto difiere del de stat ⇒ 500 genérico, stream destruido y CERO bytes', async () => {
    await PrivateFileStore.put(KEY, BODY)

    const realGetStream = PrivateFileStore.getStream.bind(PrivateFileStore)
    let destroy: ReturnType<typeof vi.spyOn> | undefined

    // stat sigue devolviendo el tamaño real; getStream simula un objeto que
    // cambió de tamaño entre ambas llamadas. Se ESPÍA `destroy` sin sustituirlo,
    // para que el descriptor se cierre de verdad.
    const spy = vi
      .spyOn(PrivateFileStore, 'getStream')
      .mockImplementation(async (key, start, end) => {
        const opened = await realGetStream(key, start, end)
        destroy = vi.spyOn(opened.stream, 'destroy')
        return { stream: opened.stream, size: opened.size + 7 }
      })

    const response = await call()
    spy.mockRestore()

    expect(response.status).toBe(500)
    expect(destroy).toHaveBeenCalledTimes(1)

    // Ni 200 ni 206, y ningún byte del objeto en el cuerpo.
    expect(response.status).not.toBe(200)
    expect(response.status).not.toBe(206)

    const text = await response.text()
    expect(text).not.toContain('0123456789')
    expect(text).not.toContain(KEY)
    expect(text).not.toContain(root)
    expect(text).not.toContain('storageKey')
  })

  it('con tamaños coincidentes sí se sirven los bytes', async () => {
    await PrivateFileStore.put(KEY, BODY)

    const response = await call()
    expect(response.status).toBe(200)
    expect(await bodyBuffer(response)).toEqual(BODY)
  })
})

// ------------------------------------------------------------------ 200 -----

describe('200 — respuesta completa', () => {
  beforeEach(async () => {
    await PrivateFileStore.put(KEY, BODY)
  })

  it('devuelve los bytes exactos', async () => {
    const response = await call()
    expect(response.status).toBe(200)
    expect(await bodyBuffer(response)).toEqual(BODY)
  })

  it('Content-Type viene de la BD, no del fichero', async () => {
    mockEvidence.findFirst.mockResolvedValue({ ...ROW, mimeType: 'application/pdf' })
    expect((await call()).headers.get('content-type')).toBe('application/pdf')
  })

  it('cabeceras exactas', async () => {
    const h = (await call()).headers

    expect(h.get('content-length')).toBe(String(BODY.length))
    expect(h.get('accept-ranges')).toBe('bytes')
    expect(h.get('cache-control')).toBe('private, no-store')
    expect(h.get('vary')).toBe('Cookie')
    expect(h.get('x-content-type-options')).toBe('nosniff')
    expect(h.get('content-disposition')).toBe(
      `inline; filename="captura.png"; filename*=UTF-8''captura.png`,
    )
    expect(h.get('content-range')).toBeNull()
  })
})

// ------------------------------------------------------------------ 206 -----

describe('206 — rangos', () => {
  beforeEach(async () => {
    await PrivateFileStore.put(KEY, BODY)
  })

  it.each([
    ['bytes=0-9', 'bytes=0-9', 0, 9],
    ['bytes=10-19', 'bytes=10-19', 10, 19],
    ['bytes=30- (open-ended)', 'bytes=30-', 30, 35],
    ['bytes=-6 (sufijo)', 'bytes=-6', 30, 35],
    ['un solo byte', 'bytes=5-5', 5, 5],
  ])('%s devuelve los bytes exactos y las cabeceras correctas', async (
    _label,
    header,
    start,
    end,
  ) => {
    const response = await call(header)

    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe(`bytes ${start}-${end}/${BODY.length}`)
    expect(response.headers.get('content-length')).toBe(String(end - start + 1))
    expect(await bodyBuffer(response)).toEqual(BODY.subarray(start, end + 1))
  })

  it('sufijo mayor que el objeto devuelve el objeto completo con 206', async () => {
    const response = await call('bytes=-500')
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe(`bytes 0-35/${BODY.length}`)
    expect(await bodyBuffer(response)).toEqual(BODY)
  })

  it('el 206 conserva private/no-store, Vary y Accept-Ranges', async () => {
    const h = (await call('bytes=0-9')).headers
    expect(h.get('cache-control')).toBe('private, no-store')
    expect(h.get('vary')).toBe('Cookie')
    expect(h.get('accept-ranges')).toBe('bytes')
    expect(h.get('x-content-type-options')).toBe('nosniff')
  })
})

// ------------------------------------------------------------------ 416 -----

describe('416 — no satisfacible', () => {
  beforeEach(async () => {
    await PrivateFileStore.put(KEY, BODY)
  })

  it.each([
    ['start > end', 'bytes=20-10'],
    ['start >= total', 'bytes=36-'],
    ['muy más allá del final', 'bytes=500-600'],
    ['sufijo cero', 'bytes=-0'],
  ])('%s ⇒ 416 con Content-Range bytes *\\/total', async (_label, header) => {
    const response = await call(header)

    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe(`bytes */${BODY.length}`)
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Cookie')
  })
})

// -------------------------------------------------------- RANGE IGNORADO ----

describe('Range ignorado ⇒ 200 completo', () => {
  beforeEach(async () => {
    await PrivateFileStore.put(KEY, BODY)
  })

  it.each([
    ['malformado', 'bytes=abc'],
    ['unidad desconocida', 'items=0-1'],
    ['múltiples rangos', 'bytes=0-1,4-5'],
    ['solo guion', 'bytes=-'],
  ])('%s ⇒ 200 con el objeto completo', async (_label, header) => {
    const response = await call(header)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-range')).toBeNull()
    expect(response.headers.get('content-length')).toBe(String(BODY.length))
    expect(await bodyBuffer(response)).toEqual(BODY)
  })
})

// ------------------------------------------------------------- ZERO BYTE ----

describe('objeto de tamaño cero', () => {
  beforeEach(async () => {
    await PrivateFileStore.put(KEY, Buffer.alloc(0))
  })

  it('sin Range ⇒ 200 con Content-Length 0', async () => {
    const response = await call()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-length')).toBe('0')
    expect((await bodyBuffer(response)).length).toBe(0)
  })

  it('Range único válido ⇒ 416 con bytes *\\/0', async () => {
    const response = await call('bytes=0-0')
    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe('bytes */0')
  })

  it('Range malformado ⇒ 200 vacío', async () => {
    const response = await call('bytes=abc')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-length')).toBe('0')
  })
})

// -------------------------------------------------- CONTENT-DISPOSITION -----

describe('Content-Disposition en la ruta', () => {
  beforeEach(async () => {
    await PrivateFileStore.put(KEY, BODY)
  })

  it('nombre unicode ⇒ filename* RFC 5987 y cabecera sin CRLF', async () => {
    mockEvidence.findFirst.mockResolvedValue({ ...ROW, originalFilename: 'cañón.png' })

    const value = (await call()).headers.get('content-disposition')!
    expect(value).toContain("filename*=UTF-8''")
    expect(value).toContain('%C3%B1')
    expect(value).not.toContain('\r')
    expect(value).not.toContain('\n')
  })

  it('nombre envenenado con CRLF no inyecta cabeceras', async () => {
    mockEvidence.findFirst.mockResolvedValue({
      ...ROW,
      originalFilename: 'evil\r\nSet-Cookie: a=b',
    })

    const response = await call()
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('content-disposition')).not.toContain('\n')
  })
})

// ------------------------------------------------------------------ C-02 ----

describe('E2E lógico de C-02', () => {
  it('una Evidence CONFIRMED se sirve por su Evidence.url con 200 y MIME correcto', async () => {
    await PrivateFileStore.put(KEY, BODY)

    // La URL persistida en FASE 3 apunta a esta misma ruta.
    expect(ROW.url).toBe('/api/evidence/ev_1/file')

    const response = await call()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(await bodyBuffer(response)).toEqual(BODY)
  })
})
