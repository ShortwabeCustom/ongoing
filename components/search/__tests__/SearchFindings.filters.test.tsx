import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { SearchFindings } from '../SearchFindings'
import { getUTCRangeForDaysBack } from '@/lib/utils/date-presets'
import type { SearchHistoryEntry } from '@/lib/types/search'

const [TODAY_FROM, TODAY_TO] = getUTCRangeForDaysBack(0)

afterEach(cleanup)

// jsdom has neither matchMedia nor ResizeObserver, needed by the Base UI
// popover positioning used throughout the new filter primitives. It also
// doesn't hide either responsive tree (the component renders both a
// `hidden md:block` desktop tree and a `md:hidden` mobile tree — CSS never
// actually applies in jsdom) — so every query below targets the *first*
// match ([0], the desktop tree) rather than assuming a single element.
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
  }
  if (!('ResizeObserver' in window)) {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // @ts-expect-error jsdom has no ResizeObserver
    window.ResizeObserver = ResizeObserverMock
    global.ResizeObserver = ResizeObserverMock
  }
  if (!Element.prototype.getAnimations) {
    Element.prototype.getAnimations = () => []
  }
})

const syncToUrlMock = vi.fn()
const clearUrlMock = vi.fn()
const refetchTodayCountMock = vi.fn()
let mockInitialFilters: Record<string, unknown> = {}
let mockIsFallback = false
let mockTodayCount = 0
let mockSearchHistoryRecent: SearchHistoryEntry[] = []

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'a@a.com', name: 'Ana', role: 'OWNER' } }),
}))

// "Ingresados hoy" fires a second, independent useSearch call (dateType
// 'created' + limit 1) for its counter — distinguished here from the main
// list query so tests can control each one separately.
vi.mock('@/lib/hooks/useSearch', () => ({
  useSearch: (query: { dateType?: string; limit?: number }) => {
    if (query?.dateType === 'created' && query?.limit === 1) {
      return {
        data: { items: [], total: mockTodayCount },
        isLoading: false,
        error: null,
        isFallback: false,
        refetch: refetchTodayCountMock,
      }
    }
    return {
      data: { items: [], total: 0 },
      isLoading: false,
      error: null,
      get isFallback() {
        return mockIsFallback
      },
      refetch: vi.fn(),
    }
  },
}))

