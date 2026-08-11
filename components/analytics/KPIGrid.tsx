'use client'

import { KPICard } from './KPICard'
import { useAnalytics } from '@/lib/hooks/useAnalytics'
import { AnalyticsQuery } from '@/lib/validators/analytics-query'

interface KPIGridProps {
  initialData?: any
  filters?: AnalyticsQuery
}

export function KPIGrid({ initialData, filters = { granularity: 'day' } }: KPIGridProps) {
  const { data, isLoading, error } = useAnalytics({
    initialData,
    filters,
    refreshInterval: 60000,
  })

  if (error) {
    return (
      <div className="rounded-lg border border-[#f1c8bd] bg-[#fff0eb] p-4 text-[#9b321f]">
        Error al cargar métricas: {error}
      </div>
    )
  }

  const kpis = data?.kpis || {
    total: 0,
    open: 0,
    closed: 0,
    avgResolutionTimeDays: 0,
    validationPassRate: 0,
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
      <KPICard
        label="Hallazgos totales"
        value={kpis.total}
        variant="default"
      />
      <KPICard
        label="Abiertos"
        value={kpis.open}
        variant="danger"
      />
      <KPICard
        label="Cerrados"
        value={kpis.closed}
        variant="success"
      />
      <KPICard
        label="Tiempo promedio (días)"
        value={kpis.avgResolutionTimeDays.toFixed(1)}
        variant="default"
      />
      <KPICard
        label="Tasa de validación"
        value={`${kpis.validationPassRate.toFixed(0)}%`}
        variant="success"
      />
    </div>
  )
}
