// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ deleteEvidence: vi.fn(), checkRBAC: vi.fn() }))
vi.mock('@/lib/services/storage-service', () => ({ StorageService: { deleteEvidence: mocks.deleteEvidence } }))
vi.mock('@/lib/middleware/rbac', () => ({ checkRBAC: mocks.checkRBAC, RBAC_PERMISSIONS: { CREATE_FINDING: ['OWNER'] } }))
const { DELETE } = await import('@/app/api/evidence/[id]/route')
function call() { return DELETE(new NextRequest('http://localhost/api/evidence/ev_1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'ev_1' }) }) }
describe('DELETE evidence D6.1', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.checkRBAC.mockResolvedValue({ valid: true, user: { id: 'user_1' } }); mocks.deleteEvidence.mockResolvedValue(undefined) })
  it('primer delete devuelve 204 y pasa el actor', async () => {
    expect((await call()).status).toBe(204)
    expect(mocks.deleteEvidence).toHaveBeenCalledWith('ev_1', 'user_1')
  })
  it('delete repetido devuelve 410 ALREADY_DELETED', async () => {
    mocks.deleteEvidence.mockRejectedValue(new Error('ALREADY_DELETED'))
    const response = await call()
    expect(response.status).toBe(410)
    expect((await response.json()).code).toBe('ALREADY_DELETED')
  })
})
