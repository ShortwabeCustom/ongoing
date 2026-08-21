'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

export interface AnalyticsFilterValues {
  status: string[]
  priority: string[]
  severity: string[]
  /** Analytics' where-clause only supports a single project/assignee, unlike Findings' arrays. */
  projectId?: string
  assigneeId?: string
}

const EMPTY: AnalyticsFilterValues = { status: [], priority: [], severity: [] }

function parseCommaList(value: string | null): string[] {
  return value?.split(',').filter(Boolean) ?? []
}

/**
 * URL sync for Analytics' Estado/Prioridad/Severidad/Proyecto/Asignado —
 * intentionally separate from lib/hooks/useUrlSync.ts (Findings), which uses
 * a different query-param schema (dateFrom/dateTo, project[]/assignee[]).
 * Analytics' `from`/`to` are owned by AnalysisPeriodPanel, not this hook.
 */
export function useAnalyticsFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const values: AnalyticsFilterValues = useMemo(() => {
    const status = parseCommaList(searchParams.get('status'))
    const priority = parseCommaList(searchParams.get('priority'))
    const severity = parseCommaList(searchParams.get('severity'))
    const projectId = searchParams.get('projectId') ?? undefined
    const assigneeId = searchParams.get('assigneeId') ?? undefined

    if (!status.length && !priority.length && !severity.length && !projectId && !assigneeId) {
      return EMPTY
    }
    return { status, priority, severity, projectId, assigneeId }
  }, [searchParams])

  const update = useCallback(
    (patch: Partial<AnalyticsFilterValues>) => {
      const params = new URLSearchParams(searchParams)
      const next = { ...values, ...patch }

      const setList = (key: string, list: string[]) => {
        if (list.length) params.set(key, list.join(','))
        else params.delete(key)
      }
      setList('status', next.status)
      setList('priority', next.priority)
      setList('severity', next.severity)

      if (next.projectId) params.set('projectId', next.projectId)
      else params.delete('projectId')

      if (next.assigneeId) params.set('assigneeId', next.assigneeId)
      else params.delete('assigneeId')

      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams, values],
  )

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams)
    for (const key of ['status', 'priority', 'severity', 'projectId', 'assigneeId']) {
      params.delete(key)
    }
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  const activeCount =
    values.status.length +
    values.priority.length +
    values.severity.length +
    (values.projectId ? 1 : 0) +
    (values.assigneeId ? 1 : 0)

  return { values, update, clearAll, activeCount }
}
