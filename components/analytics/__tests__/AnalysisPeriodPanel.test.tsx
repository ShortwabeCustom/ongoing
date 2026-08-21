import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AnalysisPeriodPanel } from '../AnalysisPeriodPanel'
import { getUTCRangeForDaysBack } from '@/lib/utils/date-presets'

afterEach(cleanup)

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
  }
  if (!('ResizeObserver' in window)) {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // @ts-expect-error jsdom has no ResizeObserver
    window.ResizeObserver = ResizeObserverMock
    global.ResizeObserver = ResizeObserverMock
  }
})

const pushMock = vi.fn()
let currentSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/dashboard/analytics',
  useSearchParams: () => currentSearchParams,
}))

beforeEach(() => {
  pushMock.mockClear()
  currentSearchParams = new URLSearchParams()
})

describe('AnalysisPeriodPanel', () => {
  it('marks "Últimos 30 días" as active when from/to already match its computed range', () => {
    const [from, to] = getUTCRangeForDaysBack(30)
    currentSearchParams = new URLSearchParams({ from, to })

    render(<AnalysisPeriodPanel />)

    expect(screen.getByRole('button', { name: /Últimos 30 días/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /Hoy/ }).getAttribute('aria-pressed')).toBe('false')
  })

  it('marks no preset as active for a custom range that matches none of them', () => {
    currentSearchParams = new URLSearchParams({
      from: '2020-01-01T00:00:00.000Z',
      to: '2020-02-15T23:59:59.999Z',
    })

    render(<AnalysisPeriodPanel />)

    for (const label of [/Hoy/, /Últimos 7 días/, /Últimos 30 días/, /Últimos 90 días/]) {
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('false')
    }
  })

  it('clicking a preset pushes from/to for /dashboard/analytics, never /findings', () => {
    render(<AnalysisPeriodPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }))

    expect(pushMock).toHaveBeenCalledTimes(1)
    const [url] = pushMock.mock.calls[0]
    expect(url.startsWith('/dashboard/analytics?')).toBe(true)
    expect(url).not.toContain('/findings')
    expect(url).toMatch(/from=/)
    expect(url).toMatch(/to=/)
  })

  describe('Preset toggle (FASE 6 issue 1)', () => {
    it('clicking the already-active preset deactivates it and clears from/to', () => {
      const [from, to] = getUTCRangeForDaysBack(30)
      currentSearchParams = new URLSearchParams({ from, to, status: 'OPEN' })
      render(<AnalysisPeriodPanel />)

      const button = screen.getByRole('button', { name: /Últimos 30 días/ })
      expect(button.getAttribute('aria-pressed')).toBe('true')

      fireEvent.click(button)

      const [url] = pushMock.mock.calls.at(-1)!
      const params = new URLSearchParams(url.split('?')[1])
      expect(params.has('from')).toBe(false)
      expect(params.has('to')).toBe(false)
      // Unrelated params (status, priority, projectId, assigneeId, severity) untouched.
      expect(params.get('status')).toBe('OPEN')
    })

    it('does not auto-activate a different preset when deactivating', () => {
      const [from, to] = getUTCRangeForDaysBack(7)
      currentSearchParams = new URLSearchParams({ from, to })
      render(<AnalysisPeriodPanel />)

      fireEvent.click(screen.getByRole('button', { name: /Últimos 7 días/ }))

      const [url] = pushMock.mock.calls.at(-1)!
      expect(url).not.toMatch(/from=|to=/)
    })

    it('clicking a different preset while one is active switches to the new one (not a toggle-off)', () => {
      const [from, to] = getUTCRangeForDaysBack(7)
      currentSearchParams = new URLSearchParams({ from, to })
      render(<AnalysisPeriodPanel />)

      fireEvent.click(screen.getByRole('button', { name: /Últimos 30 días/ }))

      const [url] = pushMock.mock.calls.at(-1)!
      const params = new URLSearchParams(url.split('?')[1])
      expect(params.has('from')).toBe(true)
      expect(params.has('to')).toBe(true)
      const [expectedFrom] = getUTCRangeForDaysBack(30)
      expect(params.get('from')).toBe(expectedFrom)
    })
  })

  it('preserves unrelated existing query params (e.g. status) when changing the period', () => {
    currentSearchParams = new URLSearchParams({ status: 'OPEN,TRIAGED' })
    render(<AnalysisPeriodPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Últimos 7 días' }))

    const [url] = pushMock.mock.calls[0]
    expect(url).toContain('status=OPEN%2CTRIAGED')
  })
})
