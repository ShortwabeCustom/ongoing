'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useSearch } from '@/lib/hooks/useSearch'
import { useBatchActions } from '@/lib/hooks/useBatchActions'
import { useLookups } from '@/lib/hooks/useLookups'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'
import { useSavedFilters } from '@/lib/hooks/useSavedFilters'
import { NewFindingDialog } from '@/components/finding/NewFindingDialog'
import { SearchResultItem } from './SearchResultItem'
import { AdvancedFilterPanel } from './AdvancedFilterPanel'
import { BatchActionsToolbar } from './BatchActionsToolbar'
import { FilterPreview } from './FilterPreview'
import { SearchHistory } from './SearchHistory'
import {
  FINDING_STATUS_OPTIONS,
  FINDING_PRIORITY_OPTIONS,
  PRIORITY_LABELS_ES,
  STATUS_LABELS_ES,
  STATUS_COLORS,
  PRIORITY_COLORS,
} from '@/lib/constants/finding-options'
import type { AdvancedFilterValues } from '@/lib/types/search'
import { Search, X, ChevronDown, Filter, Clock3, Info, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type SearchFindingsProps = {
  presentation?: 'panel' | 'dropdown'
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

export function SearchFindings({ presentation = 'panel' }: SearchFindingsProps) {
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
  const [openFilterSection, setOpenFilterSection] = useState<'status' | 'priority' | null>(null)
  const [advancedPanelOpen, setAdvancedPanelOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const batchActions = useBatchActions()
  const { assignees, projects, isLoading: lookupsLoading, error: lookupsError } = useLookups()
  const searchHistory = useSearchHistory()
  const savedFilters = useSavedFilters()

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
        setAdvancedPanelOpen(false)
        setHistoryOpen(false)
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
    setHistoryOpen(false)
  }

  const handleSelectSaved = (entry: (typeof savedFilters.filters)[0]) => {
    setSearchTerm(entry.q || '')
    setStatusFilter(entry.status || [])
    setPriorityFilter(entry.priority || [])
    setAdvancedFilters(entry.filters || {})
    setIsOpen(true)
    setHistoryOpen(false)
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
          {searchTerm ? 'No se encontraron resultados' : 'Sin resultados (base de datos vacía)'}
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
              }}
              className="absolute right-2 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-[#65766e] transition-colors [@media(hover:hover)]:hover:text-[#052b20]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick filters + Advanced button */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
            {/* Status filter pills */}
            <div className="flex gap-1.5 items-center">
              <span className="text-xs font-semibold text-[#65766e] uppercase tracking-wide">Estado:</span>
              {FINDING_STATUS_OPTIONS.slice(0, 4).map((status) => {
                const isActive = statusFilter.includes(status)
                const colors = STATUS_COLORS[status] || 'bg-slate-100 text-slate-700 border-slate-300'
                return (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter((prev) =>
                        prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
                      )
                      setIsOpen(true)
                    }}
                    className={cn(
                      'pm-chip text-xs transition-all',
                      isActive ? colors : 'border-[#dbe4dd] bg-white text-[#17251f] hover:border-[#0369A1] hover:bg-[#f0f9ff]'
                    )}
                  >
                    {STATUS_LABELS_ES[status] ?? status}
                  </button>
                )
              })}
            </div>

            {/* Priority filter pills */}
            <div className="flex gap-1.5 items-center">
              <span className="text-xs font-semibold text-[#65766e] uppercase tracking-wide">Prioridad:</span>
              {FINDING_PRIORITY_OPTIONS.map((priority) => {
                const isActive = priorityFilter.includes(priority)
                const colors = PRIORITY_COLORS[priority] || 'bg-slate-100 text-slate-700 border-slate-300'
                return (
                  <button
                    key={priority}
                    onClick={() => {
                      setPriorityFilter((prev) =>
                        prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority],
                      )
                      setIsOpen(true)
                    }}
                    className={cn(
                      'pm-chip text-xs transition-all',
                      isActive ? colors : 'border-[#dbe4dd] bg-white text-[#17251f] hover:border-[#0369A1] hover:bg-[#f0f9ff]'
                    )}
                  >
                    {PRIORITY_LABELS_ES[priority] ?? priority}
                  </button>
                )
              })}
            </div>

            {/* Advanced filters button */}
            <button
              onClick={() => {
                setAdvancedPanelOpen(!advancedPanelOpen)
                setHistoryOpen(false)
              }}
              className={cn(
                'pm-chip inline-flex items-center gap-1 text-xs transition-all focus-visible:ring-2 focus-visible:ring-[#00a85a]',
                advancedPanelOpen || activeFilterCount > 0
                  ? 'border-[#0369A1] bg-[#0369A1] text-white'
                  : 'border-[#dbe4dd] bg-white text-[#17251f]'
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtros
              {activeFilterCount > 0 && <span className="ml-1 font-bold text-[#7bf0b1]">+{activeFilterCount}</span>}
            </button>

            {/* Search history button */}
            <button
              onClick={() => {
                setHistoryOpen(!historyOpen)
                setAdvancedPanelOpen(false)
              }}
              className={cn(
                'pm-chip inline-flex items-center gap-1 text-xs transition-all focus-visible:ring-2 focus-visible:ring-[#00a85a]',
                historyOpen
                  ? 'border-[#0369A1] bg-[#0369A1] text-white'
                  : 'border-[#dbe4dd] bg-white text-[#17251f]'
              )}
            >
              <Clock3 className="h-3.5 w-3.5" />
              Recientes
            </button>
        </div>

        {/* Filter preview */}
        {activeFilterCount > 0 && (
          <div className="mt-3">
            <FilterPreview
              filters={{
                status: statusFilter,
                priority: priorityFilter,
                severity: advancedFilters.severity,
                assignee: advancedFilters.assignee,
                project: advancedFilters.project,
                dateType: advancedFilters.dateType,
                dateFrom: advancedFilters.dateFrom,
                dateTo: advancedFilters.dateTo,
                hasEvidence: advancedFilters.hasEvidence,
              }}
              assigneeLabels={assigneeLabels}
              projectLabels={projectLabels}
              onRemoveStatus={(status) =>
                setStatusFilter((prev) => prev.filter((s) => s !== status))
              }
              onRemovePriority={(priority) =>
                setPriorityFilter((prev) => prev.filter((p) => p !== priority))
              }
              onRemoveSeverity={(sev) =>
                setAdvancedFilters((prev) => ({
                  ...prev,
                  severity: prev.severity?.filter((s) => s !== sev),
                }))
              }
              onRemoveAssignee={(id) =>
                setAdvancedFilters((prev) => ({
                  ...prev,
                  assignee: prev.assignee?.filter((a) => a !== id),
                }))
              }
              onRemoveProject={(id) =>
                setAdvancedFilters((prev) => ({
                  ...prev,
                  project: prev.project?.filter((p) => p !== id),
                }))
              }
              onRemoveDateRange={() =>
                setAdvancedFilters((prev) => ({
                  ...prev,
                  dateType: 'created',
                  dateFrom: undefined,
                  dateTo: undefined,
                  datePreset: undefined,
                }))
              }
              onRemoveEvidence={() =>
                setAdvancedFilters((prev) => ({
                  ...prev,
                  hasEvidence: undefined,
                }))
              }
              onClearAll={() => {
                setStatusFilter([])
                setPriorityFilter([])
                setAdvancedFilters({})
              }}
            />
          </div>
        )}

        {/* Advanced filter panel (dropdown) */}
        <div className="relative">
          <AdvancedFilterPanel
            open={advancedPanelOpen}
            onClose={() => setAdvancedPanelOpen(false)}
            value={advancedFilters}
            onApply={(filters) => {
              setAdvancedFilters(filters)
              setAdvancedPanelOpen(false)
              setIsOpen(true)
            }}
            onSaveAsNamedFilter={async (name, filters) => {
              await savedFilters.saveFilter(name, {
                q: searchTerm,
                status: statusFilter.length ? statusFilter : undefined,
                priority: priorityFilter.length ? priorityFilter : undefined,
                filters,
              })
            }}
            assigneeOptions={assignees}
            projectOptions={projects}
            lookupsLoading={lookupsLoading}
            lookupsError={lookupsError}
            disableExtendedFilters={isFallback}
            activeCount={activeFilterCount}
          />
        </div>

        {/* Search history dropdown */}
        {historyOpen && (
          <SearchHistory
            open={historyOpen}
            onClose={() => setHistoryOpen(false)}
            recent={searchHistory.recent}
            saved={savedFilters.filters}
            onSelectRecent={handleSelectRecent}
            onSelectSaved={handleSelectSaved}
            onRemoveRecent={searchHistory.removeEntry}
            onRemoveSaved={savedFilters.deleteFilter}
            onRenameSaved={savedFilters.renameFilter}
            onClearRecentAll={searchHistory.clearAll}
            isLoading={!searchHistory.isReady}
          />
        )}

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
            <div className="mt-3 flex flex-wrap gap-2">
              {FINDING_STATUS_OPTIONS.slice(0, 3).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
                    )
                  }}
                  className={cn(
                    'pm-chip px-3 text-xs font-semibold',
                    statusFilter.includes(status) && 'pm-chip-active',
                  )}
                >
                  {STATUS_LABELS_ES[status] ?? status}
                </button>
              ))}
              {FINDING_PRIORITY_OPTIONS.map((priority) => (
                <button
                  key={priority}
                  onClick={() => {
                    setPriorityFilter((prev) =>
                      prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority],
                    )
                  }}
                  className={cn(
                    'pm-chip px-3 text-xs font-semibold',
                    priorityFilter.includes(priority) && 'pm-chip-active',
                  )}
                >
                  {PRIORITY_LABELS_ES[priority] ?? priority}
                </button>
              ))}
            </div>

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
              onClick={() => {
                setIsOpen(false)
                setOpenFilterSection(null)
                setAdvancedPanelOpen(false)
              }}
            />

            {/* Bottom sheet panel */}
            <div className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85vh] flex-col overflow-y-auto rounded-t-lg bg-white">
              {/* Header */}
              <div className="sticky top-0 flex items-center justify-between rounded-t-lg border-b border-[#dbe4dd] bg-white px-4 py-3">
                <h2 className="text-lg font-semibold text-[#17251f]">Búsqueda avanzada</h2>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setOpenFilterSection(null)
                    setAdvancedPanelOpen(false)
                  }}
                  aria-label="Cerrar búsqueda"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-[#65766e] active:bg-[#edf4ed]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter preview (mobile) */}
              {activeFilterCount > 0 && (
                <div className="border-b border-[#dbe4dd] px-4 py-2">
                  <FilterPreview
                    filters={{
                      status: statusFilter,
                      priority: priorityFilter,
                      severity: advancedFilters.severity,
                      assignee: advancedFilters.assignee,
                      project: advancedFilters.project,
                      dateType: advancedFilters.dateType,
                      dateFrom: advancedFilters.dateFrom,
                      dateTo: advancedFilters.dateTo,
                      hasEvidence: advancedFilters.hasEvidence,
                    }}
                    assigneeLabels={assigneeLabels}
                    projectLabels={projectLabels}
                    onRemoveStatus={(status) =>
                      setStatusFilter((prev) => prev.filter((s) => s !== status))
                    }
                    onRemovePriority={(priority) =>
                      setPriorityFilter((prev) => prev.filter((p) => p !== priority))
                    }
                    onRemoveSeverity={(sev) =>
                      setAdvancedFilters((prev) => ({
                        ...prev,
                        severity: prev.severity?.filter((s) => s !== sev),
                      }))
                    }
                    onRemoveAssignee={(id) =>
                      setAdvancedFilters((prev) => ({
                        ...prev,
                        assignee: prev.assignee?.filter((a) => a !== id),
                      }))
                    }
                    onRemoveProject={(id) =>
                      setAdvancedFilters((prev) => ({
                        ...prev,
                        project: prev.project?.filter((p) => p !== id),
                      }))
                    }
                    onRemoveDateRange={() =>
                      setAdvancedFilters((prev) => ({
                        ...prev,
                        dateType: 'created',
                        dateFrom: undefined,
                        dateTo: undefined,
                        datePreset: undefined,
                      }))
                    }
                    onRemoveEvidence={() =>
                      setAdvancedFilters((prev) => ({
                        ...prev,
                        hasEvidence: undefined,
                      }))
                    }
                    onClearAll={() => {
                      setStatusFilter([])
                      setPriorityFilter([])
                      setAdvancedFilters({})
                    }}
                  />
                </div>
              )}

              {/* Filters accordion */}
              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {/* Status filter */}
                <div className="border-b border-[#dbe4dd]">
                  <button
                    onClick={() => setOpenFilterSection(openFilterSection === 'status' ? null : 'status')}
                    aria-expanded={openFilterSection === 'status'}
                    aria-controls="status-content"
                    className="flex min-h-[44px] w-full items-center justify-between rounded px-3 py-3 text-left active:bg-[#edf4ed] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
                  >
                    <span className="font-medium text-[#17251f]">Estado</span>
                    <ChevronDown
                      className={`h-5 w-5 text-[#65766e] transition-transform ${
                        openFilterSection === 'status' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openFilterSection === 'status' && (
                    <div id="status-content" className="space-y-2 bg-[#f7faf5] px-3 py-3">
                      {FINDING_STATUS_OPTIONS.map((status) => (
                        <label
                          key={status}
                          className="flex min-h-[44px] cursor-pointer items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={statusFilter.includes(status)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setStatusFilter((prev) => [...prev, status])
                              } else {
                                setStatusFilter((prev) => prev.filter((s) => s !== status))
                              }
                            }}
                            className="h-4 w-4 cursor-pointer rounded border-[#b9c8c0] text-[#00a85a] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
                          />
                          <span className="text-sm text-[#3d4d45]">{STATUS_LABELS_ES[status] ?? status}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Priority filter */}
                <div className="border-b border-[#dbe4dd]">
                  <button
                    onClick={() => setOpenFilterSection(openFilterSection === 'priority' ? null : 'priority')}
                    aria-expanded={openFilterSection === 'priority'}
                    aria-controls="priority-content"
                    className="flex min-h-[44px] w-full items-center justify-between rounded px-3 py-3 text-left active:bg-[#edf4ed] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
                  >
                    <span className="font-medium text-[#17251f]">Prioridad</span>
                    <ChevronDown
                      className={`h-5 w-5 text-[#65766e] transition-transform ${
                        openFilterSection === 'priority' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openFilterSection === 'priority' && (
                    <div id="priority-content" className="space-y-2 bg-[#f7faf5] px-3 py-3">
                      {FINDING_PRIORITY_OPTIONS.map((priority) => (
                        <label
                          key={priority}
                          className="flex min-h-[44px] cursor-pointer items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={priorityFilter.includes(priority)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPriorityFilter((prev) => [...prev, priority])
                              } else {
                                setPriorityFilter((prev) => prev.filter((p) => p !== priority))
                              }
                            }}
                            className="h-4 w-4 cursor-pointer rounded border-[#b9c8c0] text-[#00a85a] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
                          />
                          <span className="text-sm text-[#3d4d45]">{PRIORITY_LABELS_ES[priority] ?? priority}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Advanced filters button (mobile) */}
                <div className="border-b border-[#dbe4dd]">
                  <button
                    onClick={() => setAdvancedPanelOpen(!advancedPanelOpen)}
                    aria-expanded={advancedPanelOpen}
                    aria-controls="advanced-content"
                    className="flex min-h-[44px] w-full items-center justify-between rounded px-3 py-3 text-left active:bg-[#edf4ed] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
                  >
                    <span className="flex items-center gap-2 font-medium text-[#17251f]">
                      <Filter className="h-4 w-4" />
                      Filtros avanzados
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 text-[#65766e] transition-transform ${
                        advancedPanelOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {advancedPanelOpen && (
                    <div id="advanced-content" className="bg-[#f7faf5] px-3 py-3">
                      <AdvancedFilterPanel
                        open={true}
                        onClose={() => setAdvancedPanelOpen(false)}
                        value={advancedFilters}
                        onApply={(filters) => {
                          setAdvancedFilters(filters)
                          setAdvancedPanelOpen(false)
                        }}
                        onSaveAsNamedFilter={async (name, filters) => {
                          await savedFilters.saveFilter(name, {
                            q: searchTerm,
                            status: statusFilter.length ? statusFilter : undefined,
                            priority: priorityFilter.length ? priorityFilter : undefined,
                            filters,
                          })
                        }}
                        assigneeOptions={assignees}
                        projectOptions={projects}
                        lookupsLoading={lookupsLoading}
                        lookupsError={lookupsError}
                        disableExtendedFilters={isFallback}
                        activeCount={activeFilterCount}
                      />
                    </div>
                  )}
                </div>
              </div>

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
                    setOpenFilterSection(null)
                    setAdvancedPanelOpen(false)
                    setIsOpen(false)
                  }}
                  className="min-h-[44px] flex-1 rounded-lg bg-[#edf4ed] px-3 py-2.5 font-medium text-[#17251f] transition-colors active:bg-[#dbe4dd] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
                >
                  Limpiar
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setOpenFilterSection(null)
                    setAdvancedPanelOpen(false)
                  }}
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
          router.push(`/findings/${finding.id}`)
        }}
      />
    </div>
  )
}
