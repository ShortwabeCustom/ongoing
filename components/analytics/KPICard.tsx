import { ReactNode } from 'react'

interface KPICardProps {
  label: string
  value: string | number
  subtext?: string
  icon?: ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

const variantClasses = {
  default: 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200',
  success: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200',
  warning: 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200',
  danger: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200',
}

const textClasses = {
  default: 'text-slate-600',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  danger: 'text-red-600',
}

export function KPICard({
  label,
  value,
  subtext,
  icon,
  trend,
  variant = 'default',
}: KPICardProps) {
  return (
    <div
      className={`rounded-lg border p-6 ${variantClasses[variant]} transition-all hover:shadow-md`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className={`text-3xl font-bold ${textClasses[variant]}`}>
              {value}
            </p>
            {trend && (
              <span
                className={`text-sm font-medium ${
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {subtext && (
            <p className="mt-1 text-xs text-gray-500">{subtext}</p>
          )}
        </div>
        {icon && <div className="text-2xl text-gray-400">{icon}</div>}
      </div>
    </div>
  )
}
