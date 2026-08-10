export interface AdvancedFilterValues {
  assignee: string[]
  project: string[]
  severity: string[]
  dateFrom?: string
  dateTo?: string
  hasEvidence?: boolean
}

export interface LookupOption {
  id: string
  name: string
  avatar?: string
}

export interface SearchQueryParams {
  q?: string
  status?: string[]
  priority?: string[]
  severity?: string[]
  assignee?: string[]
  project?: string[]
  dateFrom?: string
  dateTo?: string
  hasEvidence?: boolean
  limit?: number
  offset?: number
}
