import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const searchMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  search: vi.fn(),
}))

// Se mockea SOLO la sesión (no checkRBAC): el contrato de autorización real
// debe ejercitarse de punta a punta en el handler.
vi.mock('@/lib/auth/lucia', () => ({
  getSession: searchMocks.getSession,
}))

vi.mock('@/lib/services/search-service', () => ({
  SearchService: {
    search: searchMocks.search,
  },
}))

import { GET } from '../route'

function makeRequest(query = '') {
  return new NextRequest(`http://127.0.0.1:3000/api/search/findings${query}`)
}

function sessionFor(role: string) {
  return { session: { id: 'sess-1' }, user: { id: 'user-1', email: 'x@y.z', name: 'X', role } }
}

describe('GET /api/search/findings — contrato de autenticación (C-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchMocks.search.mockResolvedValue({ total: 0, items: [], source: 'postgresql' })
  })

  it('devuelve 401 a un anónimo (sin cookie de sesión)', async () => {
    searchMocks.getSession.mockResolvedValue(null)

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    expect(searchMocks.search).not.toHaveBeenCalled()
  })

  it('no filtra ningún hallazgo en el cuerpo de la respuesta anónima', async () => {
    searchMocks.getSession.mockResolvedValue(null)

    const response = await GET(makeRequest('?q=algo'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(JSON.stringify(body)).not.toContain('items')
  })

  it('permite a todos los roles con VIEW_ALL_FINDINGS (incluye VIEWER)', async () => {
    const roles = ['OWNER', 'QA_LEAD', 'DESIGNER', 'DEVELOPER', 'BUSINESS_REVIEWER', 'VIEWER']

    for (const role of roles) {
      searchMocks.getSession.mockResolvedValue(sessionFor(role))
      const response = await GET(makeRequest())
      expect(response.status, `rol ${role}`).toBe(200)
    }

    expect(searchMocks.search).toHaveBeenCalledTimes(roles.length)
  })
})
