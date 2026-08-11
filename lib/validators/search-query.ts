import { z } from 'zod'

export type SearchQuery = {
  q?: string
  status?: string[]
  priority?: string[]
  severity?: string[]
  assignee?: string[]
  assigneeId?: string
  project?: string[]
  projectId?: string
  dateFrom?: string
  dateTo?: string
  createdAfter?: string
  createdBefore?: string
  hasEvidence?: boolean | 'any' | 'with' | 'without'
  limit?: number
  offset?: number
  _forceSearch?: boolean
}

// Parse comma-separated query param into array
const commaSeparatedArray = (val: any): string[] | undefined => {
  if (!val) return undefined
  if (typeof val !== 'string') return undefined
  return val.split(',').filter(Boolean)
}

export const SearchQuerySchema = z.object({
  // Full-text search term
  q: z.string().optional(),

  // Filters (all optional, comma-separated for array values)
  status: z
    .string()
    .optional()
    .transform(commaSeparatedArray)
    .refine(
      (val) => !val || val.every((s) => ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION', 'VALIDATED', 'CLOSED', 'BLOCKED', 'REOPENED'].includes(s)),
      'Invalid status value',
    ),

  priority: z
    .string()
    .optional()
    .transform(commaSeparatedArray)
    .refine(
      (val) => !val || val.every((p) => ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(p)),
      'Invalid priority value',
    ),

  severity: z
    .string()
    .optional()
    .transform(commaSeparatedArray)
    .refine(
      (val) => !val || val.every((s) => ['COSMETIC', 'MINOR', 'MAJOR', 'BLOCKER'].includes(s)),
      'Invalid severity value',
    ),

  // FASE 14: Multiple assignees support (backward compatible with assigneeId)
  assignee: z
    .string()
    .optional()
    .transform(commaSeparatedArray),

  assigneeId: z.string().optional(),

  // FASE 14: Multiple projects support (backward compatible with projectId)
  project: z
    .string()
    .optional()
    .transform(commaSeparatedArray),

  projectId: z.string().optional(),

  // FASE 14: Date range support
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),

  // Backward compatible with old param names
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),

  // FASE 14: Filter by evidence presence
  hasEvidence: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined
      return val === 'true' || val === '1'
    }),

  // Pagination
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => val >= 1 && val <= 100, 'Limit must be between 1 and 100'),

  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .refine((val) => val >= 0, 'Offset must be non-negative'),

  // Internal flag to force loading results even without filters
  _forceSearch: z.boolean().optional(),
}).transform((data) => {
  // Normalize: use new params if provided, fall back to old params
  return {
    ...data,
    assignee: data.assignee || (data.assigneeId ? [data.assigneeId] : undefined),
    project: data.project || (data.projectId ? [data.projectId] : undefined),
    dateFrom: data.dateFrom || data.createdAfter,
    dateTo: data.dateTo || data.createdBefore,
  }
})
