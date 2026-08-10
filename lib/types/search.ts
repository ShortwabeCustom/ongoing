// FASE 14: Shared types for advanced search & batch operations

export interface AdvancedFilterValues {
  assignee?: string[]
  project?: string[]
  dateFrom?: string
  dateTo?: string
  hasEvidence?: boolean
  severity?: string[]
}

export interface FilterFacet {
  id: string
  doc_count: number
}

export interface LookupOption {
  id: string
  name: string
  avatar?: string
}

export interface BulkUpdateApiResult {
  updated: number
  failed: number
  results: Array<{
    id: string
    status?: string
    priority?: string
    severity?: string
    assigneeId?: string | null
    version?: number
    updatedAt?: string
    error?: string
  }>
}

export interface SearchHistoryEntry {
  id: string
  q: string
  status?: string[]
  priority?: string[]
  filters?: AdvancedFilterValues
  timestamp: number
  resultCount?: number
}

export interface SavedFilterEntry {
  id: string
  name: string
  q?: string
  status?: string[]
  priority?: string[]
  filters?: AdvancedFilterValues
  createdAt: number
  updatedAt: number
}
