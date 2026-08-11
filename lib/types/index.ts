// Re-export Prisma types for convenience
export type {
  User,
  Project,
  ProjectMember,
  ProductVersion,
  TestSession,
  FindingIncidenceType,
  FindingExperienceTag,
  Resolution,
  Validation,
  Comment,
  FindingStatusHistory,
  AuditLog,
  ImportBatch,
} from '@/lib/generated/prisma/client'

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
} from '@/lib/generated/prisma/client'

import type {
  Evidence as PrismaEvidence,
  Finding as PrismaFinding,
  FindingExperienceTag,
  FindingIncidenceType,
} from '@/lib/generated/prisma/client'

export type Evidence = Omit<PrismaEvidence, 'url' | 'fileSize'> & {
  url?: string
  fileSize?: number | null
  uploadedAt?: Date | string
  urlExpiresAt?: Date | string
}

export type Finding = PrismaFinding & {
  title?: string
  description?: string
  area?: string
  evidence?: Evidence[]
  incidenceTypes?: FindingIncidenceType[]
  experienceTags?: FindingExperienceTag[]
}

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
