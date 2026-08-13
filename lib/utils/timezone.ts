/**
 * FASE 14.1.3: Timezone utilities for Mexico-based date calculations
 *
 * Product timezone: America/Mexico_City
 * Database/API: UTC (unchanged)
 *
 * Purpose: Convert local Mexico dates to UTC ranges for API queries
 *
 * CRITICAL FIX (Session 8):
 * - getTodayInTimezone() now returns a Date that represents the same instant
 *   in UTC, independent of browser timezone
 * - formatDayStartAsUTC() and formatDayEndAsUTC() use UTC methods to ensure
 *   consistent formatting regardless of browser timezone
 * - dateStringToUTCRange() properly converts YYYY-MM-DD input to UTC with
 *   timezone-aware offset calculation
 */

/**
 * Calculate timezone offset from UTC for the given timezone at the given date
 * @param date Reference date (used to handle DST changes)
 * @param timezone IANA timezone identifier
 * @returns Offset in milliseconds (positive = ahead of UTC)
 */
function getTimezoneOffsetMs(date: Date, timezone: string): number {
  // Get the date parts in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0')
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0')
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0')

  // Create a date interpreted in browser's local timezone using these components
  const localDate = new Date(year, month, day, hour, minute, second)

  // The offset is the difference between the UTC date and the local interpretation
  return date.getTime() - localDate.getTime()
}

/**
 * Get today's date in the specified timezone
 * @param timezone IANA timezone identifier (default: America/Mexico_City)
 * @returns Date object representing midnight UTC that corresponds to today 00:00 in the timezone
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
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0')
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0')
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0')

  if (!year || !month || !day) {
    throw new Error('Failed to parse date components')
  }

  // Calculate offset for this date (handles DST correctly)
  const offset = getTimezoneOffsetMs(now, timezone)

  // Create a UTC date for midnight on this date, accounting for timezone offset
  // offset = UTC_time - timezone_time (positive if UTC is ahead, e.g., +6h for UTC-6)
  // To convert midnight in timezone to UTC: midnight_utc = midnight_tz + offset
  // Example: 2026-08-13 00:00 Mexico (UTC-6) = 2026-08-13 06:00 UTC (add +6h)
  const midnightUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
  const adjustedDate = new Date(midnightUTC.getTime() + offset)

  return adjustedDate
}

/**
 * Format a date as UTC ISO string (start of day in UTC)
 * Expects a Date that represents the UTC equivalent of midnight in the timezone
 * @param utcDate Date object representing a specific instant in UTC
 * @returns ISO UTC string for start of that instant
 */
export function formatDayStartAsUTC(utcDate: Date): string {
  const year = utcDate.getUTCFullYear()
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(utcDate.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}T00:00:00.000Z`
}

/**
 * Format a date as UTC ISO string (end of day in UTC)
 * Expects a Date that represents the UTC equivalent of midnight in the timezone
 * @param utcDate Date object representing a specific instant in UTC
 * @returns ISO UTC string for end of that day
 */
export function formatDayEndAsUTC(utcDate: Date): string {
  const year = utcDate.getUTCFullYear()
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(utcDate.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}T23:59:59.999Z`
}

/**
 * Convert a date string (YYYY-MM-DD) to UTC range accounting for timezone
 * @param dateString Date in YYYY-MM-DD format
 * @param timezone IANA timezone identifier
 * @returns [startUTC, endUTC] tuple of ISO strings
 */
export function dateStringToUTCRange(
  dateString: string,
  timezone: string = 'America/Mexico_City'
): [string, string] {
  if (!isValidDateString(dateString)) {
    throw new Error(`Invalid date string: ${dateString}`)
  }

  const [year, month, day] = dateString.split('-').map(Number)

  // Create UTC midnight for this date
  const midnightUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))

  // Calculate offset for this specific date (handles DST)
  // Use the midnight UTC as reference to calculate offset
  const offset = getTimezoneOffsetMs(midnightUTC, timezone)

  // Convert timezone midnight to UTC
  // Example: 2026-08-13 00:00 Mexico (UTC-6) = 2026-08-13 06:00 UTC (add +6h)
  const startInTimezone = new Date(midnightUTC.getTime() + offset)
  const endInTimezone = new Date(startInTimezone.getTime() + 24 * 60 * 60 * 1000 - 1)

  return [startInTimezone.toISOString(), endInTimezone.toISOString()]
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
