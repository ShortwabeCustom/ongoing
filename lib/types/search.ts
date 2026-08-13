// FASE 14: Advanced filters and batch actions types
// FASE 14.1: Date intelligence types

export type DateFilterType = 'created' | 'updated' | 'imported' | 'session'
export type DatePreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom'

export interface AdvancedFilterValues {
  assignee?: string[]
  project?: string[]
  severity?: string[]
  dateType?: DateFilterType
  dateFrom?: string
  dateTo?: string
  datePreset?: DatePreset
  hasEvidence?: 'any' | 'with' | 'without'
}

export interface SearchHistoryEntry {
  id: string
  q: string
  status?: string[]
  priority?: string[]
  filters: AdvancedFilterValues
  timestamp: number
  resultCount?: number
}

export interface SavedFilterEntry {
  id: string
  name: string
  q?: string
  status?: string[]
  priority?: string[]
  filters: AdvancedFilterValues
  createdAt: number
  updatedAt: number
}

export interface LookupOption {
  id: string
  name: string
  avatar?: string
}

export interface BatchActionUpdate {
  status?: string
  priority?: string
  assigneeId?: string | null
  dueDate?: string | null
}

export interface BulkUpdateApiResult {
  updated: number
  failed: number
  results: Array<{
    id: string
    status?: string
    priority?: string
    severity?: string
    assigneeId?: string
    version?: number
    error?: string
  }>
}
