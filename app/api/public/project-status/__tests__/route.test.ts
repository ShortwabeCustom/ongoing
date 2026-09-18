// @vitest-environment node
/**
 * /api/public/project-status es PÚBLICA a propósito (la sección del reporte la
 * ven todos los visitantes): no debe consultar la sesión ni exigir cookies,
 * debe cachearse como /api/public/report y degradar a 500 sin filtrar detalles.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetProjectStatus = vi.fn()
const mockGetSession = vi.fn()

vi.mock('@/lib/services/project-status', () => ({ getProjectStatus: () => mockGetProjectStatus() }))
vi.mock('@/lib/auth/lucia', () => ({ getSession: () => mockGetSession() }))

let GET: typeof import('@/app/api/public/project-status/route').GET

beforeAll(async () => {
  ;({ GET } = await import('@/app/api/public/project-status/route'))
})

beforeEach(() => {
  mockGetProjectStatus.mockReset()
  mockGetSession.mockReset()
})

describe('GET /api/public/project-status', () => {
  it('responde 200 sin sesión y sin consultarla, con caché pública', async () => {
    const items = [{ id: 'p1', name: 'PWA 2.0', owner: { name: 'Ilse Garcia', photoUrl: null }, uixResponsible: null, total: 0, statuses: [] }]
    mockGetProjectStatus.mockResolvedValue(items)

    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items })
    expect(res.headers.get('Cache-Control')).toContain('public')
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('si falla la consulta responde 500 genérico, sin detalles internos', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetProjectStatus.mockRejectedValue(new Error('connection refused to db.internal:5432'))

    const res = await GET()
    const text = await res.text()

    expect(res.status).toBe(500)
    expect(text).not.toContain('db.internal')
  })
})
