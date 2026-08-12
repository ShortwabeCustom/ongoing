'use client'

import { useState, useEffect } from 'react'
import { WorkflowClient } from '@/lib/api/workflow-client'
import { AuditLogFilter } from '@/lib/validators/workflow'
import { toast } from '@/components/ui/use-toast'

interface AuditTrailViewerProps {
  findingId: string
  limit?: number
  compact?: boolean
}

export function AuditTrailViewer({
  findingId,
  limit = 50,
  compact = false,
}: AuditTrailViewerProps) {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState<Partial<AuditLogFilter>>({
    limit,
    offset: 0,
  })

  useEffect(() => {
    loadAuditLog()
  }, [filter])

  const loadAuditLog = async () => {
    try {
      setIsLoading(true)
      const response = await WorkflowClient.getAuditLog(findingId, filter)

      if (response.status === 'success') {
        setLogs(response.data.items)
        setTotal(response.data.total)
      } else {
        toast({ title: 'Error', description: response.message })
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la auditoría' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const blob = await WorkflowClient.exportAuditLog(findingId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${findingId}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Listo', description: 'Auditoría exportada' })
    } catch {
      toast({ title: 'Error', description: 'No se pudo exportar' })
    }
  }

  if (compact && logs.length === 0) {
    return <p className="text-sm text-[#65766e]">Sin historial de auditoría</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-[#17251f]">Auditoría</h3>
        {!compact && (
          <button
            onClick={handleExport}
            disabled={isLoading}
            className="rounded-full bg-[#edf4ed] px-3 py-1 text-sm font-semibold text-[#17251f] transition hover:bg-[#dbe4dd] disabled:opacity-50"
          >
            Exportar CSV
          </button>
        )}
      </div>

      {/* Filter section */}
      {!compact && (
        <div className="flex gap-2 flex-wrap">
          <select
            value={filter.action ?? ''}
            onChange={(e) =>
              setFilter({ ...filter, action: e.target.value || undefined, offset: 0 })
            }
            className="pm-input h-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
          >
            <option value="">Todas las acciones</option>
            <option value="CREATE">Crear</option>
            <option value="UPDATE">Actualizar</option>
            <option value="STATUS_CHANGE">Cambio de estado</option>
            <option value="ASSIGN">Asignar</option>
            <option value="VALIDATE">Validar</option>
            <option value="RESOLVE">Resolver</option>
            <option value="IMPORT">Importar</option>
          </select>
        </div>
      )}

      {/* Audit log entries */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-[#65766e]">Cargando...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-[#65766e]">Sin eventos de auditoría</p>
        ) : (
          logs.slice(0, compact ? 5 : limit).map((log) => (
            <div key={log.id} className="space-y-1 rounded-lg border border-[#dbe4dd] bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[#17251f]">{log.action}</span>
                  {log.actor && (
                    <span className="ml-2 text-[#65766e]">
                      por {log.actor.name}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#65766e]">
                  {typeof log.createdAt === 'string' ? new Date(log.createdAt).toLocaleDateString('es-ES') : (log.createdAt instanceof Date ? log.createdAt.toLocaleDateString('es-ES') : '-')} {' '}
                  {typeof log.createdAt === 'string' ? new Date(log.createdAt).toLocaleTimeString('es-ES') : (log.createdAt instanceof Date ? log.createdAt.toLocaleTimeString('es-ES') : '-')}
                </span>
              </div>

              {(log.before || log.after) && (
                <div className="rounded bg-[#f7faf5] p-2 text-xs text-[#65766e]">
                  {log.before && log.after ? (
                    <div>
                      <span>Cambios: </span>
                      {Object.entries(log.after).map(([key, value]) => {
                        const before = log.before?.[key]
                        if (before === value) return null
                        return (
                          <div key={key}>
                            {key}: {before} → {value}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div>Sin cambios registrados</div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!compact && total > filter.limit! && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() =>
              setFilter({
                ...filter,
                offset: Math.max(0, (filter.offset ?? 0) - (filter.limit ?? 50)),
              })
            }
            disabled={isLoading || (filter.offset ?? 0) === 0}
            className="rounded-full border border-[#dbe4dd] px-3 py-1 text-sm font-semibold text-[#17251f] disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="flex items-center px-2 text-sm text-[#65766e]">
            Página {Math.floor((filter.offset ?? 0) / (filter.limit ?? 50)) + 1}
          </span>
          <button
            onClick={() =>
              setFilter({
                ...filter,
                offset:
                  ((filter.offset ?? 0) + (filter.limit ?? 50)) < total
                    ? (filter.offset ?? 0) + (filter.limit ?? 50)
                    : filter.offset,
              })
            }
            disabled={isLoading || ((filter.offset ?? 0) + (filter.limit ?? 50)) >= total}
            className="rounded-full border border-[#dbe4dd] px-3 py-1 text-sm font-semibold text-[#17251f] disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
