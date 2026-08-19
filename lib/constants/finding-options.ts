// FASE 14: Single source of truth for finding enums and their metadata

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

export const INCIDENCE_TYPE_OPTIONS = ['DESIGN', 'FUNCTIONALITY', 'BUSINESS_RULE', 'COPY'] as const

export const EXPERIENCE_TAG_OPTIONS = ['UI', 'UX', 'COPY', 'DEV'] as const

// Spanish labels
export const STATUS_LABELS_ES: Record<string, string> = {
  OPEN: 'Abierto',
  TRIAGED: 'Clasificado',
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

export const INCIDENCE_TYPE_LABELS_ES: Record<string, string> = {
  DESIGN: 'Diseño',
  FUNCTIONALITY: 'Funcionalidad',
  BUSINESS_RULE: 'Definición de negocio',
  COPY: 'Copy',
}

export const EXPERIENCE_TAG_LABELS_ES: Record<string, string> = {
  UI: 'UI',
  UX: 'UX',
  COPY: 'Copy',
  DEV: 'Dev',
}

// Tailwind color classes for badges
export const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 border-blue-300',
  TRIAGED: 'bg-purple-100 text-purple-800 border-purple-300',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  READY_FOR_VALIDATION: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  VALIDATED: 'bg-green-100 text-green-800 border-green-300',
  CLOSED: 'bg-gray-100 text-gray-800 border-gray-300',
  BLOCKED: 'bg-red-100 text-red-800 border-red-300',
  REOPENED: 'bg-orange-100 text-orange-800 border-orange-300',
}

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-800 border-slate-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
}

export const SEVERITY_COLORS: Record<string, string> = {
  COSMETIC: 'bg-blue-100 text-blue-800 border-blue-300',
  MINOR: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  MAJOR: 'bg-orange-100 text-orange-800 border-orange-300',
  BLOCKER: 'bg-red-100 text-red-800 border-red-300',
}
