import { z } from 'zod'

export const FindingCreateSchema = z.object({
  observation: z.string().min(5, 'Min 5 characters').max(2000, 'Max 2000 characters'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  severity: z.enum(['COSMETIC', 'MINOR', 'MAJOR', 'BLOCKER']),
  effort: z.enum(['S', 'M', 'L', 'XL']),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.date().optional().nullable(),
  incidenceTypes: z.array(z.enum(['DESIGN', 'FUNCTIONALITY', 'BUSINESS_RULE', 'COPY'])).min(1, 'Select at least one type'),
  experienceTags: z.array(z.enum(['UI', 'UX', 'COPY'])).optional(),
  previousScreen: z.string().optional(),
  currentScreen: z.string().optional(),
  flowStep: z.string().optional(),
})

export const FindingUpdateSchema = FindingCreateSchema.extend({
  version: z.number().int().positive('Optimistic locking version required'),
}).partial()

export const FindingStatusTransitionSchema = z.object({
  toStatus: z.enum(['OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION', 'VALIDATED', 'CLOSED', 'BLOCKED', 'REOPENED']),
  reason: z.string().optional(),
  version: z.number().int().positive(),
})

export const FindingFilterSchema = z.object({
  status: z.enum(['OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION', 'VALIDATED', 'CLOSED', 'BLOCKED', 'REOPENED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  severity: z.enum(['COSMETIC', 'MINOR', 'MAJOR', 'BLOCKER']).optional(),
  incidenceType: z.enum(['DESIGN', 'FUNCTIONALITY', 'BUSINESS_RULE', 'COPY']).optional(),
  experienceTag: z.enum(['UI', 'UX', 'COPY']).optional(),
  assigneeId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

export type FindingCreate = z.infer<typeof FindingCreateSchema>
export type FindingUpdate = z.infer<typeof FindingUpdateSchema>
export type FindingStatusTransition = z.infer<typeof FindingStatusTransitionSchema>
export type FindingFilter = z.infer<typeof FindingFilterSchema>
