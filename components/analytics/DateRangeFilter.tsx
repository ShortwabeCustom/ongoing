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
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <p className="mb-3 text-sm font-medium text-gray-700">Presets rápidos</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset.days)}
              className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <p className="mb-3 text-sm font-medium text-gray-700">Rango personalizado</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">
              Desde
            </label>
            <input
              type="date"
              value={from ? format(new Date(from), 'yyyy-MM-dd') : ''}
              onChange={(e) => handleDateChange('from', e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">
              Hasta
            </label>
            <input
              type="date"
              value={to ? format(new Date(to), 'yyyy-MM-dd') : ''}
              onChange={(e) => handleDateChange('to', e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
