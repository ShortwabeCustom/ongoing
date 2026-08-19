// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivityLog } from '../ActivityLog'

const mocks = vi.hoisted(() => ({
  getAuditLog: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('@/lib/api/workflow-client', () => ({
  WorkflowClient: { getAuditLog: mocks.getAuditLog },
}))

vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }))

function activity(index: number) {
  return {
    id: `activity-${index}`,
    action: index === 0 ? 'STATUS_CHANGE' : 'RESOLVE',
    actorId: 'user-1',
    actor: { name: 'Alexis Valdez Cortez', email: 'alexis@example.com' },
    before: { status: index === 0 ? 'OPEN' : 'TRIAGED' },
    after: { status: index === 0 ? 'TRIAGED' : 'APPROVED' },
    createdAt: `2026-08-19T13:${String(30 + index).padStart(2, '0')}:00.000Z`,
  }
}

beforeEach(() => {
  mocks.getAuditLog.mockResolvedValue({
    status: 'success',
    data: { items: Array.from({ length: 7 }, (_, index) => activity(index)), total: 7 },
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ActivityLog', () => {
  it('permanece colapsado por defecto y muestra sólo las cinco actividades recientes al abrirse', async () => {
    render(<ActivityLog findingId="finding-1" />)

    await screen.findByText('7 actividades registradas')
    const history = screen.getByText('Historial de actividades').closest('details')

    expect((history as HTMLDetailsElement).open).toBe(false)
    fireEvent.click(screen.getByText('Historial de actividades'))
    expect(screen.getAllByText('Alexis Valdez Cortez')).toHaveLength(5)
  })

  it('permite mostrar todo el historial y consultar los cambios técnicos', async () => {
    render(<ActivityLog findingId="finding-1" />)

    await screen.findByText('7 actividades registradas')
    fireEvent.click(screen.getByText('Historial de actividades'))
    fireEvent.click(screen.getByRole('button', { name: 'Ver todo el historial (7)' }))

    expect(screen.getAllByText('Alexis Valdez Cortez')).toHaveLength(7)
    const detailToggle = screen.getAllByText('Ver detalles')[0]
    fireEvent.click(detailToggle)
    const technicalDetail = detailToggle.closest('details') as HTMLDetailsElement

    expect(technicalDetail.open).toBe(true)
    expect(technicalDetail.textContent).toContain('OPEN')
    expect(technicalDetail.textContent).toContain('TRIAGED')
  })
})
