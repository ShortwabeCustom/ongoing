import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  deleteFinding: vi.fn(),
}))

vi.mock('@/lib/auth/lucia', () => ({
  getSession: mocks.getSession,
}))

vi.mock('@/lib/services/finding-service', () => ({
  FindingService: { deleteFinding: mocks.deleteFinding },
}))

import { DELETE as deleteFinding } from '../route'

const FINDING_ID = 'cmswc3f5u0000to2sgyavp8xh'
const params = Promise.resolve({ id: FINDING_ID })

function makeRequest() {
  return new NextRequest(`http://127.0.0.1:3000/api/findings/${FINDING_ID}`, { method: 'DELETE' })
}

function sessionFor(role: string, id = 'user-1') {
  return { session: { id: 'sess-1' }, user: { id, email: 'x@y.z', name: 'X', role } }
}

describe('DELETE /api/findings/[id] — RBAC (DELETE_FINDING = OWNER, QA_LEAD)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deleteFinding.mockResolvedValue({ id: FINDING_ID })
  })

  it('devuelve 401 a un anónimo y no llama al servicio', async () => {
    mocks.getSession.mockResolvedValue(null)

    const response = (await deleteFinding(makeRequest(), { params }))!

    expect(response.status).toBe(401)
    expect(mocks.deleteFinding).not.toHaveBeenCalled()
  })

  it.each(['VIEWER', 'DESIGNER', 'DEVELOPER', 'BUSINESS_REVIEWER'])(
    'devuelve 403 al rol %s (sin DELETE_FINDING) y no llama al servicio',
    async (role) => {
      mocks.getSession.mockResolvedValue(sessionFor(role))

      const response = (await deleteFinding(makeRequest(), { params }))!

      expect(response.status).toBe(403)
      expect(mocks.deleteFinding).not.toHaveBeenCalled()
    },
  )

  it.each(['OWNER', 'QA_LEAD'])('permite a %s eliminar y devuelve 204', async (role) => {
    mocks.getSession.mockResolvedValue(sessionFor(role, 'actor-1'))

    const response = (await deleteFinding(makeRequest(), { params }))!

    expect(response.status).toBe(204)
    expect(mocks.deleteFinding).toHaveBeenCalledWith(FINDING_ID, 'actor-1')
  })

  it('propaga NOT_FOUND del servicio como 404', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('OWNER'))
    mocks.deleteFinding.mockRejectedValue(new Error('NOT_FOUND'))

    const response = (await deleteFinding(makeRequest(), { params }))!

    expect(response.status).toBe(404)
  })

  it('propaga ALREADY_DELETED del servicio como 410', async () => {
    mocks.getSession.mockResolvedValue(sessionFor('QA_LEAD'))
    mocks.deleteFinding.mockRejectedValue(new Error('ALREADY_DELETED'))

    const response = (await deleteFinding(makeRequest(), { params }))!

    expect(response.status).toBe(410)
  })
})
