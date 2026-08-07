// Re-export Prisma types for convenience
export type {
  User,
  Project,
  ProjectMember,
  ProductVersion,
  TestSession,
  Finding,
  FindingIncidenceType,
  FindingExperienceTag,
  Evidence,
  Resolution,
  Validation,
  Comment,
  FindingStatusHistory,
  AuditLog,
  ImportBatch,
} from '@prisma/client'

export type {
  FindingStatus,
  FindingPriority,
  FindingSeverity,
  FindingEffort,
  IncidenceType,
  ExperienceTag,
  EvidenceType,
  ValidationResult,
  AuditAction,
  ImportStatus,
  UserRole,
} from '@prisma/client'

// Custom API Response Types
export interface ApiResponse<T = unknown> {
  data?: T
  error?: {
    code: string
    message: string
    fields?: Record<string, string[]>
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

// Session/Auth
export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
}
