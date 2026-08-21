'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useSearch } from '@/lib/hooks/useSearch'
import { useBatchActions } from '@/lib/hooks/useBatchActions'
import { useLookups } from '@/lib/hooks/useLookups'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'
import { useSavedFilters } from '@/lib/hooks/useSavedFilters'
import { useUrlSync } from '@/lib/hooks/useUrlSync'
import { NewFindingDialog } from '@/components/finding/NewFindingDialog'
import { SearchResultItem } from './SearchResultItem'
import { MoreFiltersPopover } from './MoreFiltersPopover'
import { BatchActionsToolbar } from './BatchActionsToolbar'
import { SearchHistory } from './SearchHistory'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { MultiSelectFilter } from '@/components/filters/MultiSelectFilter'
import { SearchableFilter } from '@/components/filters/SearchableFilter'
import { DateRangePicker, type DateRange } from '@/components/filters/DateRangePicker'
import type { QuickDatePresetOption } from '@/components/filters/QuickDatePresets'
import { ActiveFilterChip, ActiveFilterChipList } from '@/components/filters/ActiveFilterChip'
import { dateStringToUTCRange, isoDateTimeToDateStringInTimezone } from '@/lib/utils/timezone'
import { getUTCRangeForDaysBack, getUTCRangeForThisMonth, getUTCRangeForLastMonth } from '@/lib/utils/date-presets'
import {
  FINDING_STATUS_OPTIONS,
  FINDING_PRIORITY_OPTIONS,
  PRIORITY_LABELS_ES,
  STATUS_LABELS_ES,
  SEVERITY_LABELS_ES,
} from '@/lib/constants/finding-options'
import type { AdvancedFilterValues } from '@/lib/types/search'
import { Search, X, Clock3, Check, Star, Info, Plus, ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { cn } from '@/lib/utils'

const TIMEZONE = 'America/Mexico_City'

// FASE 5: Findings' own Quick Date Presets config — deliberately not the
// same list as Analytics' Hoy/7/30/90 (section 5). The previous
// DatePresetButtons.tsx offered Hoy/Ayer/7 días/30 días; "Hoy" and "Ayer"
// don't carry over here since a single day of findings is rarely useful,
// while "Este mes"/"Mes anterior" match how QA actually reviews findings in
// batches, and "Todo el tiempo" is the new no-filter option (section 6).
const FINDINGS_DATE_PRESETS: QuickDatePresetOption[] = [
  { key: '7d', label: 'Últimos 7 días' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: 'thisMonth', label: 'Este mes' },
  { key: 'lastMonth', label: 'Mes anterior' },
  { key: 'all', label: 'Todo el tiempo' },
]

/** Range for a Findings preset key, or `null` for "Todo el tiempo" (no dateFrom/dateTo). */
function getFindingsPresetRange(key: string): [string, string] | null {
  switch (key) {
    case '7d':
      return getUTCRangeForDaysBack(7, TIMEZONE)
    case '30d':
      return getUTCRangeForDaysBack(30, TIMEZONE)
    case 'thisMonth':
      return getUTCRangeForThisMonth(TIMEZONE)
    case 'lastMonth':
      return getUTCRangeForLastMonth(TIMEZONE)
    default:
      return null
  }
}

const STATUS_FILTER_OPTIONS = FINDING_STATUS_OPTIONS.map((value) => ({
  value,
  label: STATUS_LABELS_ES[value] ?? value,
}))
const PRIORITY_FILTER_OPTIONS = FINDING_PRIORITY_OPTIONS.map((value) => ({
  value,
  label: PRIORITY_LABELS_ES[value] ?? value,
}))

type SearchFindingsProps = {
  presentation?: 'panel' | 'dropdown'
  /**
   * When false, hides the whole Estado/Prioridad/Proyecto/Asignado/Fecha/Más
   * filtros bar and its active-filter chips — used when a host page (e.g.
   * Analytics) renders its own filter bar and only wants the search input +
   * results dropdown from this component. "Recientes" (search history)
   * stays, since it's about text-search history, not these filters.
   * Defaults to true so /findings is unaffected.
   */
  showQuickFilters?: boolean
}

const PAGE_SIZE = 15

function getPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 8) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 'ellipsis', totalPages] as const
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages] as const
}