vi.mock('@/lib/hooks/useBatchActions', () => ({
  useBatchActions: () => ({
    selectedIds: [],
    isSelected: () => false,
    toggleSelect: vi.fn(),
    clearSelection: vi.fn(),
    bulkUpdateStatus: vi.fn(),
    bulkUpdatePriority: vi.fn(),
    bulkAssign: vi.fn(),
    isProcessing: false,
    error: null,
  }),
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

vi.mock('@/lib/hooks/useSearchHistory', () => ({
  useSearchHistory: () => ({
    get recent() {
      return mockSearchHistoryRecent
    },
    isReady: true,
    addEntry: vi.fn(),
    removeEntry: vi.fn(),
    clearAll: vi.fn(),
  }),
}))

vi.mock('@/lib/hooks/useSavedFilters', () => ({
  useSavedFilters: () => ({
    filters: [],
    isReady: true,
    saveFilter: vi.fn(),
    renameFilter: vi.fn(),
    deleteFilter: vi.fn(),
    clearAll: vi.fn(),
  }),
}))

vi.mock('@/lib/hooks/useUrlSync', () => ({
  useUrlSync: () => ({
    initialFilters: mockInitialFilters,
    syncToUrl: syncToUrlMock,
    clearUrl: clearUrlMock,
  }),
}))

vi.mock('@/components/finding/NewFindingDialog', () => ({
  NewFindingDialog: () => null,
}))

beforeEach(() => {
  syncToUrlMock.mockClear()
  clearUrlMock.mockClear()
  refetchTodayCountMock.mockClear()
  mockInitialFilters = {}
  mockIsFallback = false
  mockTodayCount = 0
  mockSearchHistoryRecent = []
})

describe('SearchFindings filter bar (FASE 4)', () => {
  it('renders Estado/Prioridad/Proyecto/Asignado/Fecha/Más filtros as top-level triggers', () => {
    render(<SearchFindings presentation="panel" />)

    expect(screen.getAllByRole('button', { name: 'Estado' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Prioridad' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Proyecto' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Asignado' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Fecha' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Más filtros' }).length).toBeGreaterThan(0)
  })

  it('selecting an Estado option syncs the URL immediately with status set', async () => {
    render(<SearchFindings presentation="panel" />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Estado' })[0])
    const open = (await screen.findAllByText('Abierto'))[0]
    fireEvent.click(open)

    expect(syncToUrlMock).toHaveBeenCalledTimes(1)
    const [filters, , status] = syncToUrlMock.mock.calls[0]
    expect(status).toEqual(['OPEN'])
    expect(filters).toEqual({})
  })

  it('Proyecto keeps multiple selections (array), unlike Analytics', async () => {
    render(<SearchFindings presentation="panel" />)

    // The popover stays open across selections (no auto-close on pick), so
    // both options are clicked without re-opening the trigger in between.
    fireEvent.click(screen.getAllByRole('button', { name: /^Proyecto/ })[0])
    const first = (await screen.findAllByText('Pruebas María 2.0'))[0]
    fireEvent.click(first)

    let [filters] = syncToUrlMock.mock.calls[0]
    expect(filters.project).toEqual(['proj-1'])

    const second = (await screen.findAllByText('Pruebas María 1.0'))[0]
    fireEvent.click(second)

    ;[filters] = syncToUrlMock.mock.calls[1]
    expect(filters.project).toEqual(expect.arrayContaining(['proj-1', 'proj-2']))
    expect(filters.project).toHaveLength(2)
  })

  describe('Combinations & search+filter persistence (FASE 6)', () => {
    it('preserves the search term when changing another filter afterward', async () => {
      render(<SearchFindings presentation="panel" />)

      const searchInput = screen.getAllByPlaceholderText('Buscar hallazgos...')[0]
      fireEvent.change(searchInput, { target: { value: 'domicilio' } })

      fireEvent.click(screen.getAllByRole('button', { name: 'Estado' })[0])
      fireEvent.click((await screen.findAllByText('Abierto'))[0])

      const [, searchTerm] = syncToUrlMock.mock.calls.at(-1)!
      expect(searchTerm).toBe('domicilio')
    })

    it('combining Estado + Proyecto + Fecha keeps all three without dropping any', async () => {
      render(<SearchFindings presentation="panel" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Estado' })[0])
      fireEvent.click((await screen.findAllByText('Abierto'))[0])

      fireEvent.click(screen.getAllByRole('button', { name: /^Proyecto/ })[0])
      fireEvent.click((await screen.findAllByText('Pruebas María 2.0'))[0])

      fireEvent.click(screen.getAllByRole('button', { name: 'Fecha' })[0])
      const preset = (await screen.findAllByRole('button', { name: 'Últimos 7 días' }))[0]
      fireEvent.click(preset)

      const [filters, , status] = syncToUrlMock.mock.calls.at(-1)!
      expect(status).toEqual(['OPEN'])
      expect(filters.project).toEqual(['proj-1'])
      expect(filters.dateFrom).toBeTruthy()
      expect(filters.dateTo).toBeTruthy()
    })
  })

  it('reconstructs Estado/Proyecto from the URL on render (reload)', () => {
    mockInitialFilters = { status: ['OPEN'], project: ['proj-1'] }
    render(<SearchFindings presentation="panel" />)

    expect(screen.getAllByRole('button', { name: 'Estado · 1 seleccionados' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Proyecto: Pruebas María 2.0').length).toBeGreaterThan(0)
  })

  it('shows "Fecha · Activa" and a Fecha chip once a range is set, and removing the chip clears it', () => {
    mockInitialFilters = {
      dateFrom: '2026-07-21T06:00:00.000Z',
      dateTo: '2026-08-21T05:59:59.999Z',
    }
    render(<SearchFindings presentation="panel" />)

    expect(screen.getAllByRole('button', { name: 'Fecha · Activa' }).length).toBeGreaterThan(0)
    const removeChip = screen.getAllByRole('button', { name: 'Eliminar filtro Fecha: Activa' })[0]
    fireEvent.click(removeChip)

    const [filters] = syncToUrlMock.mock.calls.at(-1)!
    expect(filters.dateFrom).toBeUndefined()
    expect(filters.dateTo).toBeUndefined()
  })

  describe('"Ingresados hoy" (FASE 6 workflow)', () => {
    it('is inactive by default; toggling it sets dateType=created + today range', async () => {
      render(<SearchFindings presentation="panel" />)

      const toggle = screen.getAllByRole('button', { name: /^Ingresados hoy/ })[0]
      expect(toggle.getAttribute('aria-pressed')).toBe('false')

      fireEvent.click(toggle)

      expect(syncToUrlMock).toHaveBeenCalledTimes(1)
      const [filters] = syncToUrlMock.mock.calls[0]
      expect(filters.dateFrom).toBe(TODAY_FROM)
      expect(filters.dateTo).toBe(TODAY_TO)
      expect(filters.dateType).toBe('created')
    })

    it('a second click deactivates it, clearing dateFrom/dateTo/dateType (not a 1970-style range)', () => {
      mockInitialFilters = { dateFrom: TODAY_FROM, dateTo: TODAY_TO }
      render(<SearchFindings presentation="panel" />)

      const toggle = screen.getAllByRole('button', { name: /^Ingresados hoy/ })[0]
      expect(toggle.getAttribute('aria-pressed')).toBe('true')

      fireEvent.click(toggle)

      const [filters] = syncToUrlMock.mock.calls.at(-1)!
      expect(filters.dateFrom).toBeUndefined()
      expect(filters.dateTo).toBeUndefined()
      expect(filters.dateType).toBeUndefined()
    })

    it('reload with dateFrom/dateTo=today reconstructs it as active', () => {
      mockInitialFilters = { dateFrom: TODAY_FROM, dateTo: TODAY_TO }
      render(<SearchFindings presentation="panel" />)

      const toggle = screen.getAllByRole('button', { name: /^Ingresados hoy/ })[0]
      expect(toggle.getAttribute('aria-pressed')).toBe('true')
    })

    it('does not activate for today\'s range under a different dateType (e.g. "updated")', () => {
      mockInitialFilters = { dateFrom: TODAY_FROM, dateTo: TODAY_TO, dateType: 'updated' }
      render(<SearchFindings presentation="panel" />)

      const toggle = screen.getAllByRole('button', { name: /^Ingresados hoy/ })[0]
      expect(toggle.getAttribute('aria-pressed')).toBe('false')
    })

    it('combines with Estado without dropping it (and vice versa)', async () => {
      render(<SearchFindings presentation="panel" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Estado' })[0])
      fireEvent.click((await screen.findAllByText('Abierto'))[0])

      const toggle = screen.getAllByRole('button', { name: /^Ingresados hoy/ })[0]
      fireEvent.click(toggle)

      const [filters, , status] = syncToUrlMock.mock.calls.at(-1)!
      expect(status).toEqual(['OPEN'])
      expect(filters.dateFrom).toBe(TODAY_FROM)
    })

    it('coexists three-way with Estado + Proyecto (gate section 8): none of the three drops another', async () => {
      render(<SearchFindings presentation="panel" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Estado' })[0])
      fireEvent.click((await screen.findAllByText('Abierto'))[0])

      fireEvent.click(screen.getAllByRole('button', { name: /^Proyecto/ })[0])
      fireEvent.click((await screen.findAllByText('Pruebas María 2.0'))[0])

      const toggle = screen.getAllByRole('button', { name: /^Ingresados hoy/ })[0]
      fireEvent.click(toggle)

      const [filters, , status] = syncToUrlMock.mock.calls.at(-1)!
      expect(status).toEqual(['OPEN'])
      expect(filters.project).toEqual(['proj-1'])
      expect(filters.dateFrom).toBe(TODAY_FROM)
      expect(filters.dateTo).toBe(TODAY_TO)
    })

    it('shows the day-total count only while active, from the independent counter query', () => {
      mockTodayCount = 14
      mockInitialFilters = { dateFrom: TODAY_FROM, dateTo: TODAY_TO }
      render(<SearchFindings presentation="panel" />)

      expect(screen.getAllByRole('button', { name: 'Ingresados hoy · 14' }).length).toBeGreaterThan(0)
    })

    it('does not show a count while inactive, even if the counter query has data', () => {
      mockTodayCount = 14
      render(<SearchFindings presentation="panel" />)

      expect(screen.getAllByRole('button', { name: /^Ingresados hoy$/ }).length).toBeGreaterThan(0)
      expect(screen.queryAllByRole('button', { name: /Ingresados hoy ·/ }).length).toBe(0)
    })
  })

  describe('Quick Date Presets (FASE 5)', () => {
    it('shows the Findings-specific presets inside the Fecha popover, with "Todo el tiempo" active by default', async () => {
      render(<SearchFindings presentation="panel" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Fecha' })[0])

      expect((await screen.findAllByRole('button', { name: 'Últimos 7 días' })).length).toBeGreaterThan(0)
      expect(screen.getAllByRole('button', { name: 'Últimos 30 días' }).length).toBeGreaterThan(0)
      expect(screen.getAllByRole('button', { name: 'Este mes' }).length).toBeGreaterThan(0)
      expect(screen.getAllByRole('button', { name: 'Mes anterior' }).length).toBeGreaterThan(0)

      const allTime = screen.getAllByRole('button', { name: 'Todo el tiempo' })[0]
      expect(allTime.getAttribute('aria-pressed')).toBe('true')
    })

    it('selecting "Últimos 7 días" applies a dateFrom/dateTo range immediately', async () => {
      render(<SearchFindings presentation="panel" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Fecha' })[0])
      const preset = (await screen.findAllByRole('button', { name: 'Últimos 7 días' }))[0]
      fireEvent.click(preset)

      expect(syncToUrlMock).toHaveBeenCalledTimes(1)
      const [filters] = syncToUrlMock.mock.calls[0]
      expect(filters.dateFrom).toBeTruthy()
      expect(filters.dateTo).toBeTruthy()
    })

    it('"Todo el tiempo" clears dateFrom/dateTo instead of using a 1970-style range', async () => {
      mockInitialFilters = {
        dateFrom: '2026-07-21T06:00:00.000Z',
        dateTo: '2026-08-21T05:59:59.999Z',
      }
      render(<SearchFindings presentation="panel" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Fecha · Activa' })[0])
      const allTime = (await screen.findAllByRole('button', { name: 'Todo el tiempo' }))[0]
      fireEvent.click(allTime)

      const [filters] = syncToUrlMock.mock.calls.at(-1)!
      expect(filters.dateFrom).toBeUndefined()
      expect(filters.dateTo).toBeUndefined()
    })

    it('marks no preset as active for a custom range that matches none of them', async () => {
      mockInitialFilters = {
        dateFrom: '2020-01-01T06:00:00.000Z',
        dateTo: '2020-01-03T05:59:59.999Z',
      }
      render(<SearchFindings presentation="panel" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Fecha · Activa' })[0])
      const allTime = (await screen.findAllByRole('button', { name: 'Todo el tiempo' }))[0]
      const sevenDays = screen.getAllByRole('button', { name: 'Últimos 7 días' })[0]

      expect(allTime.getAttribute('aria-pressed')).toBe('false')
      expect(sevenDays.getAttribute('aria-pressed')).toBe('false')
    })
  })

  describe('Empty state distinguishes "no matches" from "empty database" (FASE 6 issue 9)', () => {
    it('shows the filters-aware copy + Limpiar filtros when a filter yields 0 results', async () => {
      mockInitialFilters = { status: ['OPEN'] }
      render(<SearchFindings presentation="panel" />)

      expect((await screen.findAllByText('No encontramos hallazgos con estos filtros.')).length).toBeGreaterThan(0)
      expect(screen.queryAllByText('Sin resultados (base de datos vacía)').length).toBe(0)

      const clearButtons = screen.getAllByRole('button', { name: 'Limpiar filtros' })
      fireEvent.click(clearButtons[0])
      expect(clearUrlMock).toHaveBeenCalled()
    })

    it('shows the empty-database copy only when there is no active query at all', () => {
      render(<SearchFindings presentation="panel" />)

      expect(screen.getAllByText('Sin resultados (base de datos vacía)').length).toBeGreaterThan(0)
      expect(screen.queryAllByText('No encontramos hallazgos con estos filtros.').length).toBe(0)
    })
  })

  describe('Fallback mode does not disable working filters (FASE 6 issue 3)', () => {
    it('Proyecto and Asignado stay enabled when useSearch reports isFallback (ES down)', () => {
      mockIsFallback = true
      render(<SearchFindings presentation="panel" />)

      const proyecto = screen.getAllByRole('button', { name: /^Proyecto/ })[0] as HTMLButtonElement
      const asignado = screen.getAllByRole('button', { name: /^Asignado/ })[0] as HTMLButtonElement

      expect(proyecto.disabled).toBe(false)
      expect(asignado.disabled).toBe(false)
    })
  })

  describe('Popup exclusivity (FASE 6)', () => {
    it('opening Proyecto while Estado is open closes Estado', async () => {
      render(<SearchFindings presentation="panel" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Estado' })[0])
      expect((await screen.findAllByText('Abierto')).length).toBeGreaterThan(0)

      fireEvent.click(screen.getAllByRole('button', { name: /^Proyecto/ })[0])

      expect((await screen.findAllByText('Pruebas María 2.0')).length).toBeGreaterThan(0)
      await waitFor(() => expect(screen.queryAllByText('Abierto').length).toBe(0))
    })

    it('opening Fecha (DateRangePicker, a raw Base UI Root) while Estado is open closes Estado', async () => {
      render(<SearchFindings presentation="panel" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Estado' })[0])
      expect((await screen.findAllByText('Abierto')).length).toBeGreaterThan(0)

      fireEvent.click(screen.getAllByRole('button', { name: 'Fecha' })[0])

      expect((await screen.findAllByText('Rango rápido')).length).toBeGreaterThan(0)
      await waitFor(() => expect(screen.queryAllByText('Abierto').length).toBe(0))
    })

    it('opening Estado while Fecha (DateRangePicker) is open closes Fecha', async () => {
      render(<SearchFindings presentation="panel" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Fecha' })[0])
      expect((await screen.findAllByText('Rango rápido')).length).toBeGreaterThan(0)

      fireEvent.click(screen.getAllByRole('button', { name: 'Estado' })[0])

      expect((await screen.findAllByText('Abierto')).length).toBeGreaterThan(0)
      await waitFor(() => expect(screen.queryAllByText('Rango rápido').length).toBe(0))
    })

    it('opening Estado while Vistas is open closes Vistas (controlled Popover + exclusivity)', async () => {
      render(<SearchFindings presentation="panel" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Vistas' })[0])
      expect((await screen.findAllByText('Guardadas')).length).toBeGreaterThan(0)

      fireEvent.click(screen.getAllByRole('button', { name: 'Estado' })[0])

      expect((await screen.findAllByText('Abierto')).length).toBeGreaterThan(0)
      await waitFor(() => expect(screen.queryAllByText('Guardadas').length).toBe(0))
    })

    it('opening Vistas while Estado is open closes Estado', async () => {
      render(<SearchFindings presentation="panel" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Estado' })[0])
      expect((await screen.findAllByText('Abierto')).length).toBeGreaterThan(0)

      fireEvent.click(screen.getAllByRole('button', { name: 'Vistas' })[0])

      expect((await screen.findAllByText('Guardadas')).length).toBeGreaterThan(0)
      await waitFor(() => expect(screen.queryAllByText('Abierto').length).toBe(0))
    })
  })

  describe('Vistas popover (hotfix: anchored positioning)', () => {
    it('opens showing Recientes/Guardadas content, anchored to a Base UI Positioner (not a manual absolute div)', async () => {
      render(<SearchFindings presentation="panel" />)

      const trigger = screen.getAllByRole('button', { name: 'Vistas' })[0]
      fireEvent.click(trigger)

      expect((await screen.findAllByText('Recientes')).length).toBeGreaterThan(0)
      expect(screen.getAllByText('Guardadas').length).toBeGreaterThan(0)
      // The old bug rendered its own `absolute` div; the fixed version has
      // no such element — content lives inside PopoverContent's Positioner/
      // Popup instead, which this repo's other popover tests already treat
      // as correctly anchored (DateRangePicker, MultiSelectFilter, etc.).
      expect(document.querySelector('.absolute.top-full')).toBeNull()
    })

    it('a second click on the trigger closes it (toggle, not stuck open)', async () => {
      render(<SearchFindings presentation="panel" />)

      const trigger = screen.getAllByRole('button', { name: 'Vistas' })[0]
      fireEvent.click(trigger)
      expect((await screen.findAllByText('Guardadas')).length).toBeGreaterThan(0)

      fireEvent.click(trigger)
      await waitFor(() => expect(screen.queryAllByText('Guardadas').length).toBe(0))
    })

    it('selecting a recent entry closes the popover', async () => {
      mockSearchHistoryRecent = [{ id: '1', q: 'domicilio', filters: {}, timestamp: Date.now() }]
      render(<SearchFindings presentation="panel" />)

      fireEvent.click(screen.getAllByRole('button', { name: 'Vistas' })[0])
      const entry = (await screen.findAllByText('domicilio'))[0]
      fireEvent.click(entry)

      await waitFor(() => expect(screen.queryAllByText('Guardadas').length).toBe(0))
    })
  })

  it('"Limpiar filtros" clears the URL', () => {
    mockInitialFilters = { status: ['OPEN'], priority: ['HIGH'] }
    render(<SearchFindings presentation="panel" />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0])
    expect(clearUrlMock).toHaveBeenCalledTimes(1)
  })

  it('does not render "Limpiar filtros" when nothing is active', () => {
    render(<SearchFindings presentation="panel" />)
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull()
  })

  it('showQuickFilters=false (Analytics usage) hides the whole filter bar', () => {
    render(<SearchFindings presentation="dropdown" showQuickFilters={false} />)
    expect(screen.queryByRole('button', { name: 'Estado' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Fecha' })).toBeNull()
    expect(screen.getAllByPlaceholderText('Buscar hallazgos...').length).toBeGreaterThan(0)
  })
})
