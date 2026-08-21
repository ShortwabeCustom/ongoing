'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { format } from 'date-fns'

import { QuickDatePresets, type QuickDatePresetOption } from '@/components/filters/QuickDatePresets'
import { DateRangePicker, type DateRange } from '@/components/filters/DateRangePicker'
import { getUTCRangeForDaysBack } from '@/lib/utils/date-presets'
import { dateStringToUTCRange, isoDateTimeToDateStringInTimezone } from '@/lib/utils/timezone'

const TIMEZONE = 'America/Mexico_City'

const PRESETS: Array<QuickDatePresetOption & { daysBack: number }> = [
  { key: 'today', label: 'Hoy', daysBack: 0 },
  { key: '7d', label: 'Últimos 7 días', daysBack: 7 },
  { key: '30d', label: 'Últimos 30 días', daysBack: 30 },
  { key: '90d', label: 'Últimos 90 días', daysBack: 90 },
]

function dateStringToLocalDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00`)
}

/**
 * Replaces DateRangeFilter.tsx. Pure composition: title + QuickDatePresets +
 * DateRangePicker, reading/writing the existing `from`/`to` query params
 * (UTC ISO datetimes) so deep links keep working. No backend/service logic
 * lives here — the timezone-aware conversion reuses lib/utils/timezone.ts,
 * the same functions the previous implementation used.
 */
export function AnalysisPeriodPanel() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const activePresetKey = useMemo(() => {
    if (!from || !to) return undefined
    return PRESETS.find((preset) => {
      const [presetFrom, presetTo] = getUTCRangeForDaysBack(preset.daysBack, TIMEZONE)
      return presetFrom === from && presetTo === to
    })?.key
  }, [from, to])

  const pushRange = useCallback(
    (nextFrom?: string, nextTo?: string) => {
      const params = new URLSearchParams(searchParams)
      if (nextFrom) params.set('from', nextFrom)
      else params.delete('from')
      if (nextTo) params.set('to', nextTo)
      else params.delete('to')

      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const handlePreset = useCallback(
    (key: string) => {
      // FASE 6 (issue 1): clicking the already-active preset deactivates it
      // instead of being a no-op — clears from/to rather than reapplying
      // the same range, and never auto-selects a different preset.
      if (key === activePresetKey) {
        pushRange(undefined, undefined)
        return
      }
      const preset = PRESETS.find((p) => p.key === key)
      if (!preset) return
      const [nextFrom, nextTo] = getUTCRangeForDaysBack(preset.daysBack, TIMEZONE)
      pushRange(nextFrom, nextTo)
    },
    [activePresetKey, pushRange],
  )

  const dateRangeValue: DateRange = useMemo(
    () => ({
      from: from ? dateStringToLocalDate(isoDateTimeToDateStringInTimezone(from, TIMEZONE)) : undefined,
      to: to ? dateStringToLocalDate(isoDateTimeToDateStringInTimezone(to, TIMEZONE)) : undefined,
    }),
    [from, to],
  )

  const handleCustomRange = useCallback(
    (range: DateRange) => {
      if (!range.from) {
        pushRange(undefined, undefined)
        return
      }
      const fromString = format(range.from, 'yyyy-MM-dd')
      const toString = format(range.to ?? range.from, 'yyyy-MM-dd')
      const [startUTC] = dateStringToUTCRange(fromString, TIMEZONE)
      const [, endUTC] = dateStringToUTCRange(toString, TIMEZONE)
      pushRange(startUTC, endUTC)
    },
    [pushRange],
  )

  return (
    <div className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Periodo de análisis</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Contexto temporal del panel de analíticas.</p>
      </div>

      <QuickDatePresets presets={PRESETS} value={activePresetKey} onChange={handlePreset} />

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rango personalizado</p>
        <DateRangePicker value={dateRangeValue} onChange={handleCustomRange} />
      </div>
    </div>
  )
}
