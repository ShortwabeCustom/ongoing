'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { AnalyticsQuery } from '@/lib/validators/analytics-query'

export interface UseAnalyticsOptions {
  filters?: AnalyticsQuery
  refreshInterval?: number
  initialData?: any
}

export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const { filters = {}, refreshInterval = 60000, initialData } = options
  const [data, setData] = useState<any | null>(initialData ?? null)
  const [isLoading, setIsLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.status?.length) params.set('status', filters.status.join(','))
    if (filters.priority?.length)
      params.set('priority', filters.priority.join(','))
    if (filters.severity?.length)
      params.set('severity', filters.severity.join(','))
    if (filters.projectId) params.set('projectId', filters.projectId)
    if (filters.granularity) params.set('granularity', filters.granularity)
    return params
  }, [filters])

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = buildParams()
      const response = await fetch(`/api/analytics/summary?${params}`)
      if (!response.ok) throw new Error('Error al cargar analíticas')
      const json = await response.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [buildParams])

  useEffect(() => {
    if (!initialData) fetchAnalytics()
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const startPolling = () => {
      intervalRef.current = setInterval(fetchAnalytics, refreshInterval)
    }

    const stopPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        fetchAnalytics()
        startPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchAnalytics, refreshInterval])

  return { data, isLoading, error, refetch: fetchAnalytics }
}
