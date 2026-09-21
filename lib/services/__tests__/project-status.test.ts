import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProjectStatus, sourceStatusKey } from '@/lib/services/project-status'
import { PROJECT_STATUS_REPORT } from '@/lib/config/project-status-report'

const mockProject = { findMany: vi.fn() }
const mockFinding = { groupBy: vi.fn() }
const mockUser = { findMany: vi.fn() }

vi.mock('@/lib/db-lazy', () => ({
  getDb: () => ({ project: mockProject, finding: mockFinding, user: mockUser }),
}))

const owner = { id: 'u1', name: 'Alexis Valdez Cortez' }
const [PWA_2_0_ID] = PROJECT_STATUS_REPORT.visibleProjectIds
const ilse = { id: PROJECT_STATUS_REPORT.projects[PWA_2_0_ID].ownerUserId!, name: 'Ilse Garcia' }
const jonathan = { id: PROJECT_STATUS_REPORT.projects[PWA_2_0_ID].uixResponsibleUserId!, name: 'Jonathan Ramos' }

beforeEach(() => {
  mockProject.findMany.mockReset()
  mockFinding.groupBy.mockReset()
  mockUser.findMany.mockReset().mockResolvedValue([])
})

describe('getProjectStatus (público)', () => {
  it('devuelve solo los estados con hallazgos, en orden de ciclo de vida, con los conteos tal cual', async () => {
    mockProject.findMany.mockResolvedValue([{ id: 'p1', name: 'Otro proyecto', owner }])
    mockFinding.groupBy.mockResolvedValue([
      { projectId: 'p1', status: 'VALIDATED', _count: { _all: 140 } },
      { projectId: 'p1', status: 'OPEN', _count: { _all: 250 } },
      { projectId: 'p1', status: 'TRIAGED', _count: { _all: 4 } },
    ])

    const [item] = await getProjectStatus()

    expect(item).toEqual({
      id: 'p1',
      name: 'Otro proyecto',
      owner: { name: owner.name, photoUrl: null },
      uixResponsible: null,
      total: 394,
      statuses: [
        { status: 'OPEN', label: 'Abierto', count: 250 },
        { status: 'TRIAGED', label: 'Clasificado', count: 4 },
        { status: 'VALIDATED', label: 'Validado', count: 140 },
      ],
    })
  })

  it('un proyecto sin hallazgos queda con total 0 y sin estados (no se inventa ninguno)', async () => {
    mockProject.findMany.mockResolvedValue([{ id: 'p2', name: 'Vacío', owner }])
    mockFinding.groupBy.mockResolvedValue([])

    const [item] = await getProjectStatus()

    expect(item.total).toBe(0)
    expect(item.statuses).toEqual([])
  })

  it('no expone campos que no existen en el modelo (avance, contraparte de Negocio)', async () => {
    mockProject.findMany.mockResolvedValue([{ id: 'p1', name: 'X', owner }])
    mockFinding.groupBy.mockResolvedValue([])

    const [item] = await getProjectStatus()

    expect(Object.keys(item).sort()).toEqual(['id', 'name', 'owner', 'statuses', 'total', 'uixResponsible'])
  })

  it('solo consulta los proyectos de la lista blanca (un proyecto nuevo nunca se publica solo)', async () => {
    mockProject.findMany.mockResolvedValue([])

    await getProjectStatus()

    const [{ where }] = mockProject.findMany.mock.calls[0]
    expect(where).toEqual({ deletedAt: null, id: { in: PROJECT_STATUS_REPORT.visibleProjectIds } })
    expect(PROJECT_STATUS_REPORT.visibleProjectIds).toEqual([PWA_2_0_ID])
  })

  it('PWA 2.0: owner (Ilse) y responsable UIX (Jonathan, nombre completo) con su foto, sin Clasificado ni Cerrado', async () => {
    mockProject.findMany.mockResolvedValue([{ id: PWA_2_0_ID, name: 'PWA 2.0', owner }])
    mockUser.findMany.mockResolvedValue([ilse, jonathan])
    mockFinding.groupBy.mockResolvedValue([
      { projectId: PWA_2_0_ID, status: 'OPEN', _count: { _all: 105 } },
      { projectId: PWA_2_0_ID, status: 'TRIAGED', _count: { _all: 4 } },
      { projectId: PWA_2_0_ID, status: 'VALIDATED', _count: { _all: 140 } },
      { projectId: PWA_2_0_ID, status: 'CLOSED', _count: { _all: 1 } },
    ])

    const [item] = await getProjectStatus()

    expect(item.owner).toEqual({ name: 'Ilse Garcia', photoUrl: '/images/team/ilse-garcia.webp' })
    expect(item.uixResponsible).toEqual({
      name: 'Jonathan Daniel Ramos Segoviano',
      photoUrl: '/images/team/jonathan-ramos.webp',
    })
    expect(item.statuses).toEqual([
      { status: 'OPEN', label: 'Abierto', count: 105 },
      { status: 'VALIDATED', label: 'Validado', count: 140 },
    ])
    expect(item.total).toBe(245)
  })

  it('la respuesta pública no contiene ids ni correos de personas', async () => {
    mockProject.findMany.mockResolvedValue([{ id: PWA_2_0_ID, name: 'PWA 2.0', owner }])
    mockUser.findMany.mockResolvedValue([ilse, jonathan])
    mockFinding.groupBy.mockResolvedValue([])

    const json = JSON.stringify(await getProjectStatus())

    for (const secret of [ilse.id, jonathan.id, owner.id, 'elektra.com.mx', 'email']) {
      expect(json).not.toContain(secret)
    }
  })


  it('sourceStatusKey genera claves estables para el color de la leyenda', () => {
    expect(sourceStatusKey('On hold')).toBe('ON_HOLD')
    expect(sourceStatusKey('Refinamiento')).toBe('REFINAMIENTO')
    expect(sourceStatusKey('  En  revisión ')).toBe('EN_REVISION')
    expect(sourceStatusKey('???')).toBe('SIN_ESTATUS')
  })

  it('si el usuario configurado no existe, cae al owner registrado y no inventa responsable UIX', async () => {
    mockProject.findMany.mockResolvedValue([{ id: PWA_2_0_ID, name: 'PWA 2.0', owner }])
    mockFinding.groupBy.mockResolvedValue([])

    const [item] = await getProjectStatus()

    expect(item.owner).toEqual({ name: owner.name, photoUrl: null })
    expect(item.uixResponsible).toBeNull()
  })
})
