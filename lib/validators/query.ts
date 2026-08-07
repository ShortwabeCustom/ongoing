import { z } from 'zod'

// Parse comma-separated query param into array
const commaSeparatedArray = (val: any): string[] | undefined => {
  if (!val) return undefined
  if (typeof val !== 'string') return undefined
  return val.split(',').filter(Boolean)
}

export const FindingsQuerySchema = z.object({
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

  area: z
    .string()
    .optional()
    .transform(commaSeparatedArray)
    .transform((val) => val?.map((a) => a.toUpperCase())),

  assigneeId: z.string().optional(),

  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),

  search: z.string().optional(),

  // Sort (single field with optional - prefix for descending)
  sort: z.string().optional().default('createdAt'),

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

export type FindingsQuery = z.infer<typeof FindingsQuerySchema>

// Parse sort parameter: "createdAt" or "-createdAt" (descending)
export function parseSort(sort: string | undefined) {
  if (!sort) return { createdAt: 'desc' as const }

  const isDescending = sort.startsWith('-')
  const field = isDescending ? sort.slice(1) : sort

  const validFields = ['createdAt', 'updatedAt', 'priority', 'status']
  if (!validFields.includes(field)) {
    return { createdAt: 'desc' as const }
  }

  const direction = isDescending ? 'desc' : 'asc'

  return {
    [field]: direction,
  }
}
