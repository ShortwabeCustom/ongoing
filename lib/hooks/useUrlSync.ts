'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useCallback } from 'react'
import { AdvancedFilterValues } from '@/lib/types/search'
import type { SearchQuery } from '@/lib/validators/search-query'

/**
 * FASE 14.1.2: URL State Sync Hook
 * Synchronizes search filters bidirectionally with URL query parameters.
 *
 * - On mount: Hydrates filter state from URL (if present)
 * - On filter change: Updates URL to match applied filters
 * - Supports refresh, browser back/forward, and URL sharing
 *
 * Architecture:
 * - URL is the single source of truth for APPLIED filters
 * - Component state can have DRAFT filters (not yet applied)
 * - Only onApply() commits to URL
 */
export interface UseUrlSyncReturn {
  /** Hydrated filters from URL query params (or empty if none) */
  initialFilters: AdvancedFilterValues & { q?: string; status?: string[]; priority?: string[] }
  /** Sync filters to URL after applying */
  syncToUrl: (filters: AdvancedFilterValues, searchTerm?: string, status?: string[], priority?: string[]) => void
  /** Clear all filters from URL */
  clearUrl: () => void
}

export function useUrlSync(): UseUrlSyncReturn {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Hydrate from URL on mount
  const initialFilters = useCallback(() => {
    return {
      q: searchParams.get('q') || undefined,
      status: searchParams.get('status')?.split(',').filter(Boolean) || undefined,
      priority: searchParams.get('priority')?.split(',').filter(Boolean) || undefined,
      severity: searchParams.get('severity')?.split(',').filter(Boolean) || undefined,
      assignee: searchParams.get('assignee')?.split(',').filter(Boolean) || undefined,
      project: searchParams.get('project')?.split(',').filter(Boolean) || undefined,
      dateType: (searchParams.get('dateType') as any) || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      hasEvidence: (searchParams.get('hasEvidence') as any) || undefined,
    }
  }, [searchParams])

  const syncToUrl = useCallback(
    (filters: AdvancedFilterValues, searchTerm?: string, status?: string[], priority?: string[]) => {
      const params = new URLSearchParams()

      // Search term
      if (searchTerm) params.append('q', searchTerm)

      // Status filter
      if (status?.length) params.append('status', status.join(','))

      // Priority filter
      if (priority?.length) params.append('priority', priority.join(','))

      // Advanced filters (from AdvancedFilterValues)
      if (filters.severity?.length) params.append('severity', filters.severity.join(','))
      if (filters.assignee?.length) params.append('assignee', filters.assignee.join(','))
      if (filters.project?.length) params.append('project', filters.project.join(','))

      // Date filters
      if (filters.dateType && filters.dateType !== 'created') {
        params.append('dateType', filters.dateType)
      }
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.append('dateTo', filters.dateTo)

      // Evidence filter
      if (filters.hasEvidence && filters.hasEvidence !== 'any') {
        params.append('hasEvidence', filters.hasEvidence)
      }

      const queryString = params.toString()
      const newUrl = queryString ? `/findings?${queryString}` : '/findings'

      // Use replace to avoid creating unnecessary history entries for intermediate states
      // But applied filters are real navigation points
      router.replace(newUrl, { scroll: false })
    },
    [router]
  )

  const clearUrl = useCallback(() => {
    router.replace('/findings', { scroll: false })
  }, [router])

  return {
    initialFilters: initialFilters(),
    syncToUrl,
    clearUrl,
  }
}
