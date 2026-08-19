'use client'

import { useState, useEffect } from 'react'
import { X, ChevronDown, Save } from 'lucide-react'
import { AdvancedFilterValues, LookupOption } from '@/lib/types/search'
import { FINDING_SEVERITY_OPTIONS, SEVERITY_LABELS_ES, EXPERIENCE_TAG_OPTIONS, EXPERIENCE_TAG_LABELS_ES, INCIDENCE_TYPE_OPTIONS, INCIDENCE_TYPE_LABELS_ES } from '@/lib/constants/finding-options'
import { DateTypeSelector } from './DateTypeSelector'
import { DatePresetButtons, getDateRangeForPreset } from './DatePresetButtons'
import { dateStringToUTCRange } from '@/lib/utils/timezone'

interface AdvancedFilterPanelProps {
  open: boolean
  onClose: () => void
  value: AdvancedFilterValues
  onApply: (filters: AdvancedFilterValues) => void
  onSaveAsNamedFilter?: (name: string, filters: AdvancedFilterValues) => Promise<void>
  assigneeOptions: LookupOption[]
  projectOptions: LookupOption[]
  testSessionOptions: LookupOption[]
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
  testSessionOptions,
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
  const [dateError, setDateError] = useState<string | null>(null)

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
    if (draft.dateFrom && draft.dateTo && new Date(draft.dateFrom) > new Date(draft.dateTo)) {
      setDateError('La fecha Desde no puede ser posterior a Hasta.')
      return
    }
    setDateError(null)
    onApply(draft)
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

  const toggleArray = (key: 'testSessionIds' | 'experienceTags' | 'incidenceTypes', id: string) => {
    setDraft((prev) => {
      const values = prev[key] || []
      return { ...prev, [key]: values.includes(id) ? values.filter((value) => value !== id) : [...values, id] }
    })
  }

