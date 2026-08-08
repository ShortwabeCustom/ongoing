'use client'

import { ResolutionState, getAllowedTransitions } from '@/lib/validators/workflow'

interface WorkflowStateIndicatorProps {
  state: ResolutionState
  variant?: 'badge' | 'expanded'
}

const STATE_COLORS: Record<ResolutionState, string> = {
  OPEN: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  TRIAGED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  INVESTIGATING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  PROPOSED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  IMPLEMENTED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  VERIFIED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
}

const STATE_LABELS: Record<ResolutionState, string> = {
  OPEN: 'Abierto',
  TRIAGED: 'Triaged',
  INVESTIGATING: 'Investigando',
  PROPOSED: 'Propuesto',
  APPROVED: 'Aprobado',
  IMPLEMENTED: 'Implementado',
  VERIFIED: 'Verificado',
  CLOSED: 'Cerrado',
}

export function WorkflowStateIndicator({
  state,
  variant = 'badge',
}: WorkflowStateIndicatorProps) {
  const nextStates = getAllowedTransitions(state)

  if (variant === 'expanded') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATE_COLORS[state]}`}
          >
            {STATE_LABELS[state]}
          </span>
        </div>

        {nextStates.length > 0 && (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <p className="font-semibold mb-1">Próximos estados:</p>
            <div className="flex flex-wrap gap-1">
              {nextStates.map((s) => (
                <span key={s} className="text-gray-500 dark:text-gray-500">
                  → {STATE_LABELS[s]}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATE_COLORS[state]}`}
      title={`Estado: ${STATE_LABELS[state]}`}
    >
      {STATE_LABELS[state]}
    </span>
  )
}
