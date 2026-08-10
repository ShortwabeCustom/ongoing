'use client'

import { useEffect, useState } from 'react'
import { AdvancedFilterValues, LookupOption } from '@/lib/types/search'
import { FINDING_SEVERITY_OPTIONS, SEVERITY_LABELS_ES } from '@/lib/constants/finding-options'
import { X } from 'lucide-react'

interface AdvancedFilterPanelProps {
  open: boolean
  onClose: () => void
  value: AdvancedFilterValues
  onApply: (values: AdvancedFilterValues) => void
  onSaveAsNamedFilter: (name: string, values: AdvancedFilterValues) => Promise<void>
  assigneeOptions: LookupOption[]
  projectOptions: LookupOption[]
  lookupsLoading: boolean
  lookupsError: string | null
  disableExtendedFilters: boolean
  activeCount: number
}

export function AdvancedFilterPanel({
  open,
  onClose,
  value,
  onApply,
  onSaveAsNamedFilter,
  assigneeOptions,
  projectOptions,
  lookupsLoading,
  lookupsError,
  disableExtendedFilters,
  activeCount,
}: AdvancedFilterPanelProps) {
  const [draft, setDraft] = useState<AdvancedFilterValues>(value)
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const [saveFilterName, setSaveFilterName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(value)
      setAssigneeSearch('')
      setProjectSearch('')
      setSaveFilterName('')
    }
  }, [open, value])

  const filteredAssignees = assigneeOptions.filter((a) =>
    a.name.toLowerCase().includes(assigneeSearch.toLowerCase()),
  )

  const filteredProjects = projectOptions.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()),
  )

  const handleClear = () => {
    const empty: AdvancedFilterValues = {
      assignee: [],
      project: [],
      severity: [],
      dateFrom: undefined,
      dateTo: undefined,
      hasEvidence: undefined,
    }
    setDraft(empty)
    onApply(empty)
    onClose()
  }

  const handleApply = () => {
    // Normalize dates to ISO strings
    const normalized: AdvancedFilterValues = {
      ...draft,
      dateFrom: draft.dateFrom ? new Date(draft.dateFrom).toISOString() : undefined,
      dateTo: draft.dateTo ? new Date(draft.dateTo).toISOString() : undefined,
    }
    onApply(normalized)
    onClose()
  }

  const handleSaveFilter = async () => {
    if (!saveFilterName.trim()) return
    try {
      setIsSaving(true)
      await onSaveAsNamedFilter(saveFilterName, draft)
      setSaveFilterName('')
    } catch (err) {
      console.error('Failed to save filter:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Mobile: bottom-sheet (fixed bottom, z-60)
  // Desktop: dropdown (absolute, z-50)

  if (!open) return null

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] z-[60] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-semibold">Filtros avanzados</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Cerrar filtros"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Assignee */}
          <div className={disableExtendedFilters ? 'opacity-50 pointer-events-none' : ''}>
            <label className="block text-sm font-medium mb-2">Asignado a</label>
            <input
              type="text"
              placeholder="Buscar..."
              value={assigneeSearch}
              onChange={(e) => setAssigneeSearch(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
              disabled={lookupsLoading}
            />
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {filteredAssignees.map((a) => (
                <label key={a.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.assignee.includes(a.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDraft((d) => ({
                          ...d,
                          assignee: [...d.assignee, a.id],
                        }))
                      } else {
                        setDraft((d) => ({
                          ...d,
                          assignee: d.assignee.filter((x) => x !== a.id),
                        }))
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-sm">{a.name}</span>
                </label>
              ))}
            </div>
            {disableExtendedFilters && <p className="text-xs text-slate-500 mt-1">No disponible sin Elasticsearch</p>}
          </div>

          {/* Project */}
          <div className={disableExtendedFilters ? 'opacity-50 pointer-events-none' : ''}>
            <label className="block text-sm font-medium mb-2">Proyecto</label>
            <input
              type="text"
              placeholder="Buscar..."
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
              disabled={lookupsLoading}
            />
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {filteredProjects.map((p) => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.project.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDraft((d) => ({
                          ...d,
                          project: [...d.project, p.id],
                        }))
                      } else {
                        setDraft((d) => ({
                          ...d,
                          project: d.project.filter((x) => x !== p.id),
                        }))
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-sm">{p.name}</span>
                </label>
              ))}
            </div>
            {disableExtendedFilters && <p className="text-xs text-slate-500 mt-1">No disponible sin Elasticsearch</p>}
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium mb-2">Severidad</label>
            <div className="grid grid-cols-2 gap-2">
              {FINDING_SEVERITY_OPTIONS.map((sev) => (
                <label key={sev} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.severity.includes(sev)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDraft((d) => ({ ...d, severity: [...d.severity, sev] }))
                      } else {
                        setDraft((d) => ({ ...d, severity: d.severity.filter((x) => x !== sev) }))
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-sm">{SEVERITY_LABELS_ES[sev]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-sm font-medium mb-2">Rango de fechas</label>
            <input
              type="date"
              value={draft.dateFrom || ''}
              onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
            <input
              type="date"
              value={draft.dateTo || ''}
              onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          </div>

          {/* Evidence */}
          <div>
            <label className="block text-sm font-medium mb-2">Evidencia</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="hasEvidence"
                  checked={draft.hasEvidence === undefined}
                  onChange={() => setDraft((d) => ({ ...d, hasEvidence: undefined }))}
                  className="w-4 h-4 rounded-full border-slate-300"
                />
                <span className="text-sm">Cualquiera</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="hasEvidence"
                  checked={draft.hasEvidence === true}
                  onChange={() => setDraft((d) => ({ ...d, hasEvidence: true }))}
                  className="w-4 h-4 rounded-full border-slate-300"
                />
                <span className="text-sm">Con evidencia</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="hasEvidence"
                  checked={draft.hasEvidence === false}
                  onChange={() => setDraft((d) => ({ ...d, hasEvidence: false }))}
                  className="w-4 h-4 rounded-full border-slate-300"
                />
                <span className="text-sm">Sin evidencia</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-slate-200 shrink-0 bg-slate-50">
          <button
            onClick={handleClear}
            className="flex-1 px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Limpiar
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Aplicar
          </button>
        </div>

        {/* Save filter */}
        {activeCount > 0 && (
          <div className="border-t border-slate-200 p-3 bg-slate-50">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nombre del filtro..."
                value={saveFilterName}
                onChange={(e) => setSaveFilterName(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
              <button
                onClick={handleSaveFilter}
                disabled={isSaving || !saveFilterName.trim()}
                className="px-3 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                ⭐
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Desktop dropdown
  return (
    <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h3 className="font-semibold">Filtros avanzados</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {/* Assignee */}
        <div className={disableExtendedFilters ? 'opacity-50 pointer-events-none' : ''}>
          <label className="block text-sm font-medium mb-2">Asignado a</label>
          <input
            type="text"
            placeholder="Buscar..."
            value={assigneeSearch}
            onChange={(e) => setAssigneeSearch(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
            disabled={lookupsLoading}
          />
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {filteredAssignees.map((a) => (
              <label key={a.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={draft.assignee.includes(a.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDraft((d) => ({ ...d, assignee: [...d.assignee, a.id] }))
                    } else {
                      setDraft((d) => ({ ...d, assignee: d.assignee.filter((x) => x !== a.id) }))
                    }
                  }}
                  className="w-3 h-3 rounded border-slate-300"
                />
                {a.name}
              </label>
            ))}
          </div>
          {disableExtendedFilters && <p className="text-xs text-slate-500 mt-1">No disponible sin Elasticsearch</p>}
        </div>

        {/* Project */}
        <div className={disableExtendedFilters ? 'opacity-50 pointer-events-none' : ''}>
          <label className="block text-sm font-medium mb-2">Proyecto</label>
          <input
            type="text"
            placeholder="Buscar..."
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
            disabled={lookupsLoading}
          />
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {filteredProjects.map((p) => (
              <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={draft.project.includes(p.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDraft((d) => ({ ...d, project: [...d.project, p.id] }))
                    } else {
                      setDraft((d) => ({ ...d, project: d.project.filter((x) => x !== p.id) }))
                    }
                  }}
                  className="w-3 h-3 rounded border-slate-300"
                />
                {p.name}
              </label>
            ))}
          </div>
          {disableExtendedFilters && <p className="text-xs text-slate-500 mt-1">No disponible sin Elasticsearch</p>}
        </div>

        {/* Severity */}
        <div>
          <label className="block text-sm font-medium mb-2">Severidad</label>
          <div className="grid grid-cols-2 gap-2">
            {FINDING_SEVERITY_OPTIONS.map((sev) => (
              <label key={sev} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={draft.severity.includes(sev)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDraft((d) => ({ ...d, severity: [...d.severity, sev] }))
                    } else {
                      setDraft((d) => ({ ...d, severity: d.severity.filter((x) => x !== sev) }))
                    }
                  }}
                  className="w-3 h-3 rounded border-slate-300"
                />
                {SEVERITY_LABELS_ES[sev]}
              </label>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div>
          <label className="block text-sm font-medium mb-2">Rango de fechas</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={draft.dateFrom || ''}
              onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
            <input
              type="date"
              value={draft.dateTo || ''}
              onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          </div>
        </div>

        {/* Evidence */}
        <div>
          <label className="block text-sm font-medium mb-2">Evidencia</label>
          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="hasEvidence"
                checked={draft.hasEvidence === undefined}
                onChange={() => setDraft((d) => ({ ...d, hasEvidence: undefined }))}
                className="w-3 h-3 rounded-full border-slate-300"
              />
              Cualquiera
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="hasEvidence"
                checked={draft.hasEvidence === true}
                onChange={() => setDraft((d) => ({ ...d, hasEvidence: true }))}
                className="w-3 h-3 rounded-full border-slate-300"
              />
              Con evidencia
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="hasEvidence"
                checked={draft.hasEvidence === false}
                onChange={() => setDraft((d) => ({ ...d, hasEvidence: false }))}
                className="w-3 h-3 rounded-full border-slate-300"
              />
              Sin evidencia
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-2 p-4 border-t border-slate-200 bg-slate-50">
        <button
          onClick={handleClear}
          className="flex-1 px-3 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Limpiar
        </button>
        <button
          onClick={handleApply}
          className="flex-1 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Aplicar
        </button>
      </div>

      {/* Save filter */}
      {activeCount > 0 && (
        <div className="border-t border-slate-200 p-3 bg-slate-50 flex gap-2">
          <input
            type="text"
            placeholder="Nombre del filtro..."
            value={saveFilterName}
            onChange={(e) => setSaveFilterName(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
          <button
            onClick={handleSaveFilter}
            disabled={isSaving || !saveFilterName.trim()}
            className="px-3 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            ⭐
          </button>
        </div>
      )}
    </div>
  )
}
