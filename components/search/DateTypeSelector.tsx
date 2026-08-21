'use client'

import { DateFilterType } from '@/lib/types/search'
import { Calendar, Clock, FileDown, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    icon: <Calendar className="size-4" />,
  },
  {
    value: 'updated',
    label: 'Última actualización',
    description: 'Cuándo se modificó',
    icon: <Clock className="size-4" />,
  },
  {
    value: 'imported',
    label: 'Fecha de carga',
    description: 'Cuándo se importó a la plataforma',
    icon: <FileDown className="size-4" />,
  },
  {
    value: 'session',
    label: 'Fecha de prueba',
    description: 'A qué sesión pertenece',
    icon: <Zap className="size-4" />,
  },
]

export function DateTypeSelector({ value = 'created', onChange }: DateTypeSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Tipo de fecha">
      {DATE_TYPE_OPTIONS.map((option) => {
        const checked = value === option.value
        return (
          <label
            key={option.value}
            className={cn(
              'flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-sm transition-colors',
              'cursor-pointer hover:bg-muted',
              checked ? 'border-primary bg-primary/5' : 'border-border',
            )}
          >
            <input
              type="radio"
              name="dateType"
              value={option.value}
              checked={checked}
              onChange={(e) => onChange(e.target.value as DateFilterType)}
              className="mt-0.5 size-4 cursor-pointer border-input text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className={checked ? 'text-primary' : 'text-muted-foreground'}>{option.icon}</span>
                <span className="font-medium text-foreground">{option.label}</span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
