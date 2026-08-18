// @vitest-environment node
/**
 * ADR-001 D5.5 / §3.2 — contrato HTTP de los DOS entrypoints de upload.
 *
 * Ambos delegan en el mismo servicio y NO se unifican en P1-B.2. Se verifica
 * que se comportan igual en lo que el ADR fija: 201 sin `storageKey`, y
 * cualquier fallo del almacén colapsado en 500 `STORAGE_UNAVAILABLE` sin
 * filtrar rutas ni errno.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockRBAC = vi.hoisted(() => ({ checkRBAC: vi.fn() }))
const mockService = vi.hoisted(() => ({ uploadFile: vi.fn() }))

// Mock completo: importar el módulo real arrastraría Lucia y `db-lazy`, que
// exige DATABASE_URL. Aquí solo interesa el contrato HTTP de las rutas.
vi.mock('@/lib/middleware/rbac', () => ({
  checkRBAC: mockRBAC.checkRBAC,
  RBAC_PERMISSIONS: {
    CREATE_FINDING: ['OWNER', 'QA_LEAD', 'DESIGNER', 'DEVELOPER'],
    VIEW_ALL_FINDINGS: ['OWNER', 'QA_LEAD', 'DESIGNER', 'DEVELOPER', 'BUSINESS_REVIEWER', 'VIEWER'],
  },
}))
vi.mock('@/lib/services/storage-service', () => ({ StorageService: mockService }))

const { POST: uploadPOST } = await import('@/app/api/evidence/upload/route')
const { POST: findingEvidencePOST } = await import('@/app/api/findings/[id]/evidence/route')
const { StorageIOError, StorageConfigError } = await import('@/lib/storage/storage-errors')

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16, 0),
])

const SUCCESS = {
  id: 'ev_1',
  findingId: 'find_1',
  originalFilename: 'captura.png',
  mimeType: 'image/png',
  fileSize: PNG.length,
  url: '/api/evidence/ev_1/file',
  urlExpiresAt: new Date('2026-08-18T10:00:00Z'),
  caption: undefined,
  uploadedAt: new Date('2026-08-17T10:00:00Z'),
  uploadedBy: 'user_1',
}

function buildRequest(withFindingId: boolean): NextRequest {
  const form = new FormData()
  form.append('file', new File([PNG], 'captura.png', { type: 'image/png' }))
  if (withFindingId) form.append('findingId', 'find_1')
  return new NextRequest('http://localhost/api/evidence/upload', {
    method: 'POST',
    body: form,
  })
}

/** Invoca cada entrypoint con la forma que le corresponde. */
const ENTRYPOINTS = [
  {
    name: '/api/evidence/upload (findingId en formData)',
    call: () => uploadPOST(buildRequest(true)),
  },
  {
    name: '/api/findings/[id]/evidence (findingId en la ruta)',
    call: () =>
      findingEvidencePOST(buildRequest(false), {
        params: Promise.resolve({ id: 'find_1' }),
      }),
  },
] as const

beforeEach(() => {
  vi.clearAllMocks()
  mockRBAC.checkRBAC.mockResolvedValue({ valid: true, user: { id: 'user_1' } })
  mockService.uploadFile.mockResolvedValue(SUCCESS)
})

describe.each(ENTRYPOINTS)('$name', ({ call }) => {
  it('responde 201 en el camino feliz', async () => {
    const response = await call()
    expect(response.status).toBe(201)
  })

  it('el 201 NO expone storageKey', async () => {
    const response = await call()
    const body = await response.json()

    expect(body).not.toHaveProperty('storageKey')
    expect(JSON.stringify(body)).not.toContain('storageKey')
    expect(JSON.stringify(body)).not.toContain('findings/find_1/')
  })

  it('un StorageIOError se colapsa en 500 STORAGE_UNAVAILABLE sin filtrar detalles', async () => {
    mockService.uploadFile.mockRejectedValue(
      new StorageIOError('No se pudo escribir /var/lib/evidence/findings/x', {
        errno: 'EEXIST',
      }),
    )

    const response = await call()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.code).toBe('STORAGE_UNAVAILABLE')

    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('EEXIST')
    expect(serialized).not.toContain('/var/lib/evidence')
    expect(serialized).not.toContain('errno')
  })

  it('un StorageConfigError también se colapsa en 500 STORAGE_UNAVAILABLE', async () => {
    mockService.uploadFile.mockRejectedValue(
      new StorageConfigError('EVIDENCE_STORAGE_DIR no está definida'),
    )

    const response = await call()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.code).toBe('STORAGE_UNAVAILABLE')
    expect(JSON.stringify(body)).not.toContain('EVIDENCE_STORAGE_DIR')
  })

  it('las validaciones existentes siguen intactas: MIME_MISMATCH ⇒ 415', async () => {
    mockService.uploadFile.mockRejectedValue(new Error('MIME_MISMATCH'))
    const response = await call()
    expect(response.status).toBe(415)
    expect((await response.json()).code).toBe('MIME_MISMATCH')
  })

  it('las validaciones existentes siguen intactas: NOT_FOUND ⇒ 404', async () => {
    mockService.uploadFile.mockRejectedValue(new Error('NOT_FOUND'))
    const response = await call()
    expect(response.status).toBe(404)
  })

  it('RBAC denegado corta antes de llamar al servicio', async () => {
    mockRBAC.checkRBAC.mockResolvedValue({
      valid: false,
      error: new Response(null, { status: 403 }),
    })

    const response = await call()
    expect(response.status).toBe(403)
    expect(mockService.uploadFile).not.toHaveBeenCalled()
  })
})
