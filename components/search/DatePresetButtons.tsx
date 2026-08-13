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
import { getTodayInTimezone, dateStringToUTCRange } from '@/lib/utils/timezone'

export function getDateRangeForPreset(
  preset: DatePreset,
  timezone = 'America/Mexico_City'
): [string, string] {
  // Get today's date in the product timezone (returns UTC equivalent)
  const todayUtc = getTodayInTimezone(timezone)

  // Extract the calendar date from the UTC date
  // (This is the date in the timezone, not UTC)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(todayUtc)
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0')
  const month = String(parts.find(p => p.type === 'month')?.value || '01')
  const day = String(parts.find(p => p.type === 'day')?.value || '01')

  const todayString = `${year}-${month}-${day}`

  function dateStringMinusDays(dateStr: string, days: number): string {
    const d = new Date(dateStr)
    d.setDate(d.getDate() - days)
    return d.toISOString().split('T')[0]
  }

  switch (preset) {
    case 'today': {
      return dateStringToUTCRange(todayString, timezone)
    }
    case 'yesterday': {
      const yesterdayString = dateStringMinusDays(todayString, 1)
      return dateStringToUTCRange(yesterdayString, timezone)
    }
    case 'last7days': {
      const sevenDaysAgoString = dateStringMinusDays(todayString, 6)
      const [start] = dateStringToUTCRange(sevenDaysAgoString, timezone)
      const [, end] = dateStringToUTCRange(todayString, timezone)
      return [start, end]
    }
    case 'last30days': {
      const thirtyDaysAgoString = dateStringMinusDays(todayString, 29)
      const [start] = dateStringToUTCRange(thirtyDaysAgoString, timezone)
      const [, end] = dateStringToUTCRange(todayString, timezone)
      return [start, end]
    }
    case 'custom':
      return ['', '']
  }
}
