import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProjectStatus } from '@/lib/services/project-status'

const mockProject = { findMany: vi.fn() }
const mockFinding = { groupBy: vi.fn() }

vi.mock('@/lib/db-lazy', () => ({
  getDb: () => ({ project: mockProject, finding: mockFinding }),
}))

const owner = { id: 'u1', name: 'Alexis Valdez Cortez' }

beforeEach(() => {
  mockProject.findMany.mockReset()
  mockFinding.groupBy.mockReset()
})

describe('getProjectStatus', () => {
  it('devuelve solo los estados con hallazgos, en orden de ciclo de vida, con los conteos tal cual', async () => {
    mockProject.findMany.mockResolvedValue([{ id: 'p1', name: 'PWA 2.0', owner }])
    mockFinding.groupBy.mockResolvedValue([
      { projectId: 'p1', status: 'VALIDATED', _count: { _all: 140 } },
      { projectId: 'p1', status: 'OPEN', _count: { _all: 250 } },
    ])

    const [item] = await getProjectStatus({ id: 'u1', role: 'OWNER' })

    expect(item).toEqual({
      id: 'p1',
      name: 'PWA 2.0',
      owner,
      total: 390,
      statuses: [
        { status: 'OPEN', label: 'Abierto', count: 250 },
        { status: 'VALIDATED', label: 'Validado', count: 140 },
      ],
    })
  })

  it('un proyecto sin hallazgos queda con total 0 y sin estados (no se inventa ninguno)', async () => {
    mockProject.findMany.mockResolvedValue([{ id: 'p2', name: 'Mi negocio', owner }])
    mockFinding.groupBy.mockResolvedValue([])

    const [item] = await getProjectStatus({ id: 'u1', role: 'OWNER' })

    expect(item.total).toBe(0)
    expect(item.statuses).toEqual([])
  })

  it('no expone campos que no existen en el modelo (avance, responsable UIX, contraparte)', async () => {
    mockProject.findMany.mockResolvedValue([{ id: 'p1', name: 'PWA 2.0', owner }])
    mockFinding.groupBy.mockResolvedValue([])

    const [item] = await getProjectStatus({ id: 'u1', role: 'OWNER' })

    expect(Object.keys(item).sort()).toEqual(['id', 'name', 'owner', 'statuses', 'total'])
  })

  it('limita los proyectos por acceso para roles no OWNER y no consulta hallazgos si no hay proyectos', async () => {
    mockProject.findMany.mockResolvedValue([])

    const items = await getProjectStatus({ id: 'u9', role: 'QA_LEAD' })

    expect(items).toEqual([])
    expect(mockFinding.groupBy).not.toHaveBeenCalled()
    const [{ where }] = mockProject.findMany.mock.calls[0]
    expect(where.OR).toEqual([{ ownerId: 'u9' }, { members: { some: { userId: 'u9' } } }])
  })
})
