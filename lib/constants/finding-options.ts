// Finding status options and labels
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

// Spanish labels
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

// Status colors (Tailwind)
export const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
  TRIAGED: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  IN_PROGRESS: 'bg-purple-50 text-purple-700 border-purple-200',
  READY_FOR_VALIDATION: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  VALIDATED: 'bg-green-50 text-green-700 border-green-200',
  CLOSED: 'bg-slate-50 text-slate-700 border-slate-200',
  BLOCKED: 'bg-red-50 text-red-700 border-red-200',
  REOPENED: 'bg-orange-50 text-orange-700 border-orange-200',
}

// Priority colors
export const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-blue-50 text-blue-700 border-blue-200',
  MEDIUM: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  HIGH: 'bg-red-50 text-red-700 border-red-200',
  CRITICAL: 'bg-red-900 text-red-50 border-red-950',
}

// Severity colors
export const SEVERITY_COLORS: Record<string, string> = {
  COSMETIC: 'bg-slate-50 text-slate-700 border-slate-200',
  MINOR: 'bg-blue-50 text-blue-700 border-blue-200',
  MAJOR: 'bg-orange-50 text-orange-700 border-orange-200',
  BLOCKER: 'bg-red-50 text-red-700 border-red-200',
}
