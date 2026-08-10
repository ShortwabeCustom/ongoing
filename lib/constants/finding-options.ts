// FASE 14: Centralized source of truth for finding enums

export const FINDING_STATUS_OPTIONS = [
  'OPEN',
  'TRIAGED',
  'IN_PROGRESS',
  'READY_FOR_VALIDATION',
  'VALIDATED',
  'CLOSED',
  'BLOCKED',
  'REOPENED',
] as const

export const FINDING_PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export const FINDING_SEVERITY_OPTIONS = ['COSMETIC', 'MINOR', 'MAJOR', 'BLOCKER'] as const

export const STATUS_LABELS_ES: Record<string, string> = {
  OPEN: 'Abierto',
  TRIAGED: 'Triado',
  IN_PROGRESS: 'En progreso',
  READY_FOR_VALIDATION: 'Listo para validar',
  VALIDATED: 'Validado',
  CLOSED: 'Cerrado',
  BLOCKED: 'Bloqueado',
  REOPENED: 'Reabierto',
}

export const PRIORITY_LABELS_ES: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

export const SEVERITY_LABELS_ES: Record<string, string> = {
  COSMETIC: 'Cosmético',
  MINOR: 'Menor',
  MAJOR: 'Mayor',
  BLOCKER: 'Bloqueante',
}

// Colors for status badges (from SearchResultItem.tsx)
export const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  TRIAGED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  READY_FOR_VALIDATION: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  VALIDATED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CLOSED: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  BLOCKED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  REOPENED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export const SEVERITY_COLORS: Record<string, string> = {
  COSMETIC: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  MINOR: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  MAJOR: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  BLOCKER: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}
