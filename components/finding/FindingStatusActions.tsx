'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AlertCircle, CheckCircle2, CircleDot, Lock, Play, RotateCcw } from 'lucide-react'
import type { FindingStatus } from '@/lib/generated/prisma/client'

type FindingStatusActionsProps = {
  findingId: string
  status: FindingStatus
  version: number
}

const TRANSITIONS: Record<FindingStatus, FindingStatus[]> = {
  OPEN: ['TRIAGED'],
  TRIAGED: ['IN_PROGRESS', 'OPEN', 'BLOCKED'],
  IN_PROGRESS: ['READY_FOR_VALIDATION', 'BLOCKED'],
  READY_FOR_VALIDATION: ['VALIDATED', 'IN_PROGRESS'],
  VALIDATED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  BLOCKED: ['IN_PROGRESS'],
  REOPENED: ['IN_PROGRESS'],
}

const LABELS: Record<FindingStatus, string> = {
  OPEN: 'Abierto',
  TRIAGED: 'Clasificado',
  IN_PROGRESS: 'En progreso',
  READY_FOR_VALIDATION: 'Por validar',
  VALIDATED: 'Validado',
  CLOSED: 'Cerrado',
  BLOCKED: 'Bloqueado',
  REOPENED: 'Reabierto',
}

const ICONS: Partial<Record<FindingStatus, typeof CircleDot>> = {
  TRIAGED: CircleDot,
  IN_PROGRESS: Play,
  READY_FOR_VALIDATION: CheckCircle2,
  VALIDATED: CheckCircle2,
  CLOSED: Lock,
  BLOCKED: AlertCircle,
  REOPENED: RotateCcw,
  OPEN: CircleDot,
}

export function FindingStatusActions({
  findingId,
  status,
  version,
}: FindingStatusActionsProps) {
  const router = useRouter()
  const [pendingStatus, setPendingStatus] = useState<FindingStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nextStatuses = TRANSITIONS[status] ?? []

  const transition = async (toStatus: FindingStatus) => {
    setPendingStatus(toStatus)
    setError(null)

    try {
      const response = await fetch(`/api/findings/${findingId}/transitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toStatus,
          version,
          reason: `UI transition: ${status} -> ${toStatus}`,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message ?? 'No se pudo cambiar el estado')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado')
    } finally {
      setPendingStatus(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white">
          {LABELS[status]}
        </span>

        {nextStatuses.map((next) => {
          const Icon = ICONS[next] ?? CircleDot
          return (
            <button
              key={next}
              type="button"
              onClick={() => transition(next)}
              disabled={Boolean(pendingStatus)}
              className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[#052b20] transition hover:bg-[#7bf0b1] disabled:opacity-50"
            >
              <Icon className="h-4 w-4" />
              {LABELS[next]}
            </button>
          )
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-[#f6b5aa] bg-[#fff1ee] px-3 py-2 text-sm text-[#9b321f]">
          {error}
        </p>
      )}
    </div>
  )
}
