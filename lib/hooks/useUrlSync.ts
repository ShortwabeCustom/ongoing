'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { AdvancedFilterValues } from '@/lib/types/search'
import { isValidISODateTime } from '@/lib/utils/timezone'

/**
 * FASE 14.1.3: URL State Sync Hook (Enhanced)
 * Synchronizes search filters bidirectionally with URL query parameters.
 *
 * - On mount: Hydrates filter state from URL (if present)
 * - On filter change: Updates URL to match applied filters
 * - Supports refresh, browser back/forward, and URL sharing
 * - Validates URL parameters to prevent invalid state
 *
 * Architecture:
 * - URL is the single source of truth for APPLIED filters
 * - Component state can have DRAFT filters (not yet applied)
 * - Only onApply() commits to URL via router.push()
 * - Browser back/forward works because we use push(), not replace()
 */
export interface UseUrlSyncReturn {
  /** Hydrated filters from URL query params (or empty if none) */
  initialFilters: AdvancedFilterValues & { q?: string; status?: string[]; priority?: string[] }
  /** Sync filters to URL after applying (uses push to create history entry) */
  syncToUrl: (filters: AdvancedFilterValues, searchTerm?: string, status?: string[], priority?: string[]) => void
  /** Clear all filters from URL (uses push to enable undo) */
  clearUrl: () => void
}

const VALID_DATE_TYPES = ['created', 'updated', 'imported', 'session'] as const

function isValidDateType(value: unknown): value is typeof VALID_DATE_TYPES[number] {
  return typeof value === 'string' && VALID_DATE_TYPES.includes(value as any)
}

export function useUrlSync(): UseUrlSyncReturn {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Hydrate from URL on mount (memoized to avoid recalculation)
  const initialFilters = useMemo(() => {
    const dateType = searchParams.get('dateType') ?? undefined
    const dateFrom = searchParams.get('dateFrom') ?? undefined
    const dateTo = searchParams.get('dateTo') ?? undefined
    const hasEvidenceRaw = searchParams.get('hasEvidence') ?? undefined

    return {
      q: searchParams.get('q') ?? undefined,
      status: searchParams.get('status')?.split(',').filter(Boolean) ?? undefined,
      priority: searchParams.get('priority')?.split(',').filter(Boolean) ?? undefined,
      severity: searchParams.get('severity')?.split(',').filter(Boolean) ?? undefined,
      testSessionIds: searchParams.get('testSessionIds')?.split(',').filter(Boolean) ?? undefined,
      experienceTags: searchParams.get('experienceTags')?.split(',').filter(Boolean) ?? undefined,
      incidenceTypes: searchParams.get('incidenceTypes')?.split(',').filter(Boolean) ?? undefined,
      recent: searchParams.get('recent') === 'true' || undefined,
      assignee: searchParams.get('assignee')?.split(',').filter(Boolean) ?? undefined,
      project: searchParams.get('project')?.split(',').filter(Boolean) ?? undefined,
      // FASE 14.1.3: Validate dateType enum
      dateType: isValidDateType(dateType) ? dateType : undefined,
      // FASE 14.1.3: Validate date ISO format
      dateFrom: isValidISODateTime(dateFrom ?? '') ? dateFrom : undefined,
      dateTo: isValidISODateTime(dateTo ?? '') ? dateTo : undefined,
      hasEvidence: hasEvidenceRaw as 'any' | 'with' | 'without' | undefined,
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
      if (filters.testSessionIds?.length) params.append('testSessionIds', filters.testSessionIds.join(','))
      if (filters.experienceTags?.length) params.append('experienceTags', filters.experienceTags.join(','))
      if (filters.incidenceTypes?.length) params.append('incidenceTypes', filters.incidenceTypes.join(','))
      if (filters.recent) params.append('recent', 'true')
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

      // FASE 14.1.3: Use push() to create history entry
      // This enables browser back/forward navigation
      // Applied filters are intentional user actions, so they should be in history
      router.push(newUrl, { scroll: false })
    },
    [router]
  )

  const clearUrl = useCallback(() => {
    // FASE 14.1.3: Use push() so clearing filters can be undone via browser back
    router.push('/findings', { scroll: false })
  }, [router])

  return {
    initialFilters,
    syncToUrl,
    clearUrl,
  }
}
