'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface TrendChartProps {
  data?: {
    created: Array<{ date: string; count: number }>
    closed: Array<{ date: string; count: number }>
  }
  isLoading?: boolean
}

export function TrendChart({ data, isLoading }: TrendChartProps) {
  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border bg-gray-50">
        <p className="text-gray-500">Cargando tendencias...</p>
      </div>
    )
  }

  if (!data?.created || data.created.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border bg-gray-50">
        <p className="text-gray-500">Sin datos disponibles</p>
      </div>
    )
  }

  const chartData = data.created.map((item, idx) => ({
    date: format(parseISO(item.date), 'dd MMM', { locale: es }),
    creados: item.count,
    cerrados: data.closed[idx]?.count ?? 0,
  }))

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">
        Tendencia de Hallazgos
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #ccc',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="creados"
            stroke="#ef4444"
            strokeWidth={2}
            name="Creados"
            dot={{ fill: '#ef4444', r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="cerrados"
            stroke="#22c55e"
            strokeWidth={2}
            name="Cerrados"
            dot={{ fill: '#22c55e', r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
