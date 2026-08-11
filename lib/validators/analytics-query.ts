import { z } from 'zod'

const commaSeparatedArray = (val: unknown): string[] | undefined => {
  if (!val) return undefined
  if (typeof val !== 'string') return undefined
  return val.split(',').map((item) => item.trim()).filter(Boolean)
}

export type AnalyticsQuery = {
  from?: string
  to?: string
  status?: string[]
  priority?: string[]
  severity?: string[]
  projectId?: string
  granularity?: 'day' | 'week'
}

export const AnalyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),

  status: z
    .string()
    .optional()
    .transform(commaSeparatedArray)
    .refine(
      (val) =>
        !val ||
        val.every((s) =>
          [
            'OPEN',
            'TRIAGED',
            'IN_PROGRESS',
            'READY_FOR_VALIDATION',
            'VALIDATED',
            'CLOSED',
            'BLOCKED',
            'REOPENED',
          ].includes(s),
        ),
      'Invalid status value',
    ),

  priority: z
    .string()
    .optional()
    .transform(commaSeparatedArray)
    .refine(
      (val) =>
        !val || val.every((p) => ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(p)),
      'Invalid priority value',
    ),

  severity: z
    .string()
    .optional()
    .transform(commaSeparatedArray)
    .refine(
      (val) =>
        !val ||
        val.every((s) => ['COSMETIC', 'MINOR', 'MAJOR', 'BLOCKER'].includes(s)),
      'Invalid severity value',
    ),

  projectId: z.string().optional(),

  granularity: z.enum(['day', 'week']).optional().default('day'),
})