export function SearchFindings({ presentation = 'panel', showQuickFilters = true }: SearchFindingsProps) {
  const router = useRouter()
  const auth = useAuth()
  const canBatchEdit = Boolean(
    auth?.user?.role && ['OWNER', 'QA_LEAD'].includes(auth.user.role),
  )
  const canCreateFinding = Boolean(
    auth?.user?.role && ['OWNER', 'QA_LEAD', 'DESIGNER', 'DEVELOPER'].includes(auth.user.role),
  )

  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [inventoryTotal, setInventoryTotal] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterValues>({})
  const [vistasOpen, setVistasOpen] = useState(false)
  const [saveFormOpen, setSaveFormOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [isSavingFilter, setIsSavingFilter] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const batchActions = useBatchActions()
  // FASE 6 (section 47): when embedded by AnalyticsFilterBar for its search
  // input only (showQuickFilters=false), assignees/projects are unused here
  // — Proyecto/Asignado/NewFindingDialog are all gated behind showQuickFilters
  // or presentation="panel", neither of which apply in that mode. Without
  // `enabled`, this duplicated AnalyticsFilterBar's own useLookups() call on
  // every /dashboard/analytics load (useLookups has no cache — 2x network
  // calls for data that was never rendered).
  const { assignees, projects, isLoading: lookupsLoading } = useLookups(undefined, undefined, {
    enabled: showQuickFilters,
  })
  const searchHistory = useSearchHistory()
  const savedFilters = useSavedFilters()
  const { initialFilters: urlFilters, syncToUrl, clearUrl } = useUrlSync()

  // FASE 14.1.3: Hydrate from URL on mount AND on URL changes (browser back/forward)
  // This makes React state stay in sync with URL at all times
  useEffect(() => {
    const hasFilters = Boolean(
      urlFilters.q ||
      urlFilters.status?.length ||
      urlFilters.priority?.length ||
      urlFilters.severity?.length ||
      urlFilters.assignee?.length ||
      urlFilters.project?.length ||
      urlFilters.dateType ||
      urlFilters.dateFrom ||
      urlFilters.dateTo ||
      urlFilters.hasEvidence
    )

    if (hasFilters) {
      if (urlFilters.q) setSearchTerm(urlFilters.q)
      if (urlFilters.status?.length) setStatusFilter(urlFilters.status)
      if (urlFilters.priority?.length) setPriorityFilter(urlFilters.priority)
      if (
        urlFilters.severity?.length ||
        urlFilters.assignee?.length ||
        urlFilters.project?.length ||
        urlFilters.dateType ||
        urlFilters.dateFrom ||
        urlFilters.dateTo ||
        urlFilters.hasEvidence
      ) {
        setAdvancedFilters({
          severity: urlFilters.severity,
          assignee: urlFilters.assignee,
          project: urlFilters.project,
          dateType: urlFilters.dateType,
          dateFrom: urlFilters.dateFrom,
          dateTo: urlFilters.dateTo,
          hasEvidence: urlFilters.hasEvidence,
        })
      }
    }
    // FASE 14.1.3: Added urlFilters dependency so hydration runs when URL changes
  }, [urlFilters])

  const searchQuery = useMemo(
    () => ({
      q: searchTerm,
      status: statusFilter.length > 0 ? statusFilter : undefined,
      priority: priorityFilter.length > 0 ? priorityFilter : undefined,
      severity: advancedFilters.severity,
      assignee: advancedFilters.assignee,
      project: advancedFilters.project,
      dateType: advancedFilters.dateType,
      dateFrom: advancedFilters.dateFrom,
      dateTo: advancedFilters.dateTo,
      hasEvidence: advancedFilters.hasEvidence,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      // Always load findings initially (show results by default)
      _forceSearch: true,
    }),
    [
      searchTerm,
      statusFilter,
      priorityFilter,
      advancedFilters.severity,
      advancedFilters.assignee,
      advancedFilters.project,
      advancedFilters.dateType,
      advancedFilters.dateFrom,
      advancedFilters.dateTo,
      advancedFilters.hasEvidence,
      page,
    ],
  )

  const { data, isLoading, error, isFallback, refetch } = useSearch(searchQuery)

  // FASE 6 ("Ingresados hoy"): a standalone daily-workflow counter,
  // independent of the main searchQuery — it must show the day's total
  // regardless of whatever other filters (Estado/Proyecto/...) are also
  // active (explicit UX decision: option A, "total del día", not "total
  // después de demás filtros"). `createdAt` is the field that represents
  // entry into UIX for both manual creation and import (see date-audit in
  // this iteration's report); reuses the same day-boundary helper Analytics'
  // "Hoy" preset already uses, frozen at mount so it doesn't shift mid-session.
  const [todayFrom, todayTo] = useMemo(() => getUTCRangeForDaysBack(0, TIMEZONE), [])
  const todayCountQuery = useMemo(
    () => ({ dateType: 'created' as const, dateFrom: todayFrom, dateTo: todayTo, limit: 1, offset: 0, _forceSearch: true }),
    [todayFrom, todayTo],
  )
  const { data: todayCountData, refetch: refetchTodayCount } = useSearch(todayCountQuery)
  const todayCount = todayCountData?.total ?? 0

  const assigneeLabels = useMemo(
    () => Object.fromEntries(assignees.map((a) => [a.id, a.name])),
    [assignees],
  )
  const projectLabels = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects],
  )

  const activeFilterCount =
    (statusFilter.length || 0) +
    (priorityFilter.length || 0) +
    (advancedFilters.severity?.length || 0) +
    (advancedFilters.assignee?.length || 0) +
    (advancedFilters.project?.length || 0) +
    (advancedFilters.dateType && advancedFilters.dateType !== 'created' ? 1 : 0) +
    (advancedFilters.dateFrom ? 1 : 0) +
    (advancedFilters.dateTo ? 1 : 0) +
    (advancedFilters.hasEvidence !== undefined && advancedFilters.hasEvidence !== 'any' ? 1 : 0)

  const hasActiveQuery = searchTerm.trim().length > 0 || activeFilterCount > 0
  const resultTotal = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(resultTotal / PAGE_SIZE))
  const resultStart = resultTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const resultEnd = Math.min(page * PAGE_SIZE, resultTotal)
  const resultSummary =
    hasActiveQuery && inventoryTotal && inventoryTotal !== resultTotal
      ? `${resultTotal} de ${inventoryTotal} hallazgos coinciden`
      : `${resultTotal} hallazgos`

  useEffect(() => {
    setPage(1)
  }, [
    searchTerm,
    statusFilter,
    priorityFilter,
    advancedFilters.severity,
    advancedFilters.assignee,
    advancedFilters.project,
    advancedFilters.dateFrom,
    advancedFilters.dateTo,
    advancedFilters.hasEvidence,
  ])

  useEffect(() => {
    if (!data || hasActiveQuery) return
    setInventoryTotal(data.total)
  }, [data, hasActiveQuery])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const isMobile = !window.matchMedia('(min-width: 768px)').matches
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen && (searchTerm.length >= 2 || activeFilterCount > 0)) {
      void searchHistory.addEntry({
        q: searchTerm,
        status: statusFilter.length ? statusFilter : undefined,
        priority: priorityFilter.length ? priorityFilter : undefined,
        filters: activeFilterCount > 0 ? advancedFilters : {},
        resultCount: data?.total,
      })
    }
  }, [isOpen])

  const handleSelectRecent = (entry: (typeof searchHistory.recent)[0]) => {
    setSearchTerm(entry.q || '')
    setStatusFilter(entry.status || [])
    setPriorityFilter(entry.priority || [])
    setAdvancedFilters(entry.filters || {})
    setIsOpen(true)
    setVistasOpen(false)
  }

  const handleSelectSaved = (entry: (typeof savedFilters.filters)[0]) => {
    setSearchTerm(entry.q || '')
    setStatusFilter(entry.status || [])
    setPriorityFilter(entry.priority || [])
    setAdvancedFilters(entry.filters || {})
    setIsOpen(true)
    setVistasOpen(false)
  }

  // FASE 4: every filter trigger (Estado/Prioridad/Proyecto/Asignado/Fecha/Más
  // filtros) applies immediately and syncs the URL right away — the URL is
  // the source of truth for every one of them, not only for the ones that
  // used to go through "Aplicar" inside the old AdvancedFilterPanel.
  const applyFilters = (patch: {
    status?: string[]
    priority?: string[]
    advanced?: Partial<AdvancedFilterValues>
  }) => {
    const nextStatus = patch.status ?? statusFilter
    const nextPriority = patch.priority ?? priorityFilter
    const nextAdvanced = patch.advanced ? { ...advancedFilters, ...patch.advanced } : advancedFilters

    if (patch.status) setStatusFilter(patch.status)
    if (patch.priority) setPriorityFilter(patch.priority)
    if (patch.advanced) setAdvancedFilters(nextAdvanced)

    setIsOpen(true)
    syncToUrl(nextAdvanced, searchTerm, nextStatus, nextPriority)
    setPage(1)
  }

  const clearAllFilters = () => {
    setStatusFilter([])
    setPriorityFilter([])
    setAdvancedFilters({})
    clearUrl()
    setPage(1)
  }

  function isoToLocalDate(iso?: string): Date | undefined {
    if (!iso) return undefined
    return new Date(`${isoDateTimeToDateStringInTimezone(iso, TIMEZONE)}T00:00:00`)
  }

  const dateRangeValue: DateRange = {
    from: isoToLocalDate(advancedFilters.dateFrom),
    to: isoToLocalDate(advancedFilters.dateTo),
  }

  const handleDateRangeChange = (range: DateRange) => {
    if (!range.from) {
      applyFilters({ advanced: { dateFrom: undefined, dateTo: undefined } })
      return
    }
    const fromString = format(range.from, 'yyyy-MM-dd')
    const toString = format(range.to ?? range.from, 'yyyy-MM-dd')
    const [startUTC] = dateStringToUTCRange(fromString, TIMEZONE)
    const [, endUTC] = dateStringToUTCRange(toString, TIMEZONE)
    applyFilters({ advanced: { dateFrom: startUTC, dateTo: endUTC } })
  }

  // Section 7: a preset shows selected only when dateFrom/dateTo exactly
  // match its computed range; "Todo el tiempo" matches the no-date-filter
  // state so it reads as selected by default rather than nothing being
  // marked active. A custom range matches none of these, which is correct.
  const activeDatePresetKey = useMemo(() => {
    if (!advancedFilters.dateFrom && !advancedFilters.dateTo) return 'all'
    return FINDINGS_DATE_PRESETS.find((preset) => {
      const range = getFindingsPresetRange(preset.key)
      return range !== null && range[0] === advancedFilters.dateFrom && range[1] === advancedFilters.dateTo
    })?.key
  }, [advancedFilters.dateFrom, advancedFilters.dateTo])

  const handleDatePresetChange = (key: string) => {
    const range = getFindingsPresetRange(key)
    if (!range) {
      // "Todo el tiempo": drop dateFrom/dateTo from the URL, no 1970→hoy hack.
      applyFilters({ advanced: { dateFrom: undefined, dateTo: undefined } })
      return
    }
    const [dateFrom, dateTo] = range
    applyFilters({ advanced: { dateFrom, dateTo } })
  }

  // FASE 6: "Ingresados hoy" reuses the existing dateType/dateFrom/dateTo
  // contract (dateType='created' is already the default, so it's omitted
  // from the URL — same as any other date preset) rather than adding a new
  // param. Active only when dateType is genuinely 'created' (not e.g.
  // 'updated' coinciding numerically with today by chance) AND the range
  // matches today exactly.
  const isIngresadosHoyActive =
    (advancedFilters.dateType ?? 'created') === 'created' &&
    advancedFilters.dateFrom === todayFrom &&
    advancedFilters.dateTo === todayTo

  const handleToggleIngresadosHoy = () => {
    if (isIngresadosHoyActive) {
      applyFilters({ advanced: { dateFrom: undefined, dateTo: undefined, dateType: undefined } })
      return
    }
    applyFilters({ advanced: { dateFrom: todayFrom, dateTo: todayTo, dateType: 'created' } })
  }

  const handleSaveFilter = async () => {
    if (!saveName.trim()) return
    setIsSavingFilter(true)
    try {
      await savedFilters.saveFilter(saveName, {
        q: searchTerm,
        status: statusFilter.length ? statusFilter : undefined,
        priority: priorityFilter.length ? priorityFilter : undefined,
        filters: advancedFilters,
      })
      setSaveFormOpen(false)
      setSaveName('')
    } catch (err) {
      console.error('Failed to save filter:', err)
    } finally {
      setIsSavingFilter(false)
    }
  }

  const hasResults = data && data.items.length > 0
  const isPanel = presentation === 'panel'
  const showResults = isPanel
    ? Boolean(isLoading || hasResults || error || data)
    : isOpen && Boolean(isLoading || hasResults || error || (data && !hasResults))

  const renderResults = () => (
    <>
      {isLoading && (
        <div className="p-8 text-center text-sm text-[#65766e]">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#c7d6cc] border-t-[#00a85a]" />
        </div>
      )}

      {!isLoading && hasResults && (
        <>
          {batchActions.selectedIds.length > 0 && (
            <BatchActionsToolbar
              selectedCount={batchActions.selectedIds.length}
              items={data!.items}
              selectedIds={batchActions.selectedIds}
              onClearSelection={batchActions.clearSelection}
              onBulkStatus={batchActions.bulkUpdateStatus}
              onBulkPriority={batchActions.bulkUpdatePriority}
              onBulkAssign={batchActions.bulkAssign}
              assigneeOptions={assignees}
              isProcessing={batchActions.isProcessing}
              error={batchActions.error}
            />
          )}

          <div className="space-y-2 p-3">
            {data!.items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-[#dbe4dd] transition-all active:bg-[#edf4ed] focus-visible:ring-2 focus-visible:ring-[#00a85a] [@media(hover:hover)]:hover:border-[#0369A1] [@media(hover:hover)]:hover:shadow-md [@media(hover:hover)]:hover:bg-white"
              >
                <SearchResultItem
                  {...item}
                  selected={batchActions.isSelected(item.id)}
                  onToggleSelect={batchActions.toggleSelect}
                  showCheckbox={canBatchEdit}
                />
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t border-[#dbe4dd] bg-[#f7faf5] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#65766e]">
              <p>
                Mostrando{' '}
                <span className="font-semibold text-[#052b20]">
                  {resultStart}-{resultEnd}
                </span>{' '}
                de <span className="font-semibold text-[#052b20]">{resultTotal}</span> hallazgos
              </p>
              <div className="flex items-center gap-3">
                {isFallback && (
                  <span className="inline-flex items-center gap-1 text-[#85540d]">
                    <Info className="h-3.5 w-3.5" />
                    Índice PostgreSQL
                  </span>
                )}
                <span>{PAGE_SIZE} por página</span>
              </div>
            </div>

            {totalPages > 1 && (
              <nav
                className="flex flex-wrap items-center justify-center gap-1.5"
                aria-label="Paginación de hallazgos"
              >
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1 || isLoading}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dbe4dd] bg-white px-3 text-xs font-semibold text-[#17251f] transition hover:border-[#052b20] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>

                {getPaginationItems(page, totalPages).map((item, index) =>
                  item === 'ellipsis' ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="flex h-9 min-w-9 items-center justify-center text-xs font-semibold text-[#65766e]"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      disabled={isLoading}
                      aria-current={page === item ? 'page' : undefined}
                      className={cn(
                        'flex h-9 min-w-9 items-center justify-center rounded-lg border border-[#dbe4dd] bg-white px-2 text-xs font-semibold text-[#17251f] transition hover:border-[#052b20]',
                        page === item && 'border-[#052b20] bg-[#052b20] text-white hover:border-[#052b20]',
                      )}
                    >
                      {item}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages || isLoading}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dbe4dd] bg-white px-3 text-xs font-semibold text-[#17251f] transition hover:border-[#052b20] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Siguiente
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </nav>
            )}
          </div>
        </>
      )}

      {!isLoading && !hasResults && !error && (
        <div className="p-8 text-center text-sm text-[#65766e]">
          {/*
            FASE 6 (issue 9): this used to branch on `searchTerm` alone, so
            filters-only zero-result states (0 de 234 hallazgos) still showed
            "Sin resultados (base de datos vacía)" — technically wrong, the DB
            isn't empty. `hasActiveQuery` already accounts for both search
            text and filters (line ~244), so it's the correct signal here.
          */}
          {hasActiveQuery ? (
            <div className="flex flex-col items-center gap-3">
              <p>No encontramos hallazgos con estos filtros.</p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-md border border-[#dbe4dd] bg-white px-3 py-1.5 text-sm font-medium text-[#17251f] outline-none transition hover:bg-[#f7faf5] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            'Sin resultados (base de datos vacía)'
          )}
        </div>
      )}

      {error && (
        <div className="p-6 text-center text-sm text-[#9b321f]">
          {error}
          {isFallback && <div className="mt-1 text-[#65766e]">Usando búsqueda de base de datos</div>}
        </div>
      )}
    </>
  )

  // FASE 4: single source of JSX for the filter row — used by both the
  // desktop and mobile-panel trees below, instead of two parallel
  // implementations (section 37: "no quiero desktop filters + mobile
  // filters con dos lógicas distintas").
  const renderFilterBar = () => (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {/*
        FASE 6: replaces the ambiguous "Recientes" quick-access slot —
        that name now means search/filter history ("Vistas", below).
        Reuses dateType='created' + dateFrom/dateTo=today, the exact same
        contract every other date preset already uses (no new URL param).
        A plain toggle button, not a popover — there's no picker content,
        just on/off, so it doesn't follow the FilterTrigger+Popover shape.
        Icon swaps (clock → check) alongside color/border/count so the
        active state isn't communicated by color alone (section 33).
      */}
      <button
        type="button"
        aria-pressed={isIngresadosHoyActive}
        onClick={handleToggleIngresadosHoy}
        className={cn(
          'inline-flex h-10 min-h-10 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors',
          'hover:bg-muted',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          isIngresadosHoyActive && 'border-primary/50 bg-primary/5 font-semibold text-primary hover:bg-primary/10',
        )}
      >
        {isIngresadosHoyActive ? <Check className="size-3.5" aria-hidden /> : <Clock3 className="size-3.5" aria-hidden />}
        <span>Ingresados hoy{isIngresadosHoyActive ? ` · ${todayCount}` : ''}</span>
      </button>
      <MultiSelectFilter
        label="Estado"
        options={STATUS_FILTER_OPTIONS}
        value={statusFilter}
        onChange={(next) => applyFilters({ status: next })}
      />
      <MultiSelectFilter
        label="Prioridad"
        options={PRIORITY_FILTER_OPTIONS}
        value={priorityFilter}
        onChange={(next) => applyFilters({ priority: next })}
      />
      {/*
        FASE 6 (issue 3): Proyecto/Asignado used to pass `disabled={isFallback}`,
        making them look disabled whenever ES is down — which, in this
        environment, is effectively always. But useSearch's Postgres fallback
        (lib/hooks/useSearch.ts) does forward project/assignee to the fallback
        API (first selected value), unlike hasEvidence, which really has no
        equivalent there (disableEvidence below stays). Disabling controls
        that still work isn't correct, so the flag was removed here.
      */}
      <SearchableFilter
        label="Proyecto"
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
        value={advancedFilters.project ?? []}
        onChange={(next) => applyFilters({ advanced: { project: next } })}
        searchPlaceholder="Buscar proyecto..."
        emptyLabel="No encontramos proyectos."
        loading={lookupsLoading}
      />
      <SearchableFilter
        label="Asignado"
        options={assignees.map((a) => ({ value: a.id, label: a.name }))}
        value={advancedFilters.assignee ?? []}
        onChange={(next) => applyFilters({ advanced: { assignee: next } })}
        searchPlaceholder="Buscar responsable..."
        emptyLabel="No encontramos personas asignadas."
        loading={lookupsLoading}
      />
      <DateRangePicker
        variant="button"
        triggerLabel="Fecha"
        value={dateRangeValue}
        onChange={handleDateRangeChange}
        presets={FINDINGS_DATE_PRESETS}
        presetValue={activeDatePresetKey}
        onPresetChange={handleDatePresetChange}
      />
      <MoreFiltersPopover
        value={{
          dateType: advancedFilters.dateType,
          severity: advancedFilters.severity,
          hasEvidence: advancedFilters.hasEvidence,
        }}
        onChange={(patch) => applyFilters({ advanced: patch })}
        disableEvidence={isFallback}
      />
    </div>
  )

  const renderActiveFilters = () => (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <ActiveFilterChipList onClearAll={activeFilterCount > 0 ? clearAllFilters : undefined}>
        {statusFilter.map((status) => (
          <ActiveFilterChip
            key={`status-${status}`}
            label="Estado"
            value={STATUS_LABELS_ES[status] ?? status}
            onRemove={() => applyFilters({ status: statusFilter.filter((s) => s !== status) })}
          />
        ))}
        {priorityFilter.map((priority) => (
          <ActiveFilterChip
            key={`priority-${priority}`}
            label="Prioridad"
            value={PRIORITY_LABELS_ES[priority] ?? priority}
            onRemove={() => applyFilters({ priority: priorityFilter.filter((p) => p !== priority) })}
          />
        ))}
        {(advancedFilters.project ?? []).map((id) => (
          <ActiveFilterChip
            key={`project-${id}`}
            label="Proyecto"
            value={projectLabels[id] ?? id}
            onRemove={() =>
              applyFilters({ advanced: { project: (advancedFilters.project ?? []).filter((p) => p !== id) } })
            }
          />
        ))}
        {(advancedFilters.assignee ?? []).map((id) => (
          <ActiveFilterChip
            key={`assignee-${id}`}
            label="Asignado"
            value={assigneeLabels[id] ?? id}
            onRemove={() =>
              applyFilters({ advanced: { assignee: (advancedFilters.assignee ?? []).filter((a) => a !== id) } })
            }
          />
        ))}
        {(advancedFilters.dateFrom || advancedFilters.dateTo) && (
          <ActiveFilterChip
            label="Fecha"
            value="Activa"
            onRemove={() => applyFilters({ advanced: { dateFrom: undefined, dateTo: undefined } })}
          />
        )}
        {(advancedFilters.severity ?? []).map((sev) => (
          <ActiveFilterChip
            key={`severity-${sev}`}
            label="Severidad"
            value={SEVERITY_LABELS_ES[sev] ?? sev}
            onRemove={() =>
              applyFilters({ advanced: { severity: (advancedFilters.severity ?? []).filter((s) => s !== sev) } })
            }
          />
        ))}
        {advancedFilters.hasEvidence && advancedFilters.hasEvidence !== 'any' && (
          <ActiveFilterChip
            label="Evidencia"
            value={advancedFilters.hasEvidence === 'with' ? 'Con evidencia' : 'Sin evidencia'}
            onRemove={() => applyFilters({ advanced: { hasEvidence: undefined } })}
          />
        )}
      </ActiveFilterChipList>

      {hasActiveQuery && !saveFormOpen && (
        <button
          type="button"
          onClick={() => setSaveFormOpen(true)}
          className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Save className="size-3" aria-hidden />
          Guardar
        </button>
      )}

      {saveFormOpen && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSaveFilter()
          }}
        >
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Nombre del filtro"
            autoFocus
            className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <button
            type="submit"
            disabled={!saveName.trim() || isSavingFilter}
            className="h-7 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {isSavingFilter ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSaveFormOpen(false)
              setSaveName('')
            }}
            className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Cancelar
          </button>
        </form>
      )}
    </div>
  )

  return (
    <div ref={containerRef} className={cn('relative w-full', isPanel ? 'max-w-none' : 'max-w-2xl')}>
      {isPanel && (
        <div className="mb-5 flex flex-col gap-3 border-b border-[#dbe4dd] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#17251f]">Hallazgos y evidencia</h2>
            <p className="mt-1 text-sm text-[#65766e]">{resultSummary}</p>
          </div>
          {canCreateFinding && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#052b20] px-4 text-sm font-semibold text-white transition hover:bg-[#0b3e30] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
            >
              <Plus className="h-4 w-4" />
              Nuevo hallazgo
            </button>
          )}
        </div>
      )}

      {/* Desktop version */}
      <div className="hidden md:block">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65766e]" />
          <input
            type="text"
            placeholder="Buscar hallazgos..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            className="pm-input h-12 w-full pl-11 pr-12 text-sm placeholder:text-[#7d9087] focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('')
                setStatusFilter([])
                setPriorityFilter([])
                setAdvancedFilters({})
                setIsOpen(false)
                // FASE 14.1.2: Clear URL when clearing all filters
                clearUrl()
                setPage(1)
              }}
              className="absolute right-2 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-[#65766e] transition-colors [@media(hover:hover)]:hover:text-[#052b20]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter bar */}
        {showQuickFilters && renderFilterBar()}

        <div className={cn('flex flex-wrap items-center gap-2', !showQuickFilters && 'mt-4')}>
          {/*
            FASE 6 ("Ingresados hoy" + "Vistas"): renamed from "Recientes" —
            that label was ambiguous (search history here vs. Analytics'
            own temporal concept). This opens Recientes + Guardadas, both
            search/filter history, not a date filter — "Vistas" names that
            correctly. Positioned here, secondary to the filter bar and
            "Nuevo hallazgo", per section 22.

            Hotfix: hosted inside the shared Popover/PopoverTrigger/
            PopoverContent (components/ui/popover.tsx) instead of a
            hand-rolled `absolute top-full` div — that div anchored to this
            component's top-level `relative` wrapper (which spans the whole
            panel, results included), not the trigger, so it opened near the
            bottom of the page. This primitive also fixed the blue: default/
            hover/open below reuse the same brand tokens as every other
            trigger (#dbe4dd/#00a85a/#052b20/#edf4ed), not `.pm-chip`'s
            `:hover`/`.pm-chip-active` rules, which are hardcoded to #0369A1
            (sky blue) — kept for other pm-chip consumers elsewhere, not
            changed globally to stay in scope.
          */}
          <Popover open={vistasOpen} onOpenChange={setVistasOpen}>
            <PopoverTrigger
              className={cn(
                'inline-flex h-9 items-center gap-1 rounded-full border px-4 text-xs font-semibold outline-none transition-colors',
                'border-[#dbe4dd] bg-white text-[#17251f]',
                'hover:border-[#00a85a] hover:bg-[#edf4ed] hover:text-[#052b20]',
                'focus-visible:ring-2 focus-visible:ring-[#00a85a]',
                'data-[popup-open]:border-[#00a85a] data-[popup-open]:bg-[#edf4ed] data-[popup-open]:text-[#052b20]',
              )}
            >
              <Star className="h-3.5 w-3.5" />
              Vistas
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" width="min(24rem, 92vw)" className="p-0">
              <SearchHistory
                onClose={() => setVistasOpen(false)}
                recent={searchHistory.recent}
                saved={savedFilters.filters}
                onSelectRecent={handleSelectRecent}
                onSelectSaved={handleSelectSaved}
                onRemoveRecent={searchHistory.removeEntry}
                onRemoveSaved={savedFilters.deleteFilter}
                onRenameSaved={savedFilters.renameFilter}
                onClearRecentAll={searchHistory.clearAll}
                isLoading={!searchHistory.isReady}
                projectLabels={projectLabels}
                assigneeLabels={assigneeLabels}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Active filters + Guardar */}
        {showQuickFilters && renderActiveFilters()}

        {/* Dropdown results */}
        {showResults && (
          <div
            className={cn(
              'pm-card z-40 overflow-hidden',
              isPanel
                ? 'mt-5'
                : 'absolute left-0 right-0 top-full mt-2 max-h-96 overflow-y-auto',
            )}
          >
            {renderResults()}
          </div>
        )}
      </div>

      {/* Mobile version */}
      <div className="md:hidden">
        {/* Search input trigger */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65766e]" />
          <input
            type="text"
            placeholder="Buscar hallazgos..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              if (!isPanel) setIsOpen(true)
            }}
            onFocus={() => {
              if (!isPanel) setIsOpen(true)
            }}
            readOnly={!isPanel}
            className="pm-input w-full cursor-pointer py-3 pl-10 pr-10 text-base placeholder:text-[#7d9087] focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('')
                setIsOpen(false)
                setStatusFilter([])
                setPriorityFilter([])
                setAdvancedFilters({})
              }}
              className="absolute right-3 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-[#65766e]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isPanel && (
          <>
            {showQuickFilters && renderFilterBar()}
            {showQuickFilters && renderActiveFilters()}

            {showResults && (
              <div className="pm-card mt-4 overflow-hidden">
                {renderResults()}
              </div>
            )}
          </>
        )}

        {/* Modal overlay & bottom sheet */}
        {!isPanel && isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setIsOpen(false)}
            />

            {/* Bottom sheet panel */}
            <div className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85vh] flex-col overflow-y-auto rounded-t-lg bg-white">
              {/* Header */}
              <div className="sticky top-0 flex items-center justify-between rounded-t-lg border-b border-[#dbe4dd] bg-white px-4 py-3">
                <h2 className="text-lg font-semibold text-[#17251f]">Búsqueda avanzada</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Cerrar búsqueda"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-[#65766e] active:bg-[#edf4ed]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter bar (same renderFilterBar/renderActiveFilters as desktop/panel) */}
              {showQuickFilters && (
                <div className="border-b border-[#dbe4dd] px-4 py-2">
                  {renderFilterBar()}
                  {renderActiveFilters()}
                </div>
              )}

              {/* Results */}
              {showResults && (
                <div className="flex-1 overflow-y-auto">
                  <div className="border-t border-[#dbe4dd] p-3">{renderResults()}</div>
                </div>
              )}

              {/* Footer actions */}
              <div className="sticky bottom-0 flex gap-2 border-t border-[#dbe4dd] bg-white px-4 py-3">
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter([])
                    setPriorityFilter([])
                    setAdvancedFilters({})
                    setIsOpen(false)
                    // FASE 14.1.3: Clear URL when clearing filters
                    clearUrl()
                  }}
                  className="min-h-[44px] flex-1 rounded-lg bg-[#edf4ed] px-3 py-2.5 font-medium text-[#17251f] transition-colors active:bg-[#dbe4dd] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
                >
                  Limpiar
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="min-h-[44px] flex-1 rounded-lg bg-[#052b20] px-3 py-2.5 font-medium text-white transition-colors active:bg-[#0b3e30] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <NewFindingDialog
        open={createOpen}
        projects={projects}
        assignees={assignees}
        onClose={() => setCreateOpen(false)}
        onCreated={(finding) => {
          setCreateOpen(false)
          setPage(1)
          void refetch()
          // FASE 6 (section 15): the "Ingresados hoy" counter is a separate
          // query (see todayCountQuery above), so it needs its own refetch —
          // the main list's refetch() above doesn't touch it.
          void refetchTodayCount()
          router.push(`/findings/${finding.id}`)
        }}
      />
    </div>
  )
}
