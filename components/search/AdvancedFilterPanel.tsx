'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { AdvancedFilterValues, LookupOption } from '@/lib/types/search'
import { FINDING_SEVERITY_OPTIONS, SEVERITY_LABELS_ES } from '@/lib/constants/finding-options'

interface AdvancedFilterPanelProps {
  open: boolean
  onClose: () => void
  value: AdvancedFilterValues
  onApply: (values: AdvancedFilterValues) => void
  assigneeOptions: LookupOption[]
  projectOptions: LookupOption[]
  lookupsLoading: boolean
  lookupsError: string | null
  disableExtendedFilters: boolean
  activeCount: number
}

interface Draft extends AdvancedFilterValues {
  assignee: string[]
  project: string[]
  severity: string[]
}

export function AdvancedFilterPanel({
  open,
  onClose,
  value,
  onApply,
  assigneeOptions,
  projectOptions,
  lookupsLoading,
  lookupsError,
  disableExtendedFilters,
  activeCount,
}: AdvancedFilterPanelProps) {
  const [draft, setDraft] = useState<Draft>({
    assignee: value.assignee || [],
    project: value.project || [],
    dateFrom: value.dateFrom,
    dateTo: value.dateTo,
    hasEvidence: value.hasEvidence,
    severity: value.severity || [],
  })

  const [searchAssignee, setSearchAssignee] = useState('')
  const [searchProject, setSearchProject] = useState('')

  // Update draft when value changes externally
  useEffect(() => {
    if (open) {
      setDraft({
        assignee: value.assignee || [],
        project: value.project || [],
        dateFrom: value.dateFrom,
        dateTo: value.dateTo,
        hasEvidence: value.hasEvidence,
        severity: value.severity || [],
      })
    }
  }, [open, value])

  const handleToggleAssignee = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      assignee: prev.assignee.includes(id)
        ? prev.assignee.filter((x) => x !== id)
        : [...prev.assignee, id],
    }))
  }

  const handleToggleProject = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      project: prev.project.includes(id)
        ? prev.project.filter((x) => x !== id)
        : [...prev.project, id],
    }))
  }

  const handleToggleSeverity = (sev: string) => {
    setDraft((prev) => ({
      ...prev,
      severity: prev.severity.includes(sev)
        ? prev.severity.filter((x) => x !== sev)
        : [...prev.severity, sev],
    }))
  }

  const handleReset = () => {
    const empty: Draft = {
      assignee: [],
      project: [],
      dateFrom: undefined,
      dateTo: undefined,
      hasEvidence: undefined,
      severity: [],
    }
    setDraft(empty)
    onApply(empty)
  }

  const handleApply = () => {
    const result: AdvancedFilterValues = {
      ...draft,
      assignee: draft.assignee.length ? draft.assignee : undefined,
      project: draft.project.length ? draft.project : undefined,
      severity: draft.severity.length ? draft.severity : undefined,
    }
    onApply(result)
  }

  const filteredAssignees = assigneeOptions.filter((a) =>
    a.name.toLowerCase().includes(searchAssignee.toLowerCase()),
  )
  const filteredProjects = projectOptions.filter((p) =>
    p.name.toLowerCase().includes(searchProject.toLowerCase()),
  )

  // Desktop: dropdown
  if (!open) return null

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768

  if (isDesktop) {
    return (
      <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900">Filtros avanzados</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Cerrar filtros"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Assignees */}
          {!disableExtendedFilters && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-slate-900">Asignado a</legend>
              {lookupsLoading ? (
                <p className="text-xs text-slate-500">Cargando...</p>
              ) : lookupsError ? (
                <p className="text-xs text-red-600">{lookupsError}</p>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchAssignee}
                    onChange={(e) => setSearchAssignee(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                  <div className="space-y-1">
                    {filteredAssignees.map((opt) => (
                      <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.assignee.includes(opt.id)}
                          onChange={() => handleToggleAssignee(opt.id)}
                          className="w-4 h-4 rounded border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-700">{opt.name}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </fieldset>
          )}

          {/* Projects */}
          {!disableExtendedFilters && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-slate-900">Proyecto</legend>
              {lookupsLoading ? (
                <p className="text-xs text-slate-500">Cargando...</p>
              ) : lookupsError ? (
                <p className="text-xs text-red-600">{lookupsError}</p>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchProject}
                    onChange={(e) => setSearchProject(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                  <div className="space-y-1">
                    {filteredProjects.map((opt) => (
                      <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.project.includes(opt.id)}
                          onChange={() => handleToggleProject(opt.id)}
                          className="w-4 h-4 rounded border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-700">{opt.name}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </fieldset>
          )}

          {/* Severity */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-900">Severidad</legend>
            <div className="grid grid-cols-2 gap-2">
              {FINDING_SEVERITY_OPTIONS.map((sev) => (
                <label key={sev} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.severity.includes(sev)}
                    onChange={() => handleToggleSeverity(sev)}
                    className="w-4 h-4 rounded border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">{SEVERITY_LABELS_ES[sev]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Date Range */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-900">Rango de fechas</legend>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-600">Desde</label>
                <input
                  type="date"
                  value={draft.dateFrom ? draft.dateFrom.split('T')[0] : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDraft((prev) => ({
                        ...prev,
                        dateFrom: `${e.target.value}T00:00:00Z`,
                      }))
                    } else {
                      setDraft((prev) => ({
                        ...prev,
                        dateFrom: undefined,
                      }))
                    }
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600">Hasta</label>
                <input
                  type="date"
                  value={draft.dateTo ? draft.dateTo.split('T')[0] : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDraft((prev) => ({
                        ...prev,
                        dateTo: `${e.target.value}T23:59:59Z`,
                      }))
                    } else {
                      setDraft((prev) => ({
                        ...prev,
                        dateTo: undefined,
                      }))
                    }
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
              </div>
            </div>
          </fieldset>

          {/* Evidence */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-900">Evidencia</legend>
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="evidence"
                  value="all"
                  checked={draft.hasEvidence === undefined}
                  onChange={() => setDraft((prev) => ({ ...prev, hasEvidence: undefined }))}
                  className="w-4 h-4 border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">Cualquiera</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="evidence"
                  value="true"
                  checked={draft.hasEvidence === true}
                  onChange={() => setDraft((prev) => ({ ...prev, hasEvidence: true }))}
                  className="w-4 h-4 border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">Con evidencia</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="evidence"
                  value="false"
                  checked={draft.hasEvidence === false}
                  onChange={() => setDraft((prev) => ({ ...prev, hasEvidence: false }))}
                  className="w-4 h-4 border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">Sin evidencia</span>
              </label>
            </div>
          </fieldset>

          {disableExtendedFilters && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              Modo sin Elasticsearch: los filtros de Asignado múltiple, Proyecto múltiple y "Tiene evidencia" no están disponibles.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex gap-2 justify-end">
          <button
            onClick={handleReset}
            className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Limpiar
          </button>
          <button
            onClick={handleApply}
            className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Aplicar
          </button>
        </div>
      </div>
    )
  }

  // Mobile: bottom sheet
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[60] max-h-[85vh] flex flex-col">
      <div className="sticky top-0 p-4 border-b border-slate-200 flex justify-between items-center bg-white rounded-t-2xl">
        <h3 className="font-semibold text-slate-900">Filtros avanzados</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Cerrar filtros"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Assignees */}
        {!disableExtendedFilters && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-900">Asignado a</legend>
            {lookupsLoading ? (
              <p className="text-xs text-slate-500">Cargando...</p>
            ) : lookupsError ? (
              <p className="text-xs text-red-600">{lookupsError}</p>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchAssignee}
                  onChange={(e) => setSearchAssignee(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
                <div className="space-y-1">
                  {filteredAssignees.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 cursor-pointer min-h-[44px] md:min-h-[32px]">
                      <input
                        type="checkbox"
                        checked={draft.assignee.includes(opt.id)}
                        onChange={() => handleToggleAssignee(opt.id)}
                        className="w-4 h-4 rounded border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700">{opt.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </fieldset>
        )}

        {/* Projects */}
        {!disableExtendedFilters && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-900">Proyecto</legend>
            {lookupsLoading ? (
              <p className="text-xs text-slate-500">Cargando...</p>
            ) : lookupsError ? (
              <p className="text-xs text-red-600">{lookupsError}</p>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchProject}
                  onChange={(e) => setSearchProject(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
                <div className="space-y-1">
                  {filteredProjects.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 cursor-pointer min-h-[44px] md:min-h-[32px]">
                      <input
                        type="checkbox"
                        checked={draft.project.includes(opt.id)}
                        onChange={() => handleToggleProject(opt.id)}
                        className="w-4 h-4 rounded border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700">{opt.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </fieldset>
        )}

        {/* Severity */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-900">Severidad</legend>
          <div className="grid grid-cols-2 gap-2">
            {FINDING_SEVERITY_OPTIONS.map((sev) => (
              <label key={sev} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.severity.includes(sev)}
                  onChange={() => handleToggleSeverity(sev)}
                  className="w-4 h-4 rounded border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">{SEVERITY_LABELS_ES[sev]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Date Range */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-900">Rango de fechas</legend>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-600">Desde</label>
              <input
                type="date"
                value={draft.dateFrom ? draft.dateFrom.split('T')[0] : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setDraft((prev) => ({
                      ...prev,
                      dateFrom: `${e.target.value}T00:00:00Z`,
                    }))
                  } else {
                    setDraft((prev) => ({
                      ...prev,
                      dateFrom: undefined,
                    }))
                  }
                }}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Hasta</label>
              <input
                type="date"
                value={draft.dateTo ? draft.dateTo.split('T')[0] : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setDraft((prev) => ({
                      ...prev,
                      dateTo: `${e.target.value}T23:59:59Z`,
                    }))
                  } else {
                    setDraft((prev) => ({
                      ...prev,
                      dateTo: undefined,
                    }))
                  }
                }}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>
          </div>
        </fieldset>

        {/* Evidence */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-900">Evidencia</legend>
          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer min-h-[44px] md:min-h-[32px]">
              <input
                type="radio"
                name="evidence"
                value="all"
                checked={draft.hasEvidence === undefined}
                onChange={() => setDraft((prev) => ({ ...prev, hasEvidence: undefined }))}
                className="w-4 h-4 border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
              <span className="text-sm text-slate-700">Cualquiera</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer min-h-[44px] md:min-h-[32px]">
              <input
                type="radio"
                name="evidence"
                value="true"
                checked={draft.hasEvidence === true}
                onChange={() => setDraft((prev) => ({ ...prev, hasEvidence: true }))}
                className="w-4 h-4 border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
              <span className="text-sm text-slate-700">Con evidencia</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer min-h-[44px] md:min-h-[32px]">
              <input
                type="radio"
                name="evidence"
                value="false"
                checked={draft.hasEvidence === false}
                onChange={() => setDraft((prev) => ({ ...prev, hasEvidence: false }))}
                className="w-4 h-4 border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
              <span className="text-sm text-slate-700">Sin evidencia</span>
            </label>
          </div>
        </fieldset>

        {disableExtendedFilters && (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            Modo sin Elasticsearch: los filtros de Asignado múltiple, Proyecto múltiple y "Tiene evidencia" no están disponibles.
          </div>
        )}
      </div>

      <div className="sticky bottom-0 p-4 border-t border-slate-200 bg-white rounded-b-2xl flex gap-2 justify-end">
        <button
          onClick={handleReset}
          className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Limpiar
        </button>
        <button
          onClick={handleApply}
          className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Aplicar
        </button>
      </div>
    </div>
  )
}
