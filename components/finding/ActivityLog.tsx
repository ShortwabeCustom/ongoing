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
} from 'lucide-react'
import { WorkflowClient } from '@/lib/api/workflow-client'
import { toast } from '@/components/ui/use-toast'

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-[#65766e]" />
        <span className="ml-2 text-sm text-[#65766e]">Cargando historial...</span>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[#65766e]">
        No hay actividades registradas
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {logs.map((entry, index) => {
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

                {/* Details (if available) */}
                {entry.action === 'UPDATE' && entry.after && (
                  <div className="mt-2 text-xs text-[#65766e] space-y-1">
                    {Object.entries(entry.after).slice(0, 2).map(([key, value]) => (
                      <p key={key} className="truncate">
                        {key}: {String(value).substring(0, 30)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
