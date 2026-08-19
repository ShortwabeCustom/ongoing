'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { SearchQuery } from '@/lib/validators/search-query'

const SEARCH_DEBOUNCE_DELAY = { mobile: 500, desktop: 300 } as const

export interface UseSearchResult {
  data: {
    total: number
    items: Array<{
      id: string
      observation: string
	      highlightedObservation?: string
	      status: string
	      priority: string
	      severity: string
	      projectId: string
	      assigneeId?: string
	      experienceTags?: Array<{ experienceTag: string }> | string[]
	      incidenceTypes?: Array<{ incidenceType: string }> | string[]
	      createdAt?: string
	    }>
    facets?: {
      status?: Record<string, number>
      priority?: Record<string, number>
      severity?: Record<string, number>
      assignee?: Array<{ id: string; doc_count: number }>
      project?: Array<{ id: string; doc_count: number }>
    }
    source?: 'elasticsearch' | 'postgresql'
    warning?: string
  } | null
  isLoading: boolean
  error: string | null
  isFallback: boolean
  refetch: () => Promise<void>
}

/**
 * Hook para búsqueda de findings
 * Usa /api/search/findings. El endpoint degrada a PostgreSQL si Elasticsearch
 * no esta disponible, para evitar cascadas de 503 en el navegador.
 */
export function useSearch(query: Partial<SearchQuery>): UseSearchResult {
  const [data, setData] = useState<UseSearchResult['data']>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_DELAY)

  const buildParams = useCallback((q: Partial<SearchQuery>): URLSearchParams => {
    const params = new URLSearchParams()

    if (q.q) params.append('q', q.q)
    if (q.status?.length) params.append('status', q.status.join(','))
    if (q.priority?.length) params.append('priority', q.priority.join(','))
    if (q.severity?.length) params.append('severity', q.severity.join(','))
    if (q.testSessionIds?.length) params.append('testSessionIds', q.testSessionIds.join(','))
    if (q.experienceTags?.length) params.append('experienceTags', q.experienceTags.join(','))
    if (q.incidenceTypes?.length) params.append('incidenceTypes', q.incidenceTypes.join(','))
    if (q.recent) params.append('recent', 'true')
    if (q.assigneeId) params.append('assigneeId', q.assigneeId)
    if (q.projectId) params.append('projectId', q.projectId)
    if (q.createdAfter) params.append('createdAfter', q.createdAfter)
    if (q.createdBefore) params.append('createdBefore', q.createdBefore)
    // FASE 14: Advanced filters
    if (q.assignee?.length) params.append('assignee', q.assignee.join(','))
    if (q.project?.length) params.append('project', q.project.join(','))
    // FASE 14.1: Date filtering
    if (q.dateType && q.dateType !== 'created') params.append('dateType', q.dateType)
    if (q.dateFrom) params.append('dateFrom', q.dateFrom)
    if (q.dateTo) params.append('dateTo', q.dateTo)
    if (q.hasEvidence !== undefined && q.hasEvidence !== 'any') {
      const hasEvidence =
        q.hasEvidence === 'with'
          ? true
          : q.hasEvidence === 'without'
            ? false
            : q.hasEvidence
      params.append('hasEvidence', String(hasEvidence))
    }
    if (q.limit) params.append('limit', q.limit.toString())
    if (q.offset !== undefined) params.append('offset', q.offset.toString())

    return params
  }, [])

  const fetchSearch = useCallback(async () => {
    const hasFilters = Boolean(
      debouncedQuery.q ||
      debouncedQuery.status?.length ||
      debouncedQuery.priority?.length ||
      debouncedQuery.severity?.length ||
      debouncedQuery.testSessionIds?.length ||
      debouncedQuery.experienceTags?.length ||
      debouncedQuery.incidenceTypes?.length ||
      debouncedQuery.recent ||
      debouncedQuery.assignee?.length ||
      debouncedQuery.project?.length ||
      debouncedQuery.dateFrom ||
      debouncedQuery.dateTo ||
      (debouncedQuery.hasEvidence !== undefined && debouncedQuery.hasEvidence !== 'any')
    )

    // @ts-ignore - _forceSearch is internal flag to load initial results
    if (!hasFilters && !debouncedQuery._forceSearch) {
      setData(null)
      setError(null)
      setIsFallback(false)
      return
    }

    setIsLoading(true)
    setError(null)
    setIsFallback(false)

    try {
      const params = buildParams(debouncedQuery)

      // Try Elasticsearch first
      const response = await fetch(`/api/search/findings?${params.toString()}`)

      if (!response.ok) {
        throw new Error('ES request failed')
      }

      const result = await response.json()
      setIsFallback(result.source === 'postgresql')
      setData(result)
    } catch {
      setError('No se pudo conectar con el servicio de búsqueda')
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedQuery, buildParams])

  useEffect(() => {
    fetchSearch()
  }, [fetchSearch])

  return {
    data,
    isLoading,
    error,
    isFallback,
    refetch: fetchSearch,
  }
}
