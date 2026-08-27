// @vitest-environment node
/**
 * ADR-001 D12 — GET /api/public/evidence/{id}/file.
 *
 * Contraparte anónima de `app/api/evidence/__tests__/file-route.test.ts`:
 * sin RBAC, solo sirve `visibility === 'PUBLIC_REPORT'`; todo lo demás
 * (PRIVATE, inexistente, borrada, finding borrado, legacy) es el mismo 404
 * indistinguible. El almacén se ejercita de verdad contra el filesystem, no
 * mockeado — igual que la ruta privada.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockEvidence = vi.hoisted(() => ({ findFirst: vi.fn() }))
vi.mock('@/lib/db-lazy', () => ({ getDb: () => ({ evidence: mockEvidence }) }))

const { GET } = await import('@/app/api/public/evidence/[id]/file/route')
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
  const request = new NextRequest('http://localhost/api/public/evidence/ev_1/file', { headers })
  return GET(request, { params: Promise.resolve({ id: 'ev_1' }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  root = makeValidRoot()
  process.env[EVIDENCE_STORAGE_DIR_ENV] = root
  __resetEvidenceStorageRootForTests()
  originalUmask = process.umask(0o000)
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

// ------------------------------------------------------------- LOOKUP -------

describe('lookup — sin RBAC, la visibilidad decide todo', () => {
  it('el where exige PUBLIC_REPORT, evidencia y finding activos, y excluye legacy', async () => {
    await call()
    expect(mockEvidence.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'ev_1',
          deletedAt: null,
          finding: { deletedAt: null },
          visibility: 'PUBLIC_REPORT',
          NOT: { storageKey: { startsWith: 'legacy/' } },
        },
      }),
    )
  })

  it('nunca invoca ningún mecanismo de RBAC/sesión', async () => {
    await PrivateFileStore.put(KEY, BODY)
    const response = await call()
    // Sin mock de checkRBAC en este módulo: si la ruta lo importara, el test
    // fallaría al resolver el import real (arrastra Lucia/getSession).
    expect(response.status).toBe(200)
  })
})

// ----------------------------------------------------------------- 404 ------

describe('404 — PRIVATE, inexistente, borrada, finding borrado y legacy son indistinguibles', () => {
  async function snapshot(response: Response) {
    return { status: response.status, body: await response.text(), contentType: response.headers.get('content-type') }
  }

  it('evidencia inexistente ⇒ 404', async () => {
    mockEvidence.findFirst.mockResolvedValue(null)
    expect((await call()).status).toBe(404)
  })

  it('PRIVATE (default D7, la query ya la excluye — simulado con null como el resto de 404) ⇒ 404', async () => {
    mockEvidence.findFirst.mockResolvedValue(null)
    expect((await call()).status).toBe(404)
  })

  it('legacy con visibility manipulada a PUBLIC_REPORT ⇒ igual 404 (defensa en profundidad, D3/D9)', async () => {
    mockEvidence.findFirst.mockResolvedValue({ ...ROW, storageKey: 'legacy/public/images/captura.png', url: '/images/captura.png' })
    expect((await call()).status).toBe(404)
  })

  it('los 404 de ausencia y de legacy son indistinguibles', async () => {
    mockEvidence.findFirst.mockResolvedValue(null)
    const missing = await snapshot(await call())

    mockEvidence.findFirst.mockResolvedValue({ ...ROW, storageKey: 'legacy/x.png', url: '/images/x.png' })
    const legacy = await snapshot(await call())

    expect(legacy).toEqual(missing)
  })
})

// --------------------------------------------------------------- ESTADO -----

describe('ESTADO', () => {
  it('PENDING (url null) ⇒ 409 UPLOAD_INCOMPLETE', async () => {
    mockEvidence.findFirst.mockResolvedValue({ ...ROW, url: null })
    const response = await call()
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('UPLOAD_INCOMPLETE')
  })

  it('CONFIRMED sin objeto en disco ⇒ 410 OBJECT_MISSING', async () => {
    const response = await call() // no put
    expect(response.status).toBe(410)
    expect((await response.json()).code).toBe('OBJECT_MISSING')
  })
})

// -------------------------------------------------------------- STORAGE -----

describe('STORAGE — sin fuga de storageKey/paths', () => {
  async function assertNoLeak(response: Response) {
    const text = await response.text()
    expect(text).not.toContain(KEY)
    expect(text).not.toContain('findings/')
    expect(text).not.toContain(root)
    expect(text).not.toContain('storageKey')
    expect(text).not.toContain('stack')
  }

  it('root inválido ⇒ 503 STORAGE_UNAVAILABLE, sin fuga', async () => {
    process.env[EVIDENCE_STORAGE_DIR_ENV] = '/tmp/no-vale'
    __resetEvidenceStorageRootForTests()

    const response = await call()
    expect(response.status).toBe(503)
    expect((await response.clone().json()).code).toBe('STORAGE_UNAVAILABLE')
    await assertNoLeak(response)
  })

  it('storageKey envenenada en BD ⇒ 500 genérico, sin fuga', async () => {
    mockEvidence.findFirst.mockResolvedValue({ ...ROW, storageKey: 'findings/../../etc/passwd' })
    const response = await call()
    expect(response.status).toBe(500)
    await assertNoLeak(response)
  })
})

// ------------------------------------------------------------------ 200 -----

describe('200/206 — solo evidencia PUBLIC_REPORT', () => {
  beforeEach(async () => {
    await PrivateFileStore.put(KEY, BODY)
  })

  it('devuelve los bytes exactos', async () => {
    const response = await call()
    expect(response.status).toBe(200)
    expect(await bodyBuffer(response)).toEqual(BODY)
  })

  it('Cache-Control es exactamente no-store (no "private, no-store")', async () => {
    const h = (await call()).headers
    expect(h.get('cache-control')).toBe('no-store')
  })

  it('cabeceras: sin Vary (no depende de cookies, es anónima)', async () => {
    const h = (await call()).headers
    expect(h.get('vary')).toBeNull()
    expect(h.get('accept-ranges')).toBe('bytes')
    expect(h.get('x-content-type-options')).toBe('nosniff')
  })

  it('Content-Type viene de la BD', async () => {
    mockEvidence.findFirst.mockResolvedValue({ ...ROW, mimeType: 'application/pdf' })
    expect((await call()).headers.get('content-type')).toBe('application/pdf')
  })

  it('soporta Range con 206 y Content-Range correctos', async () => {
    const response = await call('bytes=0-9')
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe(`bytes 0-9/${BODY.length}`)
    expect(await bodyBuffer(response)).toEqual(BODY.subarray(0, 10))
  })

  it('rango no satisfacible ⇒ 416', async () => {
    const response = await call('bytes=500-600')
    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe(`bytes */${BODY.length}`)
  })
})

// ------------------------------------------------------- CONTRATO CRUZADO ---

describe('no reemplaza ni relaja la ruta privada', () => {
  it('esta ruta vive en un módulo separado de /api/evidence/[id]/file', async () => {
    const privateRoute = await import('@/app/api/evidence/[id]/file/route')
    const publicRoute = await import('@/app/api/public/evidence/[id]/file/route')
    expect(privateRoute.GET).not.toBe(publicRoute.GET)
  })
})
