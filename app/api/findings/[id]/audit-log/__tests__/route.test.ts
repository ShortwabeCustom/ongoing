import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const auditMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAuditLog: vi.fn(),
  exportAuditLog: vi.fn(),
}))

vi.mock('@/lib/auth/lucia', () => ({
  getSession: auditMocks.getSession,
}))

vi.mock('@/lib/services/audit-service', () => ({
  AuditService: {
    getAuditLog: auditMocks.getAuditLog,
    exportAuditLog: auditMocks.exportAuditLog,
  },
}))

import { GET as getAuditLog } from '../route'
import { GET as exportAuditLog } from '../export/route'

const FINDING_ID = 'cmswc3f5u0000to2sgyavp8xh'

function makeRequest(suffix = '') {
  return new NextRequest(
    `http://127.0.0.1:3000/api/findings/${FINDING_ID}/audit-log${suffix}`,
  )
}

const params = Promise.resolve({ id: FINDING_ID })

function sessionFor(role: string) {
  return { session: { id: 'sess-1' }, user: { id: 'user-1', email: 'x@y.z', name: 'X', role } }
}

describe('GET /api/findings/[id]/audit-log — contrato de autenticación (C-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditMocks.getAuditLog.mockResolvedValue({ items: [], total: 0 })
  })

  it('devuelve 401 a un anónimo', async () => {
    auditMocks.getSession.mockResolvedValue(null)

    const response = await getAuditLog(makeRequest(), { params })

    expect(response.status).toBe(401)
    expect(auditMocks.getAuditLog).not.toHaveBeenCalled()
  })

  it('devuelve 403 a un rol autenticado sin VIEW_AUDIT_LOG_ANY (VIEWER)', async () => {
    auditMocks.getSession.mockResolvedValue(sessionFor('VIEWER'))

    const response = await getAuditLog(makeRequest(), { params })

    expect(response.status).toBe(403)
    expect(auditMocks.getAuditLog).not.toHaveBeenCalled()
  })

  it('devuelve 403 a DESIGNER, DEVELOPER y BUSINESS_REVIEWER', async () => {
    for (const role of ['DESIGNER', 'DEVELOPER', 'BUSINESS_REVIEWER']) {
      auditMocks.getSession.mockResolvedValue(sessionFor(role))
      const response = await getAuditLog(makeRequest(), { params })
      expect(response.status, `rol ${role}`).toBe(403)
    }
  })

  it('permite OWNER y QA_LEAD (VIEW_AUDIT_LOG_ANY)', async () => {
    for (const role of ['OWNER', 'QA_LEAD']) {
      auditMocks.getSession.mockResolvedValue(sessionFor(role))
      const response = await getAuditLog(makeRequest(), { params })
      expect(response.status, `rol ${role}`).toBe(200)
    }

    expect(auditMocks.getAuditLog).toHaveBeenCalledTimes(2)
  })
})

describe('GET /api/findings/[id]/audit-log/export — contrato de autenticación (C-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditMocks.exportAuditLog.mockResolvedValue('"Timestamp","Action","Actor","Email"\n')
  })

  it('devuelve 401 a un anónimo y no genera el CSV', async () => {
    auditMocks.getSession.mockResolvedValue(null)

    const response = await exportAuditLog(makeRequest('/export'), { params })

    expect(response.status).toBe(401)
    expect(auditMocks.exportAuditLog).not.toHaveBeenCalled()
  })

  it('no devuelve CSV con actores ni emails a un anónimo', async () => {
    auditMocks.getSession.mockResolvedValue(null)

    const response = await exportAuditLog(makeRequest('/export'), { params })
    const text = await response.text()

    expect(response.headers.get('Content-Type') ?? '').not.toContain('text/csv')
    expect(text).not.toContain('Email')
  })

  it('devuelve 403 a un rol autenticado sin VIEW_AUDIT_LOG_ANY (VIEWER)', async () => {
    auditMocks.getSession.mockResolvedValue(sessionFor('VIEWER'))

    const response = await exportAuditLog(makeRequest('/export'), { params })

    expect(response.status).toBe(403)
    expect(auditMocks.exportAuditLog).not.toHaveBeenCalled()
  })

  it('permite OWNER y QA_LEAD descargar el CSV', async () => {
    for (const role of ['OWNER', 'QA_LEAD']) {
      auditMocks.getSession.mockResolvedValue(sessionFor(role))
      const response = await exportAuditLog(makeRequest('/export'), { params })
      expect(response.status, `rol ${role}`).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('text/csv')
    }
  })
})
