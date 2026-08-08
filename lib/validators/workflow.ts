import { z } from 'zod'

// Resolution workflow states
export const ResolutionState = z.enum([
  'OPEN',
  'TRIAGED',
  'INVESTIGATING',
  'PROPOSED',
  'APPROVED',
  'IMPLEMENTED',
  'VERIFIED',
  'CLOSED',
])

export type ResolutionState = z.infer<typeof ResolutionState>

// Resolution state transitions (validation logic)
const STATE_TRANSITIONS: Record<ResolutionState, ResolutionState[]> = {
  OPEN: ['TRIAGED', 'OPEN'],
  TRIAGED: ['INVESTIGATING', 'OPEN'],
  INVESTIGATING: ['PROPOSED', 'OPEN'],
  PROPOSED: ['APPROVED', 'OPEN'],
  APPROVED: ['IMPLEMENTED', 'OPEN'],
  IMPLEMENTED: ['VERIFIED', 'OPEN'],
  VERIFIED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'],
}

// Create resolution request
export const CreateResolutionSchema = z.object({
  description: z.string().min(1).max(1000),
  assignedTo: z.string().optional(),
  evidence: z.array(z.string()).optional().default([]),
})

export type CreateResolutionInput = z.infer<typeof CreateResolutionSchema>

// Update resolution state
export const UpdateResolutionStateSchema = z.object({
  state: ResolutionState,
  notes: z.string().optional(),
  evidence: z.array(z.string()).optional().default([]),
})

export type UpdateResolutionStateInput = z.infer<typeof UpdateResolutionStateSchema>

// Validation result states
export const ValidationResult = z.enum(['PENDING', 'PASS', 'FAIL'])
export type ValidationResult = z.infer<typeof ValidationResult>

// Validation criterion
export const ValidationCriterion = z.object({
  id: z.string(),
  name: z.string(),
  passed: z.boolean().optional(),
  notes: z.string().optional(),
})

export type ValidationCriterion = z.infer<typeof ValidationCriterion>

// Create validation request
export const CreateValidationSchema = z.object({
  criteria: z.array(ValidationCriterion),
  evidence: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
})

export type CreateValidationInput = z.infer<typeof CreateValidationSchema>

// Check validation (run validation)
export const CheckValidationSchema = z.object({
  results: z.record(z.string(), z.boolean()), // { criterionId: passed }
  notes: z.string().optional(),
})

export type CheckValidationInput = z.infer<typeof CheckValidationSchema>

// Audit log action types
export const AuditAction = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'STATUS_CHANGE',
  'STATE_CHANGED',
  'EVIDENCE_ATTACHED',
  'VALIDATED',
  'REOPENED',
  'ASSIGN',
])

export type AuditAction = z.infer<typeof AuditAction>

// Audit log filter
export const AuditLogFilterSchema = z.object({
  action: z.string().optional(),
  userId: z.string().optional(),
  dateRange: z.tuple([z.date(), z.date()]).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
})

export type AuditLogFilter = z.infer<typeof AuditLogFilterSchema>

// Helper: Check if transition is valid
export function isValidTransition(
  from: ResolutionState,
  to: ResolutionState,
): boolean {
  return STATE_TRANSITIONS[from]?.includes(to) ?? false
}

// Helper: Get allowed next states
export function getAllowedTransitions(state: ResolutionState): ResolutionState[] {
  return STATE_TRANSITIONS[state] ?? []
}
