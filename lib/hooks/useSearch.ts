'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { SearchQuery } from '@/lib/validators/search-query'

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
    }>
    facets?: {
      status?: Record<string, number>
      priority?: Record<string, number>
      severity?: Record<string, number>
    }
  } | null
  isLoading: boolean
  error: string | null
  isFallback: boolean
  refetch: () => Promise<void>
}

/**
 * Hook para búsqueda de findings
 * Usa /api/search/findings (Elasticsearch)
 * Fallback a /api/findings?search=... si ES no está disponible
 */
export function useSearch(query: Partial<SearchQuery>): UseSearchResult {
  const [data, setData] = useState<UseSearchResult['data']>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)

  const debouncedQuery = useDebouncedValue(query, 300)

  const buildParams = useCallback((q: Partial<SearchQuery>): URLSearchParams => {
    const params = new URLSearchParams()

    if (q.q) params.append('q', q.q)
    if (q.status?.length) params.append('status', q.status.join(','))
    if (q.priority?.length) params.append('priority', q.priority.join(','))
    if (q.severity?.length) params.append('severity', q.severity.join(','))
    if (q.assigneeId) params.append('assigneeId', q.assigneeId)
    if (q.projectId) params.append('projectId', q.projectId)
    if (q.createdAfter) params.append('createdAfter', q.createdAfter)
    if (q.createdBefore) params.append('createdBefore', q.createdBefore)
    if (q.limit) params.append('limit', q.limit.toString())
    if (q.offset !== undefined) params.append('offset', q.offset.toString())

    return params
  }, [])

  const fetchSearch = useCallback(async () => {
    if (!debouncedQuery.q && !debouncedQuery.status?.length && !debouncedQuery.priority?.length && !debouncedQuery.severity?.length) {
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
      setData(result)
    } catch (esError) {
      // Fallback to simple /api/findings search if ES fails
      try {
        const fallbackParams = new URLSearchParams()
        if (debouncedQuery.q) {
          fallbackParams.append('search', debouncedQuery.q)
        }
        if (debouncedQuery.status?.length) {
          fallbackParams.append('status', debouncedQuery.status.join(','))
        }
        if (debouncedQuery.priority?.length) {
          fallbackParams.append('priority', debouncedQuery.priority.join(','))
        }
        if (debouncedQuery.severity?.length) {
          fallbackParams.append('severity', debouncedQuery.severity.join(','))
        }
        if (debouncedQuery.limit) {
          fallbackParams.append('limit', debouncedQuery.limit.toString())
        }
        if (debouncedQuery.offset !== undefined) {
          fallbackParams.append('offset', debouncedQuery.offset.toString())
        }

        const fallbackResponse = await fetch(`/api/findings?${fallbackParams.toString()}`)

        if (!fallbackResponse.ok) {
          throw new Error('Fallback request also failed')
        }

        const fallbackResult = await fallbackResponse.json()

        setData({
          total: fallbackResult.total || 0,
          items: (fallbackResult.items || []).map((item: any) => ({
            id: item.id,
            observation: item.observation,
            status: item.status,
            priority: item.priority,
            severity: item.severity,
            projectId: item.projectId,
            // No highlighted observation from fallback
          })),
          facets: undefined,
        })
        setIsFallback(true)
      } catch (fallbackError) {
        setError('No se pudo conectar con el servicio de búsqueda')
        setData(null)
      }
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