  const taxonomyFilters = (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-[#17251f]">Ronda de pruebas</legend>
        <div className="max-h-36 space-y-1 overflow-y-auto">
          {testSessionOptions.map((session) => (
            <label key={session.id} className="flex min-h-11 cursor-pointer items-center gap-2">
              <input type="checkbox" checked={draft.testSessionIds?.includes(session.id) ?? false} onChange={() => toggleArray('testSessionIds', session.id)} />
              <span className="text-sm">{session.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-[#17251f]">Área / etiqueta</legend>
        <div className="grid grid-cols-2 gap-1">
          {EXPERIENCE_TAG_OPTIONS.map((value) => <label key={value} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={draft.experienceTags?.includes(value) ?? false} onChange={() => toggleArray('experienceTags', value)} /><span className="text-sm">{EXPERIENCE_TAG_LABELS_ES[value]}</span></label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-[#17251f]">Tipo de incidencia</legend>
        <div className="space-y-1">
          {INCIDENCE_TYPE_OPTIONS.map((value) => <label key={value} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={draft.incidenceTypes?.includes(value) ?? false} onChange={() => toggleArray('incidenceTypes', value)} /><span className="text-sm">{INCIDENCE_TYPE_LABELS_ES[value]}</span></label>)}
        </div>
      </fieldset>
    </div>
  )

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
          <div className="sticky top-0 border-b border-[#dbe4dd] px-4 py-3 flex items-center justify-between bg-white rounded-t-2xl">
            <h2 className="text-lg font-semibold text-[#17251f]">Filtros avanzados</h2>
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
              <legend className="text-sm font-semibold text-[#17251f] mb-2">Asignado a</legend>
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
                  className="w-full px-3 py-2 border border-[#dbe4dd] rounded text-sm"
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
              <legend className="text-sm font-semibold text-[#17251f] mb-2">Proyecto</legend>
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
                  className="w-full px-3 py-2 border border-[#dbe4dd] rounded text-sm"
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

            {taxonomyFilters}
            {/* Severity */}
            <fieldset>
              <legend className="text-sm font-semibold text-[#17251f] mb-2">Severidad</legend>
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

            {/* FASE 14.1: Date Filtering */}
            <div className="border-t border-[#dbe4dd] pt-4">
              <DateTypeSelector
                value={draft.dateType || 'created'}
                onChange={(type) => setDraft((prev) => ({ ...prev, dateType: type }))}
              />

              {(draft.dateFrom || draft.dateTo) && (
                <div className="mt-4">
                  <DatePresetButtons
                    selectedPreset={draft.datePreset}
                    onSelectPreset={(preset) => {
                      const [from, to] = getDateRangeForPreset(preset)
                      setDraft((prev) => ({
                        ...prev,
                        dateFrom: from,
                        dateTo: to,
                        datePreset: preset,
                      }))
                    }}
                    onShowCustom={() => {
                      setDraft((prev) => ({
                        ...prev,
                        datePreset: 'custom',
                      }))
                    }}
                  />
                </div>
              )}

              {(!draft.dateFrom || draft.datePreset === 'custom') && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[#17251f]">Desde</label>
                    <input
                      type="date"
                      value={draft.dateFrom ? draft.dateFrom.split('T')[0] : ''}
                      onChange={(e) => {
                        const newDate = e.target.value
                        if (!newDate) setDraft((prev) => ({ ...prev, dateFrom: undefined, datePreset: 'custom' }))
                        if (newDate) {
                          // FASE 14.1.3: Parse date as America/Mexico_City timezone
                          // Convert to UTC range accounting for Mexico offset
                          try {
                            const [startUTC] = dateStringToUTCRange(newDate, 'America/Mexico_City')
                            setDraft((prev) => ({
                              ...prev,
                              dateFrom: startUTC,
                              datePreset: 'custom',
                            }))
                          } catch (err) {
                            console.error('Invalid date format:', err)
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-[#dbe4dd] rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#17251f]">Hasta</label>
                    <input
                      type="date"
                      value={draft.dateTo ? draft.dateTo.split('T')[0] : ''}
                      onChange={(e) => {
                        const newDate = e.target.value
                        if (!newDate) setDraft((prev) => ({ ...prev, dateTo: undefined, datePreset: 'custom' }))
                        if (newDate) {
                          // FASE 14.1.3: Parse date as America/Mexico_City timezone
                          // Convert to UTC range accounting for Mexico offset
                          try {
                            const [, endUTC] = dateStringToUTCRange(newDate, 'America/Mexico_City')
                            setDraft((prev) => ({
                              ...prev,
                              dateTo: endUTC,
                              datePreset: 'custom',
                            }))
                          } catch (err) {
                            console.error('Invalid date format:', err)
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-[#dbe4dd] rounded text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Evidence */}
            <fieldset>
              <legend className="text-sm font-semibold text-[#17251f] mb-2">Tiene evidencia</legend>
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

          {dateError && <p role="alert" className="px-3 text-sm text-destructive">{dateError}</p>}
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
                  className="px-3 py-2 rounded text-sm font-medium disabled:opacity-50 text-white"
                  style={{ backgroundColor: '#00a85a' }}
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
                  className="flex-1 px-3 py-2 rounded text-sm font-medium min-h-[44px]"
                  style={{ backgroundColor: '#f3f5ef', color: '#17251f' }}
                >
                  Limpiar
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 px-3 py-2 text-white rounded text-sm font-medium min-h-[44px]"
                  style={{ backgroundColor: '#00a85a' }}
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
      <div className="border-b border-[#dbe4dd] px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#17251f]">Filtros avanzados</h2>
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
          <legend className="text-xs font-semibold text-[#17251f] mb-1">Asignado a</legend>
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
          <legend className="text-xs font-semibold text-[#17251f] mb-1">Proyecto</legend>
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

        {taxonomyFilters}
        {/* Severity */}
        <fieldset>
          <legend className="text-xs font-semibold text-[#17251f] mb-1">Severidad</legend>
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

        {/* FASE 14.1: Date Filtering (Desktop) */}
        <fieldset className="border-t border-[#dbe4dd] pt-3">
          <legend className="text-xs font-medium text-[#17251f] mb-2">Tipo de fecha</legend>
          <select
            value={draft.dateType || 'created'}
            onChange={(e) => setDraft((prev) => ({ ...prev, dateType: e.target.value as any }))}
            className="w-full px-2 py-1 border border-[#dbe4dd] rounded text-xs"
          >
            <option value="created">Fecha de creación</option>
            <option value="updated">Última actualización</option>
            <option value="imported">Fecha de carga</option>
            <option value="session">Fecha de prueba</option>
          </select>

          <div className="mt-2 flex gap-1">
            <input
              type="date"
              value={draft.dateFrom ? draft.dateFrom.split('T')[0] : ''}
              onChange={(e) => {
                const newDate = e.target.value
                if (!newDate) setDraft((prev) => ({ ...prev, dateFrom: undefined, datePreset: 'custom' }))
                if (newDate) {
                  const dateObj = new Date(newDate + 'T00:00:00')
                  setDraft((prev) => ({
                    ...prev,
                    dateFrom: dateObj.toISOString(),
                    datePreset: 'custom',
                  }))
                }
              }}
              className="flex-1 px-2 py-1 border border-[#dbe4dd] rounded text-xs"
              placeholder="Desde"
            />
            <span className="px-1 py-1 text-xs text-[#65766e]">–</span>
            <input
              type="date"
              value={draft.dateTo ? draft.dateTo.split('T')[0] : ''}
              onChange={(e) => {
                const newDate = e.target.value
                if (!newDate) setDraft((prev) => ({ ...prev, dateTo: undefined, datePreset: 'custom' }))
                if (newDate) {
                  const dateObj = new Date(newDate + 'T23:59:59')
                  setDraft((prev) => ({
                    ...prev,
                    dateTo: dateObj.toISOString(),
                    datePreset: 'custom',
                  }))
                }
              }}
              className="flex-1 px-2 py-1 border border-[#dbe4dd] rounded text-xs"
              placeholder="Hasta"
            />
          </div>
        </fieldset>
      </div>

      {dateError && <p role="alert" className="px-3 text-sm text-destructive">{dateError}</p>}
      {/* Footer */}
      <div className="border-t border-[#dbe4dd] px-4 py-2 flex gap-2" style={{ backgroundColor: '#f3f5ef' }}>
        <button
          onClick={handleClear}
          className="flex-1 px-2 py-1.5 rounded text-xs font-medium min-h-[36px]"
          style={{ backgroundColor: '#e8ede9', color: '#17251f' }}
        >
          Limpiar
        </button>
        <button
          onClick={handleApply}
          className="flex-1 px-2 py-1.5 text-white rounded text-xs font-medium min-h-[36px]"
          style={{ backgroundColor: '#00a85a' }}
        >
          Aplicar
        </button>
      </div>
    </div>
  )
}
