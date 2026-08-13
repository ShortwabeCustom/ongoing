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

// FASE 14.1.3: Calculate date range for preset (timezone-aware)
// Dates are calculated in America/Mexico_City timezone (product timezone)
// Then converted to UTC for API/storage
// No hardcoded offsets; uses Intl.DateTimeFormat for accurate handling
import { getTodayInTimezone, formatDayStartAsUTC, formatDayEndAsUTC } from '@/lib/utils/timezone'

export function getDateRangeForPreset(
  preset: DatePreset,
  timezone = 'America/Mexico_City'
): [string, string] {
  // Get today's date in the product timezone
  const today = getTodayInTimezone(timezone)

  switch (preset) {
    case 'today': {
      const start = formatDayStartAsUTC(today)
      const end = formatDayEndAsUTC(today)
      return [start, end]
    }
    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const start = formatDayStartAsUTC(yesterday)
      const end = formatDayEndAsUTC(yesterday)
      return [start, end]
    }
    case 'last7days': {
      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      const start = formatDayStartAsUTC(sevenDaysAgo)
      const end = formatDayEndAsUTC(today)
      return [start, end]
    }
    case 'last30days': {
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
      const start = formatDayStartAsUTC(thirtyDaysAgo)
      const end = formatDayEndAsUTC(today)
      return [start, end]
    }
    case 'custom':
      return ['', '']
  }
}
