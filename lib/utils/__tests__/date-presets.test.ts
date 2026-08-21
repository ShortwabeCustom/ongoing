import { afterEach, describe, expect, it, vi } from 'vitest'

import { getUTCRangeForDaysBack, getUTCRangeForLastMonth, getUTCRangeForThisMonth } from '../date-presets'

const MEXICO_CITY_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', day: '2-digit' })

describe('getUTCRangeForDaysBack', () => {
  it('returns a same-day UTC range for daysBack = 0 (Hoy)', () => {
    const [start, end] = getUTCRangeForDaysBack(0)
    expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime())
    // A single calendar day in America/Mexico_City is at most 24h wide in UTC.
    const spanMs = new Date(end).getTime() - new Date(start).getTime()
    expect(spanMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
  })

  it('returns a wider span for 30 days back than for 7 days back', () => {
    const [start7] = getUTCRangeForDaysBack(7)
    const [start30] = getUTCRangeForDaysBack(30)
    expect(new Date(start30).getTime()).toBeLessThan(new Date(start7).getTime())
  })

  it('end of the 90-day range matches the end of the 0-day (Hoy) range', () => {
    const [, endToday] = getUTCRangeForDaysBack(0)
    const [, end90] = getUTCRangeForDaysBack(90)
    expect(end90).toBe(endToday)
  })
})

describe('getUTCRangeForThisMonth (Findings "Este mes")', () => {
  it('starts on the 1st of the current month and ends by today', () => {
    const [start, end] = getUTCRangeForThisMonth()
    expect(new Date(start).getTime()).toBeLessThanOrEqual(new Date(end).getTime())
    expect(MEXICO_CITY_DAY.format(new Date(start))).toBe('01')
  })

  it('end matches the end of the 0-day (Hoy) range', () => {
    const [, endThisMonth] = getUTCRangeForThisMonth()
    const [, endToday] = getUTCRangeForDaysBack(0)
    expect(endThisMonth).toBe(endToday)
  })
})

describe('getUTCRangeForLastMonth (Findings "Mes anterior")', () => {
  it('starts on the 1st of a month and ends before this month starts', () => {
    const [lastStart, lastEnd] = getUTCRangeForLastMonth()
    const [thisStart] = getUTCRangeForThisMonth()

    expect(MEXICO_CITY_DAY.format(new Date(lastStart))).toBe('01')
    expect(new Date(lastStart).getTime()).toBeLessThan(new Date(lastEnd).getTime())
    expect(new Date(lastEnd).getTime()).toBeLessThan(new Date(thisStart).getTime())
  })
})

describe('Timezone day boundary (FASE 6 "Ingresados hoy")', () => {
  const MEXICO_CITY_DATE = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('near 23:59 local time, "today" stays the current local calendar day (not tomorrow via naive UTC math)', () => {
    vi.useFakeTimers()
    // 05:55 UTC is ~23:55 the previous day in America/Mexico_City (UTC-6) —
    // a naive `new Date().toISOString().split('T')[0]` would read this as
    // the *next* UTC calendar day, one day ahead of the real local day.
    vi.setSystemTime(new Date('2026-08-20T05:55:00.000Z'))

    const expectedLocalDay = MEXICO_CITY_DATE.format(new Date())
    const [start] = getUTCRangeForDaysBack(0)
    expect(MEXICO_CITY_DATE.format(new Date(start))).toBe(expectedLocalDay)
  })

  it('just after local midnight, "today" is the new local calendar day (not still yesterday)', () => {
    vi.useFakeTimers()
    // 06:05 UTC is ~00:05 the same day in America/Mexico_City.
    vi.setSystemTime(new Date('2026-08-20T06:05:00.000Z'))

    const expectedLocalDay = MEXICO_CITY_DATE.format(new Date())
    const [start] = getUTCRangeForDaysBack(0)
    expect(MEXICO_CITY_DATE.format(new Date(start))).toBe(expectedLocalDay)
  })
})
