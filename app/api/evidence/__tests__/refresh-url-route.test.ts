// @vitest-environment node
/**
 * ADR-001 D5.1 — mapeo HTTP del estado PENDING en `refresh-url`.
 *
 * Una evidencia de runtime cuyo upload no se confirmó existe en BD pero no es
 * entregable. No es un 404 (existe) ni un 500 (no es un fallo del sistema):
 * es un conflicto de estado, 409.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockRBAC = vi.hoisted(() => ({ checkRBAC: vi.fn() }))
const mockService = vi.hoisted(() => ({ refreshSignedUrl: vi.fn() }))

// Mock completo: el módulo real arrastra Lucia y `db-lazy` (exige DATABASE_URL).
vi.mock('@/lib/middleware/rbac', () => ({
  checkRBAC: mockRBAC.checkRBAC,
  RBAC_PERMISSIONS: {
    CREATE_FINDING: ['OWNER', 'QA_LEAD', 'DESIGNER', 'DEVELOPER'],
    VIEW_ALL_FINDINGS: ['OWNER', 'QA_LEAD', 'DESIGNER', 'DEVELOPER', 'BUSINESS_REVIEWER', 'VIEWER'],
  },
}))
vi.mock('@/lib/services/storage-service', () => ({ StorageService: mockService }))

const { POST } = await import('@/app/api/evidence/[id]/refresh-url/route')

function call() {
  const request = new NextRequest('http://localhost/api/evidence/ev_1/refresh-url', {
    method: 'POST',
  })
  return POST(request, { params: Promise.resolve({ id: 'ev_1' }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRBAC.checkRBAC.mockResolvedValue({ valid: true, user: { id: 'user_1' } })
})

describe('POST /api/evidence/{id}/refresh-url', () => {
  it('UPLOAD_INCOMPLETE ⇒ 409 con code UPLOAD_INCOMPLETE', async () => {
    mockService.refreshSignedUrl.mockRejectedValue(new Error('UPLOAD_INCOMPLETE'))

    const response = await call()
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('UPLOAD_INCOMPLETE')
  })

  it('el 409 no filtra detalles internos', async () => {
    mockService.refreshSignedUrl.mockRejectedValue(new Error('UPLOAD_INCOMPLETE'))

    const serialized = JSON.stringify(await (await call()).json())

    expect(serialized).not.toContain('findings/')
    expect(serialized).not.toContain('storageKey')
    expect(serialized).not.toContain('/var/lib')
    expect(serialized).not.toContain('stack')
  })

  it('NOT_FOUND sigue devolviendo 404', async () => {
    mockService.refreshSignedUrl.mockRejectedValue(new Error('NOT_FOUND'))
    expect((await call()).status).toBe(404)
  })

  it('UNSIGNED_LEGACY_EVIDENCE sigue devolviendo 422', async () => {
    mockService.refreshSignedUrl.mockRejectedValue(new Error('UNSIGNED_LEGACY_EVIDENCE'))
    expect((await call()).status).toBe(422)
  })

  it('runtime CONFIRMED ⇒ 200 con la URL persistida', async () => {
    mockService.refreshSignedUrl.mockResolvedValue({
      id: 'ev_1',
      url: '/api/evidence/ev_1/file',
      urlExpiresAt: new Date('2026-08-18T10:00:00Z'),
    })

    const response = await call()
    expect(response.status).toBe(200)
    expect((await response.json()).url).toBe('/api/evidence/ev_1/file')
  })
})
