'use client'

import { DatePreset } from '@/lib/types/search'

interface DatePresetButtonsProps {
  selectedPreset?: DatePreset
  onSelectPreset: (preset: DatePreset) => void
  onShowCustom: () => void
}

const PRESETS: Array<{ key: DatePreset; label: string }> = [
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'last7days', label: '7 días' },
  { key: 'last30days', label: '30 días' },
]

export function DatePresetButtons({
  selectedPreset,
  onSelectPreset,
  onShowCustom,
}: DatePresetButtonsProps) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-[#17251f] mb-3">Rango rápido</legend>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => onSelectPreset(preset.key)}
            className="px-3 py-2 text-sm font-medium rounded-lg border transition-all"
            style={{
              borderColor: selectedPreset === preset.key ? '#00a85a' : '#dbe4dd',
              backgroundColor: selectedPreset === preset.key ? '#00a85a' : 'white',
              color: selectedPreset === preset.key ? 'white' : '#17251f',
            }}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onShowCustom}
          className="px-3 py-2 text-sm font-medium rounded-lg border transition-all"
          style={{
            borderColor: selectedPreset === 'custom' ? '#00a85a' : '#dbe4dd',
            backgroundColor: selectedPreset === 'custom' ? '#00a85a' : 'white',
            color: selectedPreset === 'custom' ? 'white' : '#17251f',
          }}
        >
          Personalizado
        </button>
      </div>
    </fieldset>
  )
}

// FASE 14.1.2: Calculate date range for preset (UTC-based)
// All date calculations happen in UTC to ensure consistent behavior across timezones.
// Product timezone: UTC (see docs/OPERATIONS/production_status.md for rationale)
export function getDateRangeForPreset(preset: DatePreset): [string, string] {
  const nowUtc = new Date()

  const startOfDayUtc = (date: Date) => {
    const iso = date.toISOString()
    const [dateStr] = iso.split('T')
    return `${dateStr}T00:00:00.000Z`
  }

  const endOfDayUtc = (date: Date) => {
    const iso = date.toISOString()
    const [dateStr] = iso.split('T')
    return `${dateStr}T23:59:59.999Z`
  }

  switch (preset) {
    case 'today': {
      const start = startOfDayUtc(nowUtc)
      const end = endOfDayUtc(nowUtc)
      return [start, end]
    }
    case 'yesterday': {
      const yesterday = new Date(nowUtc)
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      const start = startOfDayUtc(yesterday)
      const end = endOfDayUtc(yesterday)
      return [start, end]
    }
    case 'last7days': {
      const sevenDaysAgo = new Date(nowUtc)
      sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6)
      const start = startOfDayUtc(sevenDaysAgo)
      const end = endOfDayUtc(nowUtc)
      return [start, end]
    }
    case 'last30days': {
      const thirtyDaysAgo = new Date(nowUtc)
      thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29)
      const start = startOfDayUtc(thirtyDaysAgo)
      const end = endOfDayUtc(nowUtc)
      return [start, end]
    }
    case 'custom':
      return ['', '']
  }
}
