import { getTodayInTimezone, dateStringToUTCRange } from '@/lib/utils/timezone'

export interface DatePresetOption {
  key: string
  label: string
  /** Days back from today, inclusive of today (0 = today only). */
  daysBack: number
}

function dateStringMinusDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

/** Today's calendar date (YYYY-MM-DD) in `timezone`, shared by every preset below. */
function getTodayDateString(timezone: string): string {
  const todayUtc = getTodayInTimezone(timezone)

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(todayUtc)
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

/**
 * Generic version of DatePresetButtons' `getDateRangeForPreset`, parameterized
 * by day count so both Findings (7/30 days) and Analytics (7/30/90 days) share
 * one timezone-aware implementation instead of two.
 */
export function getUTCRangeForDaysBack(daysBack: number, timezone = 'America/Mexico_City'): [string, string] {
  const todayString = getTodayDateString(timezone)

  if (daysBack <= 0) {
    return dateStringToUTCRange(todayString, timezone)
  }

  const startString = dateStringMinusDays(todayString, daysBack)
  const [start] = dateStringToUTCRange(startString, timezone)
  const [, end] = dateStringToUTCRange(todayString, timezone)
  return [start, end]
}

/** From the 1st of the current calendar month through today. */
export function getUTCRangeForThisMonth(timezone = 'America/Mexico_City'): [string, string] {
  const todayString = getTodayDateString(timezone)
  const firstOfMonthString = `${todayString.slice(0, 7)}-01`
  const [start] = dateStringToUTCRange(firstOfMonthString, timezone)
  const [, end] = dateStringToUTCRange(todayString, timezone)
  return [start, end]
}

/** The full previous calendar month (1st through its last day). */
export function getUTCRangeForLastMonth(timezone = 'America/Mexico_City'): [string, string] {
  const todayString = getTodayDateString(timezone)
  const [year, month] = todayString.slice(0, 7).split('-').map(Number)
  // Day 0 of the current month is the last day of the previous month.
  const lastDayOfPrevMonth = new Date(Date.UTC(year, month - 1, 0))
  const prevYear = lastDayOfPrevMonth.getUTCFullYear()
  const prevMonth = String(lastDayOfPrevMonth.getUTCMonth() + 1).padStart(2, '0')
  const prevMonthLastDay = String(lastDayOfPrevMonth.getUTCDate()).padStart(2, '0')

  const firstOfPrevMonthString = `${prevYear}-${prevMonth}-01`
  const lastOfPrevMonthString = `${prevYear}-${prevMonth}-${prevMonthLastDay}`
  const [start] = dateStringToUTCRange(firstOfPrevMonthString, timezone)
  const [, end] = dateStringToUTCRange(lastOfPrevMonthString, timezone)
  return [start, end]
}
