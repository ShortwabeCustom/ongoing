import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const importMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
}))

vi.mock('@/lib/auth/lucia', () => ({
  getSession: importMocks.getSession,
}))

vi.mock('@/lib/db-lazy', () => ({
  getDb: () => ({
    importBatch: {
      findUnique: importMocks.findUnique,
    },
  }),
}))

import { GET as getImportBatch } from '../route'

const BATCH_ID = 'cmswd7k2h0000to2s4q1zv9ab'

const BATCH = {
  id: BATCH_ID,
  status: 'COMPLETED',
  projectId: 'proj-1',
  testSessionId: 'sess-1',
  originalFilename: 'Pruebas Maria 2.0 (hoy).xlsx',
  fileSize: 48213,
  totalRows: 204,
  validRows: 201,
  skippedRows: 3,
  errorMessage: null,
  createdAt: new Date('2026-08-16T10:00:00.000Z'),
  importedAt: new Date('2026-08-16T10:00:42.000Z'),
  testSession: { id: 'sess-1', name: 'Sesión 1' },
}

function makeRequest() {
  return new NextRequest(`http://127.0.0.1:3000/api/imports/${BATCH_ID}`)
}

const params = Promise.resolve({ id: BATCH_ID })

function sessionFor(role: string) {
  return { session: { id: 'sess-1' }, user: { id: 'user-1', email: 'x@y.z', name: 'X', role } }
}

describe('GET /api/imports/[id] — contrato de autenticación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    importMocks.findUnique.mockResolvedValue(BATCH)
  })

  it('devuelve 401 a un anónimo y no consulta la base de datos', async () => {
    importMocks.getSession.mockResolvedValue(null)

    const response = await getImportBatch(makeRequest(), { params })

    expect(response.status).toBe(401)
    expect(importMocks.findUnique).not.toHaveBeenCalled()
  })

  it('no filtra metadatos del lote en la respuesta anónima', async () => {
    importMocks.getSession.mockResolvedValue(null)

    const response = await getImportBatch(makeRequest(), { params })
    const text = await response.text()

    expect(text).not.toContain(BATCH.originalFilename)
    expect(text).not.toContain('totalRows')
    expect(text).not.toContain(BATCH.projectId)
  })

  it('permite los roles de CREATE_FINDING y devuelve los datos del lote', async () => {
    for (const role of ['OWNER', 'QA_LEAD', 'DESIGNER', 'DEVELOPER']) {
      importMocks.getSession.mockResolvedValue(sessionFor(role))

      const response = await getImportBatch(makeRequest(), { params })

      expect(response.status, `rol ${role}`).toBe(200)
      const body = await response.json()
      expect(body.id, `rol ${role}`).toBe(BATCH_ID)
      expect(body.totalRows, `rol ${role}`).toBe(204)
      expect(body.originalFilename, `rol ${role}`).toBe(BATCH.originalFilename)
    }

    expect(importMocks.findUnique).toHaveBeenCalledTimes(4)
  })

  it('devuelve 403 a roles autenticados de solo lectura (VIEWER, BUSINESS_REVIEWER)', async () => {
    // Decisión deliberada: el sondeo del estado de un lote de importación pertenece al
    // pipeline de creación de hallazgos, no a la lectura general (VIEW_ALL_FINDINGS).
    for (const role of ['VIEWER', 'BUSINESS_REVIEWER']) {
      importMocks.getSession.mockResolvedValue(sessionFor(role))

      const response = await getImportBatch(makeRequest(), { params })

      expect(response.status, `rol ${role}`).toBe(403)
    }

    expect(importMocks.findUnique).not.toHaveBeenCalled()
  })

  it('mantiene el 404 para un lote inexistente con un rol autorizado', async () => {
    importMocks.getSession.mockResolvedValue(sessionFor('DEVELOPER'))
    importMocks.findUnique.mockResolvedValue(null)

    const response = await getImportBatch(makeRequest(), { params })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe('Import batch not found')
  })
})
