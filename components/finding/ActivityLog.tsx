'use client'

import { useEffect, useState } from 'react'
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Edit3,
  Clock,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import { WorkflowClient } from '@/lib/api/workflow-client'
import { toast } from '@/components/ui/use-toast'
import { getAuditChanges } from '@/lib/utils/audit-format'

interface ActivityLogProps {
  findingId: string
}

interface AuditLogEntry {
  id: string
  action: string
  actorId: string
  actor?: { name: string; email: string }
  before?: Record<string, any>
  after?: Record<string, any>
  createdAt: string
}

const ACTION_ICONS: Record<string, { icon: React.ReactNode; bg: string; label: string }> = {
  CREATE: {
    icon: <Plus className="h-5 w-5" />,
    bg: 'bg-[#d1fae5]',
    label: 'Creado'
  },
  STATUS_CHANGE: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    bg: 'bg-[#bfdbfe]',
    label: 'Estado actualizado'
  },
  UPDATE: {
    icon: <Edit3 className="h-5 w-5" />,
    bg: 'bg-[#fce7f3]',
    label: 'Actualizado'
  },
  ASSIGN: {
    icon: <UserPlus className="h-5 w-5" />,
    bg: 'bg-[#fef3c7]',
    label: 'Asignado'
  },
  VALIDATE: {
    icon: <AlertCircle className="h-5 w-5" />,
    bg: 'bg-[#e0e7ff]',
    label: 'Validado'
  },
  RESOLVE: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    bg: 'bg-[#d1fae5]',
    label: 'Resuelto'
  },
}

function getActionLabel(entry: AuditLogEntry): string {
  const config = ACTION_ICONS[entry.action] || { label: entry.action }

  if (entry.action === 'CREATE') {
    return 'Hallazgo creado'
  }

  if (entry.action === 'STATUS_CHANGE') {
    const before = entry.before?.status || 'OPEN'
    const after = entry.after?.status || 'OPEN'
    return `Status: ${before} → ${after}`
  }

  if (entry.action === 'ASSIGN') {
    const assignee = entry.after?.assignee?.name || 'Sin asignar'
    return `Asignado a ${assignee}`
  }

  if (entry.action === 'UPDATE') {
    return 'Detalles actualizados'
  }

  return config.label
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const isToday = date.toDateString() === today.toDateString()
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const day = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

  if (isToday) return `Hoy ${time}`
  if (isYesterday) return `Ayer ${time}`
  return `${day} ${time}`
}

export function ActivityLog({ findingId }: ActivityLogProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setIsLoading(true)
        const response = await WorkflowClient.getAuditLog(findingId, { limit: 20, offset: 0 })

        if (response.status === 'success') {
          setLogs(response.data.items || [])
        }
      } catch (error) {
        console.error('Error loading activity log:', error)
        toast({ title: 'Error', description: 'No se pudo cargar el historial' })
      } finally {
        setIsLoading(false)
      }
    }

    loadLogs()
  }, [findingId])

  return (
    <details className="group/history">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00a85a] focus-visible:ring-offset-4 [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="text-xl font-bold text-[#17251f]">Historial de actividades</h2>
          <p className="mt-1 text-sm text-[#65766e]">
            {isLoading
              ? 'Cargando actividades...'
              : logs.length === 0
                ? 'No hay actividades registradas'
                : `${logs.length} ${logs.length === 1 ? 'actividad registrada' : 'actividades registradas'}`}
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#edf4ed] text-[#17251f] transition group-open/history:rotate-180">
          <ChevronDown className="h-5 w-5" aria-hidden="true" />
        </span>
      </summary>

      <div className="mt-6 border-t border-[#dbe4dd] pt-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[#65766e]" />
            <span className="ml-2 text-sm text-[#65766e]">Cargando historial...</span>
          </div>
        ) : logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#65766e]">
            No hay actividades registradas
          </p>
        ) : (
          <div className="space-y-3">
      {(showAll ? logs : logs.slice(0, 5)).map((entry, index) => {
        const config = ACTION_ICONS[entry.action] || {
          icon: <Clock className="h-5 w-5" />,
          bg: 'bg-[#f3f4f6]',
          label: entry.action
        }
        const iconColor = entry.action === 'CREATE' ? 'text-[#059669]' :
                         entry.action === 'STATUS_CHANGE' ? 'text-[#2563eb]' :
                         entry.action === 'ASSIGN' ? 'text-[#d97706]' :
                         entry.action === 'UPDATE' ? 'text-[#db2777]' :
                         'text-[#6366f1]'

        return (
          <div
            key={entry.id || index}
            className="group rounded-lg border border-[#dbe4dd] bg-white p-4 transition hover:border-[#00a85a] hover:shadow-sm"
          >
            <div className="flex gap-3">
              {/* Icon */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.bg} ${iconColor}`}>
                {config.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#17251f]">
                      {getActionLabel(entry)}
                    </p>
                    <p className="text-xs text-[#65766e] mt-0.5">
                      {entry.actor?.name || entry.actor?.email || 'Sistema'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-[#65766e] whitespace-nowrap">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>

                {(entry.before != null || entry.after != null) && (
                  <details className="mt-3 text-xs text-[#65766e]">
                    <summary className="w-fit cursor-pointer font-semibold text-[#245342] hover:text-[#00a85a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00a85a]">
                      Ver detalles
                    </summary>
                    <div className="mt-2 space-y-1 rounded-lg bg-[#f7faf5] p-3">
                      {entry.before != null && entry.after != null ? (
                        getAuditChanges(entry.before, entry.after).length > 0 ? (
                          getAuditChanges(entry.before, entry.after).map((change) => (
                            <p key={change.key}>
                              <span className="font-semibold text-[#17251f]">{change.key}:</span>{' '}
                              {change.before} → {change.after}
                            </p>
                          ))
                        ) : (
                          <p>Sin cambios en los campos auditados</p>
                        )
                      ) : (
                        <p>Sin cambios registrados</p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        )
      })}

            {logs.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAll((current) => !current)}
                className="mt-4 inline-flex h-10 items-center rounded-full border border-[#9baba3] px-4 text-sm font-semibold text-[#17251f] transition hover:border-[#00a85a] hover:bg-[#edf4ed] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00a85a] focus-visible:ring-offset-2"
              >
                {showAll ? 'Mostrar menos' : `Ver todo el historial (${logs.length})`}
              </button>
            )}
          </div>
        )}
      </div>
    </details>
  )
}
