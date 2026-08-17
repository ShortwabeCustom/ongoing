import { describe, it, expect, beforeEach, vi } from 'vitest'

const pageMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((url: string) => {
    const error: any = new Error(`NEXT_REDIRECT:${url}`)
    error.digest = `NEXT_REDIRECT;replace;${url};307;`
    throw error
  }),
  getInventoryStats: vi.fn(),
}))

vi.mock('@/lib/auth/lucia', () => ({
  getSession: pageMocks.getSession,
}))

vi.mock('next/navigation', () => ({
  redirect: pageMocks.redirect,
  notFound: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

vi.mock('@/lib/services/inventory-stats', () => ({
  getInventoryStats: pageMocks.getInventoryStats,
}))

import FindingsPage from '../findings/page'
import SearchPage from '../search/page'
import TestImportPage from '../test-import/page'
import AnalyticsPage from '../dashboard/analytics/page'
import ProfilePage from '../profile/page'

async function expectRedirectToLogin(run: () => Promise<unknown>) {
  await expect(run()).rejects.toThrow(/NEXT_REDIRECT/)
  const targets = pageMocks.redirect.mock.calls.map((c) => c[0])
  expect(targets.some((t) => String(t).startsWith('/login'))).toBe(true)
}

// C-03: /findings, /search, /test-import y /dashboard/analytics eran accesibles sin sesión.
describe('Protección de páginas privadas (C-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pageMocks.getInventoryStats.mockResolvedValue([])
  })

  it('/findings redirige a /login sin sesión', async () => {
    pageMocks.getSession.mockResolvedValue(null)
    await expectRedirectToLogin(() => FindingsPage())
  })

  it('/search redirige a /login sin sesión', async () => {
    pageMocks.getSession.mockResolvedValue(null)
    await expectRedirectToLogin(() => SearchPage())
  })

  it('/test-import redirige a /login sin sesión', async () => {
    pageMocks.getSession.mockResolvedValue(null)
    await expectRedirectToLogin(() => TestImportPage())
  })

  it('/dashboard/analytics redirige a /login sin sesión', async () => {
    pageMocks.getSession.mockResolvedValue(null)
    await expectRedirectToLogin(() =>
      AnalyticsPage({ searchParams: Promise.resolve({}) }),
    )
  })

  it('/profile sigue redirigiendo a /login sin sesión (comportamiento ya correcto)', async () => {
    pageMocks.getSession.mockResolvedValue(null)
    await expectRedirectToLogin(() => ProfilePage())
  })

  it('/findings NO redirige con una sesión VIEWER válida', async () => {
    pageMocks.getSession.mockResolvedValue({
      session: { id: 's' },
      user: { id: 'u', email: 'v@x.z', name: 'V', role: 'VIEWER' },
    })
    await expect(FindingsPage()).resolves.toBeTruthy()
    expect(pageMocks.redirect).not.toHaveBeenCalled()
  })

  it('/dashboard/analytics no manda a /login a un OWNER', async () => {
    pageMocks.getSession.mockResolvedValue({
      session: { id: 's' },
      user: { id: 'u', email: 'o@x.z', name: 'O', role: 'OWNER' },
    })
    await expect(
      AnalyticsPage({ searchParams: Promise.resolve({}) }),
    ).resolves.toBeTruthy()
    const targets = pageMocks.redirect.mock.calls.map((c) => String(c[0]))
    expect(targets.some((t) => t.startsWith('/login'))).toBe(false)
  })

  it('/dashboard/analytics no manda a un rol sin permiso a /login ni a un bundle estático', async () => {
    pageMocks.getSession.mockResolvedValue({
      session: { id: 's' },
      user: { id: 'u', email: 'v@x.z', name: 'V', role: 'VIEWER' },
    })
    await expect(
      AnalyticsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(/NEXT_REDIRECT|FORBIDDEN/)
    const targets = pageMocks.redirect.mock.calls.map((c) => String(c[0]))
    expect(targets.some((t) => t.startsWith('/login'))).toBe(false)
  })
})
