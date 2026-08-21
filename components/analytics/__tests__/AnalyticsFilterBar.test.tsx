import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { AnalyticsFilterBar } from '../AnalyticsFilterBar'

afterEach(cleanup)

const pushMock = vi.fn()
let currentSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/dashboard/analytics',
  useSearchParams: () => currentSearchParams,
}))

vi.mock('@/lib/hooks/useLookups', () => ({
  useLookups: () => ({
    assignees: [
      { id: 'user-1', name: 'Ana Pérez' },
      { id: 'user-2', name: 'Luis Gómez' },
    ],
    projects: [
      { id: 'proj-1', name: 'Pruebas María 2.0' },
      { id: 'proj-2', name: 'Pruebas María 1.0' },
    ],
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/components/search/SearchFindings', () => ({
  SearchFindings: (props: { presentation?: string; showQuickFilters?: boolean }) => (
    <div
      data-testid="search-findings-stub"
      data-presentation={props.presentation}
      data-show-quick-filters={String(props.showQuickFilters)}
    />
  ),
}))

beforeEach(() => {
  pushMock.mockClear()
  currentSearchParams = new URLSearchParams()
})

describe('AnalyticsFilterBar', () => {
  it('reuses SearchFindings for the search input with its own quick filters hidden', () => {
    render(<AnalyticsFilterBar />)
    const stub = screen.getByTestId('search-findings-stub')
    expect(stub.getAttribute('data-presentation')).toBe('dropdown')
    expect(stub.getAttribute('data-show-quick-filters')).toBe('false')
  })

  it('reconstructs Estado/Prioridad/Proyecto/Asignado from the URL on render (reload)', () => {
    currentSearchParams = new URLSearchParams({
      status: 'OPEN,TRIAGED',
      priority: 'HIGH',
      projectId: 'proj-1',
      assigneeId: 'user-2',
    })

    render(<AnalyticsFilterBar />)

    expect(screen.getByRole('button', { name: /Estado · 2 seleccionados/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Prioridad · 1 seleccionados/ })).toBeTruthy()
    expect(screen.getByText('Proyecto: Pruebas María 2.0')).toBeTruthy()
    expect(screen.getByText('Asignado: Luis Gómez')).toBeTruthy()
  })

  it('selecting a status option pushes the URL for /dashboard/analytics, never /findings', async () => {
    render(<AnalyticsFilterBar />)

    fireEvent.click(screen.getByRole('button', { name: 'Estado' }))
    const open = await screen.findByText('Abierto')
    fireEvent.click(open)

    expect(pushMock).toHaveBeenCalledTimes(1)
    const [url] = pushMock.mock.calls[0]
    expect(url.startsWith('/dashboard/analytics?')).toBe(true)
    expect(url).not.toContain('/findings')
    expect(url).toContain('status=OPEN')
  })

  it('Proyecto is single-select: choosing a second project replaces the first instead of adding to it', async () => {
    currentSearchParams = new URLSearchParams({ projectId: 'proj-1' })
    render(<AnalyticsFilterBar />)

    fireEvent.click(screen.getByRole('button', { name: /^Proyecto/ }))
    const secondProject = await screen.findByText('Pruebas María 1.0')
    fireEvent.click(secondProject)

    const [url] = pushMock.mock.calls[0]
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('projectId')).toBe('proj-2')
  })

  it('"Limpiar filtros" clears status/priority/severity/projectId/assigneeId but leaves other params (e.g. from/to) untouched', () => {
    currentSearchParams = new URLSearchParams({
      status: 'OPEN',
      projectId: 'proj-1',
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-31T23:59:59.999Z',
    })
    render(<AnalyticsFilterBar />)

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    const [url] = pushMock.mock.calls[0]
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.has('status')).toBe(false)
    expect(params.has('projectId')).toBe(false)
    expect(params.get('from')).toBe('2026-07-01T00:00:00.000Z')
    expect(params.get('to')).toBe('2026-07-31T23:59:59.999Z')
  })

  it('does not render the "Filtros activos" row or "Limpiar filtros" when nothing is active', () => {
    render(<AnalyticsFilterBar />)
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull()
  })
})
