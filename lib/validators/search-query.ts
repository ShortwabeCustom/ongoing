import { z } from 'zod'

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

  assigneeId: z.string().optional(),

  projectId: z.string().optional(),

  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),

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
})

export type SearchQuery = z.infer<typeof SearchQuerySchema>
