import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const rbacMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/auth/lucia', () => ({
  getSession: rbacMocks.getSession,
}))

import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

function makeRequest(url = 'http://127.0.0.1:3000/api/anything') {
  return new Request(url) as unknown as NextRequest
}

function sessionFor(role: string) {
  return { session: { id: 'sess-1' }, user: { id: 'user-1', email: 'x@y.z', name: 'X', role } }
}

describe('checkRBAC — invariante de autorización', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // C-03 root cause: `requireAuth: false` + allowedRoles no vacío == ruta pública.
  it('exige sesión cuando allowedRoles no está vacío, aunque requireAuth sea false', async () => {
    rbacMocks.getSession.mockResolvedValue(null)

    const { valid, error } = await checkRBAC(makeRequest(), {
      requireAuth: false,
      allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
    })

    expect(valid).toBe(false)
    expect(error?.status).toBe(401)
  })

  it('exige sesión con allowedRoles no vacío incluso si getSession devuelve un objeto sin user', async () => {
    rbacMocks.getSession.mockResolvedValue({ session: null, user: null })

    const { valid, error } = await checkRBAC(makeRequest(), {
      requireAuth: false,
      allowedRoles: ['OWNER'] as any,
    })

    expect(valid).toBe(false)
    expect(error?.status).toBe(401)
  })

  it('sigue permitiendo el anonimato SOLO cuando requireAuth es false y allowedRoles está vacío', async () => {
    rbacMocks.getSession.mockResolvedValue(null)

    const { valid, user, error } = await checkRBAC(makeRequest(), {
      requireAuth: false,
    })

    expect(valid).toBe(true)
    expect(error).toBeUndefined()
    expect(user).toBeUndefined()
  })

  it('devuelve 401 sin sesión con las opciones por defecto', async () => {
    rbacMocks.getSession.mockResolvedValue(null)

    const { valid, error } = await checkRBAC(makeRequest(), {})

    expect(valid).toBe(false)
    expect(error?.status).toBe(401)
  })

  it('devuelve 403 cuando el rol autenticado no está en allowedRoles', async () => {
    rbacMocks.getSession.mockResolvedValue(sessionFor('VIEWER'))

    const { valid, error } = await checkRBAC(makeRequest(), {
      allowedRoles: RBAC_PERMISSIONS.VIEW_AUDIT_LOG_ANY,
    })

    expect(valid).toBe(false)
    expect(error?.status).toBe(403)
  })

  it('devuelve 403 con requireAuth:false y rol autenticado no permitido', async () => {
    rbacMocks.getSession.mockResolvedValue(sessionFor('VIEWER'))

    const { valid, error } = await checkRBAC(makeRequest(), {
      requireAuth: false,
      allowedRoles: RBAC_PERMISSIONS.VIEW_AUDIT_LOG_ANY,
    })

    expect(valid).toBe(false)
    expect(error?.status).toBe(403)
  })

  it('permite el paso cuando el rol autenticado está en allowedRoles', async () => {
    rbacMocks.getSession.mockResolvedValue(sessionFor('OWNER'))

    const { valid, user, error } = await checkRBAC(makeRequest(), {
      allowedRoles: RBAC_PERMISSIONS.VIEW_AUDIT_LOG_ANY,
    })

    expect(valid).toBe(true)
    expect(error).toBeUndefined()
    expect(user?.role).toBe('OWNER')
  })

  it('permite a todos los roles de VIEW_ALL_FINDINGS leer hallazgos', async () => {
    for (const role of RBAC_PERMISSIONS.VIEW_ALL_FINDINGS) {
      rbacMocks.getSession.mockResolvedValue(sessionFor(role))
      const { valid } = await checkRBAC(makeRequest(), {
        allowedRoles: RBAC_PERMISSIONS.VIEW_ALL_FINDINGS,
      })
      expect(valid, `rol ${role} debería poder leer hallazgos`).toBe(true)
    }
  })
})
