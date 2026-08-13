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

// Utility: Calculate date range for preset
export function getDateRangeForPreset(preset: DatePreset): [string, string] {
  const now = new Date()
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
  const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)

  switch (preset) {
    case 'today': {
      const start = startOfDay(now)
      const end = endOfDay(now)
      return [start.toISOString(), end.toISOString()]
    }
    case 'yesterday': {
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const start = startOfDay(yesterday)
      const end = endOfDay(yesterday)
      return [start.toISOString(), end.toISOString()]
    }
    case 'last7days': {
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      const start = startOfDay(sevenDaysAgo)
      const end = endOfDay(now)
      return [start.toISOString(), end.toISOString()]
    }
    case 'last30days': {
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
      const start = startOfDay(thirtyDaysAgo)
      const end = endOfDay(now)
      return [start.toISOString(), end.toISOString()]
    }
    case 'custom':
      return ['', '']
  }
}
