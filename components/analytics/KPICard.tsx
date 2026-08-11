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
  default: 'bg-white border-[#dbe4dd]',
  success: 'bg-[#f0fbf4] border-[#b9dcca]',
  warning: 'bg-[#fff7e6] border-[#f4daa8]',
  danger: 'bg-[#fff0eb] border-[#f1c8bd]',
}

const textClasses = {
  default: 'text-[#052b20]',
  success: 'text-[#087244]',
  warning: 'text-[#85540d]',
  danger: 'text-[#9b321f]',
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
      className={`rounded-lg border p-5 shadow-[0_16px_45px_rgba(5,43,32,0.07)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(5,43,32,0.10)] ${variantClasses[variant]}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase text-[#65766e]">{label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className={`text-4xl font-semibold leading-none ${textClasses[variant]}`}>
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
          {subtext && <p className="mt-2 text-xs text-[#65766e]">{subtext}</p>}
        </div>
        {icon && <div className="text-2xl text-[#65766e]">{icon}</div>}
      </div>
    </div>
  )
}
