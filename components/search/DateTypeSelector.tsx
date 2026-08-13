'use client'

import { DateFilterType } from '@/lib/types/search'
import { Calendar, Clock, FileDown, Zap } from 'lucide-react'

interface DateTypeSelectorProps {
  value?: DateFilterType
  onChange: (type: DateFilterType) => void
}

const DATE_TYPE_OPTIONS: Array<{
  value: DateFilterType
  label: string
  description: string
  icon: React.ReactNode
}> = [
  {
    value: 'created',
    label: 'Fecha de creación',
    description: 'Cuándo se registró el hallazgo',
    icon: <Calendar className="w-4 h-4" />,
  },
  {
    value: 'updated',
    label: 'Última actualización',
    description: 'Cuándo se modificó',
    icon: <Clock className="w-4 h-4" />,
  },
  {
    value: 'imported',
    label: 'Fecha de carga',
    description: 'Cuándo se importó a la plataforma',
    icon: <FileDown className="w-4 h-4" />,
  },
  {
    value: 'session',
    label: 'Fecha de prueba',
    description: 'A qué sesión pertenece',
    icon: <Zap className="w-4 h-4" />,
  },
]

export function DateTypeSelector({ value = 'created', onChange }: DateTypeSelectorProps) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-[#17251f] mb-3">Tipo de fecha</legend>

      <div className="space-y-2">
        {DATE_TYPE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-[#f3f5ef]"
            style={{
              borderColor: value === option.value ? '#00a85a' : '#dbe4dd',
              backgroundColor: value === option.value ? '#f0fdf4' : 'transparent',
            }}
          >
            <input
              type="radio"
              name="dateType"
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value as DateFilterType)}
              className="mt-1 w-4 h-4 cursor-pointer"
              style={{
                accentColor: '#00a85a',
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div style={{ color: value === option.value ? '#00a85a' : '#65766e' }}>
                  {option.icon}
                </div>
                <span className="text-sm font-medium text-[#17251f]">{option.label}</span>
              </div>
              <p className="text-xs text-[#65766e] mt-1">{option.description}</p>
            </div>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
