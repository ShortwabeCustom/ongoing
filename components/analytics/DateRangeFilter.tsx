'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { endOfDay, startOfDay, subDays } from 'date-fns'
import { DatePicker } from '@/components/ui/DatePicker'
import {
  dateStringToUTCRange,
  isoDateTimeToDateStringInTimezone,
} from '@/lib/utils/timezone'

const PRESETS = [
  { label: 'Hoy', days: 0 },
  { label: 'Últimos 7 días', days: 7 },
  { label: 'Últimos 30 días', days: 30 },
  { label: 'Últimos 90 días', days: 90 },
]

export function DateRangeFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePreset = useCallback(
    (days: number) => {
      const params = new URLSearchParams(searchParams)
      const to = endOfDay(new Date()).toISOString()
      const from = startOfDay(subDays(new Date(), days)).toISOString()

      params.set('from', from)
      params.set('to', to)

      router.push(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  const handleDateChange = useCallback(
    (field: 'from' | 'to', value: string) => {
      const params = new URLSearchParams(searchParams)

      if (value) {
        const [startUTC, endUTC] = dateStringToUTCRange(
          value,
          'America/Mexico_City'
        )

        params.set(
          field,
          field === 'from' ? startUTC : endUTC
        )
      } else {
        params.delete(field)
      }

      router.push(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  const from = searchParams.get('from')
  const to = searchParams.get('to')

  return (
    <div className="pm-card-subtle space-y-4 p-4">
      <div>
        <p className="mb-3 text-sm font-semibold text-[#3b4b43]">
          Presets rápidos
        </p>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePreset(preset.days)}
              className="pm-chip px-3 text-xs font-semibold transition-colors hover:border-[#052b20]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[#dbe4dd] pt-4">
        <p className="mb-3 text-sm font-semibold text-[#3b4b43]">
          Rango personalizado
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DatePicker
            label="Desde"
            value={
              from
                ? isoDateTimeToDateStringInTimezone(from)
                : ''
            }
            onChange={(value) =>
              handleDateChange('from', value)
            }
          />

          <DatePicker
            label="Hasta"
            value={
              to
                ? isoDateTimeToDateStringInTimezone(to)
                : ''
            }
            onChange={(value) =>
              handleDateChange('to', value)
            }
          />
        </div>
      </div>
    </div>
  )
}
