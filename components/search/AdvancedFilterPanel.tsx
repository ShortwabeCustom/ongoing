'use client'

import { useState, useEffect } from 'react'
import { X, ChevronDown, Save } from 'lucide-react'
import { AdvancedFilterValues, LookupOption } from '@/lib/types/search'
import { FINDING_SEVERITY_OPTIONS, SEVERITY_LABELS_ES } from '@/lib/constants/finding-options'

interface AdvancedFilterPanelProps {
  open: boolean
  onClose: () => void
  value: AdvancedFilterValues
  onApply: (filters: AdvancedFilterValues) => void
  onSaveAsNamedFilter?: (name: string, filters: AdvancedFilterValues) => Promise<void>
  assigneeOptions: LookupOption[]
  projectOptions: LookupOption[]
  lookupsLoading: boolean
  lookupsError: string | null
  disableExtendedFilters?: boolean
  activeCount?: number
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
  disableExtendedFilters = false,
  activeCount = 0,
}: AdvancedFilterPanelProps) {
  const [draft, setDraft] = useState<AdvancedFilterValues>(value)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(value)
      setSaveName('')
      setShowSaveForm(false)
      setAssigneeSearch('')
      setProjectSearch('')
    }
  }, [open, value])

  const filteredAssignees = assigneeOptions.filter((a) =>
    a.name.toLowerCase().includes(assigneeSearch.toLowerCase())
  )

  const filteredProjects = projectOptions.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  )

  const handleToggleAssignee = (id: string) => {
    setDraft((prev) => {
      const assignee = prev.assignee || []
      return {
        ...prev,
        assignee: assignee.includes(id) ? assignee.filter((a) => a !== id) : [...assignee, id],
      }
    })
  }

  const handleToggleProject = (id: string) => {
    setDraft((prev) => {
      const project = prev.project || []
      return {
        ...prev,
        project: project.includes(id) ? project.filter((p) => p !== id) : [...project, id],
      }
    })
  }

  const handleToggleSeverity = (severity: string) => {
    setDraft((prev) => {
      const sev = prev.severity || []
      return {
        ...prev,
        severity: sev.includes(severity) ? sev.filter((s) => s !== severity) : [...sev, severity],
      }
    })
  }

  const handleClear = () => {
    const cleared: AdvancedFilterValues = {}
    setDraft(cleared)
    onApply(cleared)
  }

  const handleApply = () => {
    // Normalize dates from 'YYYY-MM-DD' to ISO if needed
    const normalized = { ...draft }
    if (draft.dateFrom && !draft.dateFrom.includes('T')) {
      normalized.dateFrom = new Date(draft.dateFrom).toISOString()
    }
    if (draft.dateTo && !draft.dateTo.includes('T')) {
      normalized.dateTo = new Date(draft.dateTo).toISOString()
    }
    onApply(normalized)
  }

  const handleSaveFilter = async () => {
    if (!saveName.trim() || !onSaveAsNamedFilter) return
    setIsSaving(true)
    try {
      await onSaveAsNamedFilter(saveName, draft)
      setShowSaveForm(false)
      setSaveName('')
    } catch (err) {
      console.error('Failed to save filter:', err)
    } finally {
      setIsSaving(false)
    }
  }

  if (!open) return null

  // Mobile: Bottom sheet
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/30"
          onClick={onClose}
        />

        {/* Bottom Sheet */}
        <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] z-[60] flex flex-col">
          {/* Header */}
          <div className="sticky top-0 border-b border-slate-200 px-4 py-3 flex items-center justify-between bg-white rounded-t-2xl">
            <h2 className="text-lg font-semibold">Filtros avanzados</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded"
              aria-label="Cerrar filtros"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
            {/* Assignees */}
            <fieldset>
              <legend className="text-sm font-medium text-slate-900 mb-2">Asignado a</legend>
              <div
                className={`space-y-2 ${
                  disableExtendedFilters ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <input
                  type="search"
                  placeholder="Buscar..."
                  value={assigneeSearch}
                  onChange={(e) => setAssigneeSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  disabled={lookupsLoading}
                />
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {filteredAssignees.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={draft.assignee?.includes(a.id) ?? false}
                        onChange={() => handleToggleAssignee(a.id)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm">{a.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            {/* Projects */}
            <fieldset>
              <legend className="text-sm font-medium text-slate-900 mb-2">Proyecto</legend>
              <div
                className={`space-y-2 ${
                  disableExtendedFilters ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <input
                  type="search"
                  placeholder="Buscar..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  disabled={lookupsLoading}
                />
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {filteredProjects.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={draft.project?.includes(p.id) ?? false}
                        onChange={() => handleToggleProject(p.id)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            {/* Severity */}
            <fieldset>
              <legend className="text-sm font-medium text-slate-900 mb-2">Severidad</legend>
              <div className="grid grid-cols-2 gap-2">
                {FINDING_SEVERITY_OPTIONS.map((sev) => (
                  <label key={sev} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.severity?.includes(sev) ?? false}
                      onChange={() => handleToggleSeverity(sev)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">{SEVERITY_LABELS_ES[sev]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Date Range */}
            <fieldset>
              <legend className="text-sm font-medium text-slate-900 mb-2">Rango de fechas</legend>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-600">Desde</label>
                  <input
                    type="date"
                    value={draft.dateFrom ? draft.dateFrom.split('T')[0] : ''}
                    onChange={(e) => setDraft((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Hasta</label>
                  <input
                    type="date"
                    value={draft.dateTo ? draft.dateTo.split('T')[0] : ''}
                    onChange={(e) => setDraft((prev) => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>
            </fieldset>

            {/* Evidence */}
            <fieldset>
              <legend className="text-sm font-medium text-slate-900 mb-2">Tiene evidencia</legend>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="radio"
                    name="evidence"
                    value="any"
                    checked={!draft.hasEvidence || draft.hasEvidence === 'any'}
                    onChange={() => setDraft((prev) => ({ ...prev, hasEvidence: 'any' }))}
                    className="border-slate-300"
                  />
                  <span className="text-sm">Cualquiera</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="radio"
                    name="evidence"
                    value="with"
                    checked={draft.hasEvidence === 'with'}
                    onChange={() => setDraft((prev) => ({ ...prev, hasEvidence: 'with' }))}
                    className="border-slate-300"
                  />
                  <span className="text-sm">Sí</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="radio"
                    name="evidence"
                    value="without"
                    checked={draft.hasEvidence === 'without'}
                    onChange={() => setDraft((prev) => ({ ...prev, hasEvidence: 'without' }))}
                    className="border-slate-300"
                  />
                  <span className="text-sm">No</span>
                </label>
              </div>
            </fieldset>

            {disableExtendedFilters && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                ⚠️ Modo sin Elasticsearch: los filtros de Asignado múltiple, Proyecto múltiple y
                'Tiene evidencia' no están disponibles.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 border-t border-slate-200 p-3 bg-white space-y-2">
            {showSaveForm ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Nombre del filtro"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm"
                  autoFocus
                />
                <button
                  onClick={handleSaveFilter}
                  disabled={!saveName.trim() || isSaving}
                  className="px-3 py-2 bg-indigo-600 text-white rounded text-sm font-medium disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => {
                    setShowSaveForm(false)
                    setSaveName('')
                  }}
                  className="px-3 py-2 bg-slate-100 rounded text-sm"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                {onSaveAsNamedFilter && (
                  <button
                    onClick={() => setShowSaveForm(true)}
                    className="flex items-center gap-1 px-3 py-2 bg-slate-100 rounded text-sm font-medium hover:bg-slate-200 min-h-[44px]"
                  >
                    <Save className="w-4 h-4" />
                    Guardar
                  </button>
                )}
                <button
                  onClick={handleClear}
                  className="flex-1 px-3 py-2 bg-slate-100 rounded text-sm font-medium hover:bg-slate-200 min-h-[44px]"
                >
                  Limpiar
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 min-h-[44px]"
                >
                  Aplicar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Desktop: Floating panel
  return (
    <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-slate-200 rounded-lg shadow-lg z-50 flex flex-col max-h-96">
      {/* Header */}
      <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filtros avanzados</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded"
          aria-label="Cerrar filtros"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3 text-sm">
        {/* Assignees */}
        <fieldset
          className={disableExtendedFilters ? 'opacity-50 pointer-events-none' : ''}
        >
          <legend className="text-xs font-medium text-slate-900 mb-1">Asignado a</legend>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {assigneeOptions.slice(0, 10).map((a) => (
              <label key={a.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={draft.assignee?.includes(a.id) ?? false}
                  onChange={() => handleToggleAssignee(a.id)}
                  className="rounded border-slate-300"
                />
                <span className="text-xs">{a.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Projects */}
        <fieldset
          className={disableExtendedFilters ? 'opacity-50 pointer-events-none' : ''}
        >
          <legend className="text-xs font-medium text-slate-900 mb-1">Proyecto</legend>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {projectOptions.slice(0, 10).map((p) => (
              <label key={p.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={draft.project?.includes(p.id) ?? false}
                  onChange={() => handleToggleProject(p.id)}
                  className="rounded border-slate-300"
                />
                <span className="text-xs">{p.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Severity */}
        <fieldset>
          <legend className="text-xs font-medium text-slate-900 mb-1">Severidad</legend>
          <div className="grid grid-cols-2 gap-1">
            {FINDING_SEVERITY_OPTIONS.map((sev) => (
              <label key={sev} className="flex items-center gap-1 cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={draft.severity?.includes(sev) ?? false}
                  onChange={() => handleToggleSeverity(sev)}
                  className="rounded border-slate-300 w-4 h-4"
                />
                <span className="text-xs">{SEVERITY_LABELS_ES[sev]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Date Range */}
        <fieldset>
          <legend className="text-xs font-medium text-slate-900 mb-1">Rango de fechas</legend>
          <div className="flex gap-2">
            <input
              type="date"
              value={draft.dateFrom ? draft.dateFrom.split('T')[0] : ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, dateFrom: e.target.value }))}
              className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs"
            />
            <span className="px-1 py-1 text-xs text-slate-500">–</span>
            <input
              type="date"
              value={draft.dateTo ? draft.dateTo.split('T')[0] : ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, dateTo: e.target.value }))}
              className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs"
            />
          </div>
        </fieldset>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 px-4 py-2 flex gap-2 bg-slate-50">
        <button
          onClick={handleClear}
          className="flex-1 px-2 py-1.5 bg-slate-200 rounded text-xs font-medium hover:bg-slate-300 min-h-[36px]"
        >
          Limpiar
        </button>
        <button
          onClick={handleApply}
          className="flex-1 px-2 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 min-h-[36px]"
        >
          Aplicar
        </button>
      </div>
    </div>
  )
}
