'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const statusLabels: Record<string, string> = {
  OPEN: 'Abierto',
  TRIAGED: 'Triado',
  IN_PROGRESS: 'En Progreso',
  READY_FOR_VALIDATION: 'Listo para Validar',
  VALIDATED: 'Validado',
  CLOSED: 'Cerrado',
  BLOCKED: 'Bloqueado',
  REOPENED: 'Reabierto',
}

interface StatusBreakdownChartProps {
  data?: Record<string, number>
  isLoading?: boolean
}

export function StatusBreakdownChart({
  data,
  isLoading,
}: StatusBreakdownChartProps) {
  if (isLoading) {
    return (
      <div className="pm-card flex h-80 items-center justify-center">
        <p className="text-sm font-medium text-[#65766e]">Cargando distribución...</p>
      </div>
    )
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="pm-card flex h-80 items-center justify-center">
        <p className="text-sm font-medium text-[#65766e]">Sin datos disponibles</p>
      </div>
    )
  }

  const chartData = Object.entries(data)
    .map(([status, count]) => ({
      status: statusLabels[status] || status,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="pm-card p-6">
      <h3 className="mb-4 text-lg font-semibold text-[#17251f]">
        Distribución por Estado
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData}>
          <CartesianGrid stroke="#dbe4dd" strokeDasharray="3 3" />
          <XAxis
            dataKey="status"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #dbe4dd',
              borderRadius: '8px',
            }}
          />
          <Bar dataKey="count" fill="#00a85a" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
