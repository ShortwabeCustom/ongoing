'use client'

import { useMemo } from 'react'

import { SearchFindings } from '@/components/search/SearchFindings'
import { MultiSelectFilter } from '@/components/filters/MultiSelectFilter'
import { SearchableFilter } from '@/components/filters/SearchableFilter'
import { ActiveFilterChip, ActiveFilterChipList } from '@/components/filters/ActiveFilterChip'
import { useAnalyticsFilters } from '@/lib/hooks/useAnalyticsFilters'
import { useLookups } from '@/lib/hooks/useLookups'
import {
  FINDING_STATUS_OPTIONS,
  FINDING_PRIORITY_OPTIONS,
  FINDING_SEVERITY_OPTIONS,
  STATUS_LABELS_ES,
  PRIORITY_LABELS_ES,
  SEVERITY_LABELS_ES,
} from '@/lib/constants/finding-options'

const STATUS_FILTER_OPTIONS = FINDING_STATUS_OPTIONS.map((value) => ({
  value,
  label: STATUS_LABELS_ES[value] ?? value,
}))
const PRIORITY_FILTER_OPTIONS = FINDING_PRIORITY_OPTIONS.map((value) => ({
  value,
  label: PRIORITY_LABELS_ES[value] ?? value,
}))
const SEVERITY_FILTER_OPTIONS = FINDING_SEVERITY_OPTIONS.map((value) => ({
  value,
  label: SEVERITY_LABELS_ES[value] ?? value,
}))

/**
 * Analytics' own filter bar — Estado/Prioridad/Proyecto/Asignado/Más filtros
 * (Severidad) built from the FASE 2 primitives, plus the search input reused
 * from SearchFindings (showQuickFilters=false hides its own pills so there's
 * only one Estado/Prioridad control on the page). Proyecto and Asignado are
 * single-select here — Analytics' where-clause only supports one projectId /
 * assigneeId, unlike Findings' arrays (see lib/services/analytics.ts).
 *
 * "Ronda" is intentionally absent: there is no lookup source for test
 * sessions anywhere in this branch (LookupService only has getAssignees/
 * getProjects) and Analytics has no such query param either — building it
 * would mean inventing a new endpoint, which is out of scope for this phase.
 */
export function AnalyticsFilterBar() {
  const { values, update, clearAll, activeCount } = useAnalyticsFilters()
  const { assignees, projects, isLoading: lookupsLoading } = useLookups()

  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name })),
    [projects],
  )
  const assigneeOptions = useMemo(
    () => assignees.map((a) => ({ value: a.id, label: a.name })),
    [assignees],
  )
  const projectLabel = useMemo(
    () => (values.projectId ? projects.find((p) => p.id === values.projectId)?.name : undefined),
    [projects, values.projectId],
  )
  const assigneeLabel = useMemo(
    () => (values.assigneeId ? assignees.find((a) => a.id === values.assigneeId)?.name : undefined),
    [assignees, values.assigneeId],
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Nivel 1 — búsqueda */}
      <SearchFindings presentation="dropdown" showQuickFilters={false} />

      {/* Nivel 2 — filtros principales */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFilter
          label="Estado"
          options={STATUS_FILTER_OPTIONS}
          value={values.status}
          onChange={(next) => update({ status: next })}
        />
        <MultiSelectFilter
          label="Prioridad"
          options={PRIORITY_FILTER_OPTIONS}
          value={values.priority}
          onChange={(next) => update({ priority: next })}
        />
        <SearchableFilter
          label="Proyecto"
          options={projectOptions}
          value={values.projectId ? [values.projectId] : []}
          onChange={(next) => update({ projectId: next.at(-1) })}
          searchPlaceholder="Buscar proyecto..."
          emptyLabel="No encontramos proyectos."
          loading={lookupsLoading}
        />
        <SearchableFilter
          label="Asignado"
          options={assigneeOptions}
          value={values.assigneeId ? [values.assigneeId] : []}
          onChange={(next) => update({ assigneeId: next.at(-1) })}
          searchPlaceholder="Buscar responsable..."
          emptyLabel="No encontramos responsables."
          loading={lookupsLoading}
        />

        {/* Nivel 3 — filtros secundarios (Progressive Disclosure) */}
        <MultiSelectFilter
          label="Más filtros"
          options={SEVERITY_FILTER_OPTIONS}
          value={values.severity}
          onChange={(next) => update({ severity: next })}
        />
      </div>

      {/* Filtros activos */}
      <ActiveFilterChipList onClearAll={activeCount > 0 ? clearAll : undefined}>
        {values.status.map((status) => (
          <ActiveFilterChip
            key={`status-${status}`}
            label="Estado"
            value={STATUS_LABELS_ES[status] ?? status}
            onRemove={() => update({ status: values.status.filter((s) => s !== status) })}
          />
        ))}
        {values.priority.map((priority) => (
          <ActiveFilterChip
            key={`priority-${priority}`}
            label="Prioridad"
            value={PRIORITY_LABELS_ES[priority] ?? priority}
            onRemove={() => update({ priority: values.priority.filter((p) => p !== priority) })}
          />
        ))}
        {values.severity.map((severity) => (
          <ActiveFilterChip
            key={`severity-${severity}`}
            label="Severidad"
            value={SEVERITY_LABELS_ES[severity] ?? severity}
            onRemove={() => update({ severity: values.severity.filter((s) => s !== severity) })}
          />
        ))}
        {values.projectId && (
          <ActiveFilterChip
            label="Proyecto"
            value={projectLabel ?? values.projectId}
            onRemove={() => update({ projectId: undefined })}
          />
        )}
        {values.assigneeId && (
          <ActiveFilterChip
            label="Asignado"
            value={assigneeLabel ?? values.assigneeId}
            onRemove={() => update({ assigneeId: undefined })}
          />
        )}
      </ActiveFilterChipList>
    </div>
  )
}
