/**
 * FASE 14.1.3: Timezone utilities for Mexico-based date calculations
 *
 * Product timezone: America/Mexico_City
 * Database/API: UTC (unchanged)
 *
 * Purpose: Convert local Mexico dates to UTC ranges for API queries
 */

/**
 * Get today's date in the specified timezone (not UTC)
 * @param timezone IANA timezone identifier (default: America/Mexico_City)
 * @returns Date object representing today at 00:00 in the timezone
 */
export function getTodayInTimezone(timezone: string = 'America/Mexico_City'): Date {
  const now = new Date()

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(now)
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value

  if (!year || !month || !day) {
    throw new Error('Failed to parse date components')
  }

  // Create date in local timezone (not UTC!)
  // This date will be used as the "base" for calculating start/end times
  const localDate = new Date(`${year}-${month}-${day}T00:00:00`)
  return localDate
}

/**
 * Format a local date as UTC ISO string (start of day)
 * @param localDate Date in local timezone (00:00 local time)
 * @returns ISO UTC string for start of that day
 */
export function formatDayStartAsUTC(localDate: Date): string {
  const year = localDate.getFullYear()
  const month = String(localDate.getMonth() + 1).padStart(2, '0')
  const day = String(localDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}T00:00:00.000Z`
}

/**
 * Format a local date as UTC ISO string (end of day)
 * @param localDate Date in local timezone (00:00 local time)
 * @returns ISO UTC string for end of that day
 */
export function formatDayEndAsUTC(localDate: Date): string {
  const year = localDate.getFullYear()
  const month = String(localDate.getMonth() + 1).padStart(2, '0')
  const day = String(localDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}T23:59:59.999Z`
}

/**
 * Validate if a string is a valid ISO datetime
 */
export function isValidISODateTime(dateString: string): boolean {
  if (typeof dateString !== 'string') return false
  try {
    const d = new Date(dateString)
    return !isNaN(d.getTime()) && dateString.includes('T')
  } catch {
    return false
  }
}

/**
 * Validate if a string is a valid date (YYYY-MM-DD)
 */
export function isValidDateString(dateString: string): boolean {
  if (typeof dateString !== 'string') return false
  const match = dateString.match(/^\d{4}-\d{2}-\d{2}$/)
  if (!match) return false
  const d = new Date(dateString)
  return !isNaN(d.getTime())
}
