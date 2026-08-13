import { z } from 'zod'

// Parse comma-separated query param into array
const commaSeparatedArray = (val: unknown): string[] | undefined => {
  if (!val) return undefined
  if (typeof val !== 'string') return undefined
  return val
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const idSchema = z.string().min(5).optional()

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
    .transform((val) => val?.map((a) => a.toUpperCase()))
    .refine(
      (val) => !val || val.every((tag) => ['UI', 'UX', 'COPY', 'DEV'].includes(tag)),
      'Invalid area value',
    ),

  incidenceType: z
    .string()
    .optional()
    .transform(commaSeparatedArray)
    .transform((val) => val?.map((item) => item.toUpperCase()))
    .refine(
      (val) => !val || val.every((item) => ['DESIGN', 'FUNCTIONALITY', 'BUSINESS_RULE', 'COPY'].includes(item)),
      'Invalid incidence type value',
    ),

  experienceTag: z
    .string()
    .optional()
    .transform(commaSeparatedArray)
    .transform((val) => val?.map((item) => item.toUpperCase()))
    .refine(
      (val) => !val || val.every((item) => ['UI', 'UX', 'COPY', 'DEV'].includes(item)),
      'Invalid experience tag value',
    ),

  assigneeId: idSchema,

  projectId: idSchema,
  testSessionId: idSchema,
  session: idSchema,
  screen: z.string().trim().min(1).max(200).optional(),

  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),

  search: z.string().trim().min(1).max(200).optional(),

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

  const validFields = ['createdAt', 'updatedAt', 'priority', 'severity', 'status', 'folio']
  if (!validFields.includes(field)) {
    return { createdAt: 'desc' as const }
  }

  const direction = isDescending ? 'desc' : 'asc'

  return {
    [field]: direction,
  }
}
