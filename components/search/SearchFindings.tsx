'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSearch } from '@/lib/hooks/useSearch'
import { useBatchActions } from '@/lib/hooks/useBatchActions'
import { useLookups } from '@/lib/hooks/useLookups'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'
import { useSavedFilters } from '@/lib/hooks/useSavedFilters'
import { SearchResultItem } from './SearchResultItem'
import { AdvancedFilterPanel } from './AdvancedFilterPanel'
import { BatchActionsToolbar } from './BatchActionsToolbar'
import { FilterPreview } from './FilterPreview'
import { SearchHistory } from './SearchHistory'
import { FINDING_STATUS_OPTIONS, FINDING_PRIORITY_OPTIONS } from '@/lib/constants/finding-options'
import type { AdvancedFilterValues } from '@/lib/types/search'
import { Search, X, ChevronDown, Filter } from 'lucide-react'

export function SearchFindings() {
  const auth = useAuth()
  const canBatchEdit = auth?.user?.role && ['OWNER', 'QA_LEAD'].includes(auth.user.role)

  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
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

  const { data, isLoading, error, isFallback, refetch } = useSearch({
    q: searchTerm,
    status: statusFilter.length > 0 ? statusFilter : undefined,
    priority: priorityFilter.length > 0 ? priorityFilter : undefined,
    severity: advancedFilters.severity,
    assignee: advancedFilters.assignee,
    project: advancedFilters.project,
    dateFrom: advancedFilters.dateFrom,
    dateTo: advancedFilters.dateTo,
    hasEvidence: advancedFilters.hasEvidence,
    limit: 10,
  })

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
    (advancedFilters.dateFrom ? 1 : 0) +
    (advancedFilters.dateTo ? 1 : 0) +
    (advancedFilters.hasEvidence !== undefined ? 1 : 0)

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
        filters: activeFilterCount > 0 ? advancedFilters : undefined,
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

  const handleSelectSaved = (entry: (typeof savedFilters.saved)[0]) => {
    setSearchTerm(entry.q || '')
    setStatusFilter(entry.status || [])
    setPriorityFilter(entry.priority || [])
    setAdvancedFilters(entry.filters || {})
    setIsOpen(true)
    setHistoryOpen(false)
  }

  const handleCsvExport = () => {
    if (!data?.items) return

    const Papa = require('papaparse')
    const selectedItems = data.items.filter((item) => batchActions.isSelected(item.id))

    if (selectedItems.length === 0) {
      alert('No hay elementos seleccionados')
      return
    }

    const csvData = selectedItems.map((item) => ({
      ID: item.id,
      Observación: item.observation.replace(/<[^>]*>/g, ''),
      Estado: item.status,
      Prioridad: item.priority,
      Severidad: item.severity,
      Proyecto: projectLabels[item.projectId] || item.projectId,
      'Asignado a': item.assigneeId ? assigneeLabels[item.assigneeId] || item.assigneeId : '',
      Creado: item.createdAt ? new Date(item.createdAt).toLocaleString('es-ES') : '',
    }))

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `hallazgos-${new Date().toISOString().split('T')[0]}.csv`)
    link.click()
  }

  const hasResults = data && data.items.length > 0
  const showDropdown = isOpen && (isLoading || hasResults || error)

  const renderResults = () => (
    <>
      {isLoading && (
        <div className="p-4 text-center text-sm text-slate-500">
          <div className="animate-spin inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full" />
        </div>
      )}

      {!isLoading && hasResults && (
        <>
          {batchActions.selectedIds.length > 0 && (
            <BatchActionsToolbar
              selectedCount={batchActions.selectedIds.length}
              onClearSelection={batchActions.clearSelection}
              onBulkStatus={batchActions.bulkUpdateStatus}
              onBulkPriority={batchActions.bulkUpdatePriority}
              onBulkAssign={batchActions.bulkAssign}
              onExportCsv={handleCsvExport}
              assigneeOptions={assignees}
              isProcessing={batchActions.isProcessing}
              error={batchActions.error}
              maxBatchSize={100}
            />
          )}

          <div className="p-3 space-y-3">
            {data!.items.map((item) => (
              <div
                key={item.id}
                className="min-h-[44px] md:min-h-0 py-2.5 md:py-2 px-3 rounded cursor-pointer transition-colors
                           active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500
                           [@media(hover:hover)]:hover:bg-slate-50"
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

          {data!.facets && (
            <div className="border-t border-slate-200 p-3 bg-slate-50 text-xs text-slate-600">
              <div>Total: {data!.total} hallazgos</div>
              {isFallback && (
                <div className="text-amber-700 mt-1">
                  ℹ️ Modo sin Elasticsearch: filtros avanzados limitados
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!isLoading && !hasResults && !error && searchTerm && (
        <div className="p-4 text-center text-sm text-slate-500">No se encontraron resultados</div>
      )}

      {error && (
        <div className="p-4 text-center text-sm text-red-600">
          {error}
          {isFallback && <div className="text-slate-500 mt-1">Usando búsqueda de base de datos</div>}
        </div>
      )}
    </>
  )

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      {/* Desktop version */}
      <div className="hidden md:block">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar hallazgos..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg bg-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors [@media(hover:hover)]:hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick filters + Advanced button */}
        <div className="mt-3 flex flex-wrap gap-2 items-center">
            <div className="flex gap-1">
              {FINDING_STATUS_OPTIONS.slice(0, 4).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
                    )
                    setIsOpen(true)
                  }}
                  className={`px-2 py-1 text-xs rounded transition-colors [@media(hover:hover)]:hover:bg-slate-200 ${
                    statusFilter.includes(status) ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex gap-1">
              {FINDING_PRIORITY_OPTIONS.map((priority) => (
                <button
                  key={priority}
                  onClick={() => {
                    setPriorityFilter((prev) =>
                      prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority],
                    )
                    setIsOpen(true)
                  }}
                  className={`px-2 py-1 text-xs rounded transition-colors [@media(hover:hover)]:hover:bg-slate-200 ${
                    priorityFilter.includes(priority) ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {priority}
                </button>
              ))}
            </div>

            {/* Advanced filters button */}
            <button
              onClick={() => {
                setAdvancedPanelOpen(!advancedPanelOpen)
                setHistoryOpen(false)
              }}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Filter className="w-3 h-3" />
              Filtros
              {activeFilterCount > 0 && <span className="ml-1 font-bold text-indigo-600">+{activeFilterCount}</span>}
            </button>

            {/* Search history button */}
            <button
              onClick={() => {
                setHistoryOpen(!historyOpen)
                setAdvancedPanelOpen(false)
              }}
              className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              🕐 Recientes
            </button>
        </div>

        {/* Filter preview */}
        {activeFilterCount > 0 && (
          <div className="mt-3">
            <FilterPreview
              status={statusFilter}
              priority={priorityFilter}
              severity={advancedFilters.severity || []}
              filters={advancedFilters}
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
                  dateFrom: undefined,
                  dateTo: undefined,
                }))
              }
              onRemoveHasEvidence={() =>
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
              await savedFilters.saveFilter(name, filters, searchTerm)
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
        <SearchHistory
          open={historyOpen}
          onSelectHistory={handleSelectRecent}
          onSelectSavedFilter={handleSelectSaved}
        />

        {/* Dropdown results */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-lg shadow-lg z-40 max-h-96 overflow-y-auto">
            {renderResults()}
          </div>
        )}
      </div>

      {/* Mobile version */}
      <div className="md:hidden">
        {/* Search input trigger */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar hallazgos..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            readOnly
            className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg bg-white text-base placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal overlay & bottom sheet */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => {
                setIsOpen(false)
                setOpenFilterSection(null)
                setAdvancedPanelOpen(false)
              }}
            />

            {/* Bottom sheet panel */}
            <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto z-50 flex flex-col">
              {/* Header */}
              <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white rounded-t-2xl">
                <h2 className="text-lg font-semibold text-slate-900">Búsqueda avanzada</h2>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setOpenFilterSection(null)
                    setAdvancedPanelOpen(false)
                  }}
                  aria-label="Cerrar búsqueda"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 active:bg-slate-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter preview (mobile) */}
              {activeFilterCount > 0 && (
                <div className="px-4 py-2 border-b border-slate-200">
                  <FilterPreview
                    status={statusFilter}
                    priority={priorityFilter}
                    severity={advancedFilters.severity || []}
                    filters={advancedFilters}
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
                        dateFrom: undefined,
                        dateTo: undefined,
                      }))
                    }
                    onRemoveHasEvidence={() =>
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
              <div className="flex-1 px-4 py-3 space-y-2 overflow-y-auto">
                {/* Status filter */}
                <div className="border-b border-slate-200">
                  <button
                    onClick={() => setOpenFilterSection(openFilterSection === 'status' ? null : 'status')}
                    aria-expanded={openFilterSection === 'status'}
                    aria-controls="status-content"
                    className="w-full px-3 py-3 min-h-[44px] flex items-center justify-between text-left active:bg-slate-100 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <span className="font-medium text-slate-900">Estado</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform ${
                        openFilterSection === 'status' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openFilterSection === 'status' && (
                    <div id="status-content" className="px-3 py-3 bg-slate-50 space-y-2">
                      {FINDING_STATUS_OPTIONS.map((status) => (
                        <label
                          key={status}
                          className="flex items-center min-h-[44px] gap-2 cursor-pointer"
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
                            className="w-4 h-4 rounded border-slate-300 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-700">{status}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Priority filter */}
                <div className="border-b border-slate-200">
                  <button
                    onClick={() => setOpenFilterSection(openFilterSection === 'priority' ? null : 'priority')}
                    aria-expanded={openFilterSection === 'priority'}
                    aria-controls="priority-content"
                    className="w-full px-3 py-3 min-h-[44px] flex items-center justify-between text-left active:bg-slate-100 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <span className="font-medium text-slate-900">Prioridad</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform ${
                        openFilterSection === 'priority' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openFilterSection === 'priority' && (
                    <div id="priority-content" className="px-3 py-3 bg-slate-50 space-y-2">
                      {FINDING_PRIORITY_OPTIONS.map((priority) => (
                        <label
                          key={priority}
                          className="flex items-center min-h-[44px] gap-2 cursor-pointer"
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
                            className="w-4 h-4 rounded border-slate-300 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-700">{priority}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Advanced filters button (mobile) */}
                <div className="border-b border-slate-200">
                  <button
                    onClick={() => setAdvancedPanelOpen(!advancedPanelOpen)}
                    aria-expanded={advancedPanelOpen}
                    aria-controls="advanced-content"
                    className="w-full px-3 py-3 min-h-[44px] flex items-center justify-between text-left active:bg-slate-100 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <span className="font-medium text-slate-900 flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      Filtros avanzados
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform ${
                        advancedPanelOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {advancedPanelOpen && (
                    <div id="advanced-content" className="px-3 py-3 bg-slate-50">
                      <AdvancedFilterPanel
                        open={true}
                        onClose={() => setAdvancedPanelOpen(false)}
                        value={advancedFilters}
                        onApply={(filters) => {
                          setAdvancedFilters(filters)
                          setAdvancedPanelOpen(false)
                        }}
                        onSaveAsNamedFilter={async (name, filters) => {
                          await savedFilters.saveFilter(name, filters, searchTerm)
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
              {searchTerm && (
                <div className="flex-1 overflow-y-auto">
                  <div className="border-t border-slate-200 p-3">{renderResults()}</div>
                </div>
              )}

              {/* Footer actions */}
              <div className="sticky bottom-0 px-4 py-3 border-t border-slate-200 bg-white flex gap-2">
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
                  className="flex-1 min-h-[44px] py-2.5 px-3 bg-slate-100 text-slate-900 rounded-lg font-medium transition-colors active:bg-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Limpiar
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setOpenFilterSection(null)
                    setAdvancedPanelOpen(false)
                  }}
                  className="flex-1 min-h-[44px] py-2.5 px-3 bg-emerald-500 text-white rounded-lg font-medium transition-colors active:bg-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
