'use client'

import { ResolutionState, getAllowedTransitions } from '@/lib/validators/workflow'

interface WorkflowStateIndicatorProps {
  state: ResolutionState
  variant?: 'badge' | 'expanded'
}

const STATE_COLORS: Record<ResolutionState, string> = {
  OPEN: 'bg-[#edf4ed] text-[#3d4d45]',
  TRIAGED: 'bg-[#e9f7ef] text-[#052b20]',
  INVESTIGATING: 'bg-[#fff8e8] text-[#85540d]',
  PROPOSED: 'bg-[#fff1ee] text-[#9b321f]',
  APPROVED: 'bg-[#eefbf2] text-[#0b5d38]',
  IMPLEMENTED: 'bg-[#e8f6f0] text-[#052b20]',
  VERIFIED: 'bg-[#dff8e8] text-[#0b5d38]',
  CLOSED: 'bg-[#17251f] text-white',
}

export const STATE_LABELS: Record<ResolutionState, string> = {
  OPEN: 'Abierto',
  TRIAGED: 'Triado',
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
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${STATE_COLORS[state]}`}
          >
            {STATE_LABELS[state]}
          </span>
        </div>

        {nextStates.length > 0 && (
          <div className="text-xs text-[#65766e]">
            <p className="font-semibold mb-1">Próximos estados:</p>
            <div className="flex flex-wrap gap-1">
              {nextStates.map((s) => (
                <span key={s} className="text-[#3d4d45]">
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
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${STATE_COLORS[state]}`}
      title={`Estado: ${STATE_LABELS[state]}`}
    >
      {STATE_LABELS[state]}
    </span>
  )
}
