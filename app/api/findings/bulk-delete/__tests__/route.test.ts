import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), bulkDelete: vi.fn() }))
vi.mock('@/lib/auth/lucia', () => ({ getSession: mocks.getSession }))
vi.mock('@/lib/services/finding-service', () => ({ FindingService: { bulkDeleteFindings: mocks.bulkDelete } }))

import { POST } from '../route'

const request = (ids: string[]) => new NextRequest('http://localhost/api/findings/bulk-delete', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }),
})
const session = (role: string) => ({ session: { id: 'session' }, user: { id: 'user-1', role } })

describe('POST /api/findings/bulk-delete', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.bulkDelete.mockResolvedValue({ deleted: 2, ids: ['finding-a', 'finding-b'] }) })

  it('permite OWNER y delega IDs deduplicados al servicio', async () => {
    mocks.getSession.mockResolvedValue(session('OWNER'))
    const response = await POST(request(['finding-a', 'finding-a', 'finding-b']))
    expect(response.status).toBe(200)
    expect(mocks.bulkDelete).toHaveBeenCalledWith(['finding-a', 'finding-b'], 'user-1')
  })

  it('rechaza una llamada directa de un rol sin DELETE_FINDING', async () => {
    mocks.getSession.mockResolvedValue(session('VIEWER'))
    const response = await POST(request(['finding-a']))
    expect(response.status).toBe(403)
    expect(mocks.bulkDelete).not.toHaveBeenCalled()
  })
})
