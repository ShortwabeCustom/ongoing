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
      <div className="pm-card flex h-96 items-center justify-center">
        <p className="text-sm font-medium text-[#65766e]">Cargando tendencias...</p>
      </div>
    )
  }

  if (!data?.created || data.created.length === 0) {
    return (
      <div className="pm-card flex h-96 items-center justify-center">
        <p className="text-sm font-medium text-[#65766e]">Sin datos disponibles</p>
      </div>
    )
  }

  const chartData = data.created.map((item, idx) => ({
    date: format(parseISO(item.date), 'dd MMM', { locale: es }),
    creados: item.count,
    cerrados: data.closed[idx]?.count ?? 0,
  }))

  return (
    <div className="pm-card p-6">
      <h3 className="mb-4 text-lg font-semibold text-[#17251f]">
        Tendencia de Hallazgos
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid stroke="#dbe4dd" strokeDasharray="3 3" />
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
              border: '1px solid #dbe4dd',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="creados"
            stroke="#ed765e"
            strokeWidth={3}
            name="Creados"
            dot={{ fill: '#ed765e', r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="cerrados"
            stroke="#00a85a"
            strokeWidth={3}
            name="Cerrados"
            dot={{ fill: '#00a85a', r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
