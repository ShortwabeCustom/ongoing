'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { subDays, startOfDay, endOfDay, format } from 'date-fns'

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
        params.set(field, new Date(value).toISOString())
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
        <p className="mb-3 text-sm font-semibold text-[#3b4b43]">Presets rápidos</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset.days)}
              className="pm-chip px-3 text-xs font-semibold transition-colors hover:border-[#052b20]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[#dbe4dd] pt-4">
        <p className="mb-3 text-sm font-semibold text-[#3b4b43]">Rango personalizado</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#65766e]">
              Desde
            </label>
            <input
              type="date"
              value={from ? format(new Date(from), 'yyyy-MM-dd') : ''}
              onChange={(e) => handleDateChange('from', e.target.value)}
              className="pm-input mt-1 h-10 w-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#65766e]">
              Hasta
            </label>
            <input
              type="date"
              value={to ? format(new Date(to), 'yyyy-MM-dd') : ''}
              onChange={(e) => handleDateChange('to', e.target.value)}
              className="pm-input mt-1 h-10 w-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
