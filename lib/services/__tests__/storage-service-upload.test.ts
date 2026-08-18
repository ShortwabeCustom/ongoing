// @vitest-environment node
/**
 * ADR-001 D5.2 / D5.3 — máquina de upload FASE 0→3 y propiedad de los fallos.
 *
 * Se mockean la BD y el almacén privado: aquí se verifica el ORDEN y los
 * efectos de cada fase, no la escritura real en disco (eso lo cubren los tests
 * de `lib/storage`).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEvidence = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
}))
const mockFinding = vi.hoisted(() => ({ findFirst: vi.fn() }))
const mockAuditLog = vi.hoisted(() => ({ create: vi.fn() }))
const mockStore = vi.hoisted(() => ({ put: vi.fn(), stat: vi.fn(), exists: vi.fn() }))
const mockRoot = vi.hoisted(() => ({ getEvidenceStorageRoot: vi.fn() }))

const db = {
  evidence: mockEvidence,
  finding: mockFinding,
  auditLog: mockAuditLog,
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({ evidence: mockEvidence, auditLog: mockAuditLog }),
  ),
}

vi.mock('@/lib/db-lazy', () => ({ getDb: () => db }))
vi.mock('@/lib/storage/private-file-store', () => ({ PrivateFileStore: mockStore }))
vi.mock('@/lib/storage/storage-root', () => ({
  getEvidenceStorageRoot: mockRoot.getEvidenceStorageRoot,
}))

const { StorageService } = await import('@/lib/services/storage-service')

// PNG mínimo válido para `validateFile` (magic bytes correctos).
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 0),
])

const INPUT = {
  buffer: PNG,
  mimeType: 'image/png',
  originalFilename: 'captura.png',
  findingId: 'find_1',
  caption: 'una captura',
  uploadedBy: 'user_1',
}

function createdRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ev_generated',
    findingId: 'find_1',
    storageKey: 'findings/find_1/ev_generated/captura.png',
    url: null,
    originalFilename: 'captura.png',
    mimeType: 'image/png',
    fileSize: PNG.length,
    caption: 'una captura',
    createdBy: 'user_1',
    createdAt: new Date('2026-08-17T10:00:00Z'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRoot.getEvidenceStorageRoot.mockReturnValue('/var/lib/evidence')
  mockFinding.findFirst.mockResolvedValue({ id: 'find_1' })
  mockEvidence.create.mockImplementation(async ({ data }: any) => createdRow({ id: data.id, storageKey: data.storageKey }))
  mockEvidence.update.mockImplementation(async ({ where, data }: any) =>
    createdRow({ id: where.id, url: data.url }),
  )
  mockStore.put.mockResolvedValue(undefined)
  mockStore.stat.mockResolvedValue({ size: PNG.length })
  mockAuditLog.create.mockResolvedValue({})
})

describe('FASE 0 — validaciones previas, cero escrituras en BD', () => {
  it('storage config inválida ⇒ NO se crea ninguna Evidence', async () => {
    mockRoot.getEvidenceStorageRoot.mockImplementation(() => {
      throw new Error('STORAGE_UNAVAILABLE')
    })

    await expect(StorageService.uploadFile(INPUT)).rejects.toThrow()
    expect(mockEvidence.create).not.toHaveBeenCalled()
    expect(mockStore.put).not.toHaveBeenCalled()
    expect(mockAuditLog.create).not.toHaveBeenCalled()
  })

  it('finding inexistente ⇒ NOT_FOUND sin escrituras', async () => {
    mockFinding.findFirst.mockResolvedValue(null)

    await expect(StorageService.uploadFile(INPUT)).rejects.toThrow('NOT_FOUND')
    expect(mockEvidence.create).not.toHaveBeenCalled()
    expect(mockStore.put).not.toHaveBeenCalled()
  })

  it('finding soft-deleted ⇒ NOT_FOUND (la query exige deletedAt: null)', async () => {
    mockFinding.findFirst.mockResolvedValue(null)
    await expect(StorageService.uploadFile(INPUT)).rejects.toThrow('NOT_FOUND')
    expect(mockFinding.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'find_1', deletedAt: null } }),
    )
  })

  it('la validación de fichero se mantiene: MIME declarado != magic bytes ⇒ rechazado', async () => {
    await expect(
      StorageService.uploadFile({ ...INPUT, mimeType: 'image/jpeg' }),
    ).rejects.toThrow('MIME_MISMATCH')
    expect(mockEvidence.create).not.toHaveBeenCalled()
  })

  it('la validación de fichero se mantiene: tipo no verificable ⇒ rechazado', async () => {
    await expect(
      StorageService.uploadFile({ ...INPUT, buffer: Buffer.from('no soy una imagen') }),
    ).rejects.toThrow('UNVERIFIABLE_FILE_TYPE')
    expect(mockEvidence.create).not.toHaveBeenCalled()
  })

  it('valida el storage ANTES de consultar/crear nada en BD', async () => {
    await StorageService.uploadFile(INPUT)
    expect(mockRoot.getEvidenceStorageRoot).toHaveBeenCalled()
    const rootOrder = mockRoot.getEvidenceStorageRoot.mock.invocationCallOrder[0]
    const createOrder = mockEvidence.create.mock.invocationCallOrder[0]
    expect(rootOrder).toBeLessThan(createOrder)
  })
})

describe('FASE 1 — fila PENDING sin AuditLog', () => {
  it('crea la Evidence con url = null y NO emite AuditLog en ese momento', async () => {
    await StorageService.uploadFile(INPUT)

    const createArgs = mockEvidence.create.mock.calls[0][0]
    expect(createArgs.data.url).toBeNull()
    expect(createArgs.data.storageKey).toMatch(/^findings\/find_1\//)

    // El AuditLog existe, pero DESPUÉS del put (FASE 3), nunca antes.
    const createOrder = mockEvidence.create.mock.invocationCallOrder[0]
    const putOrder = mockStore.put.mock.invocationCallOrder[0]
    const auditOrder = mockAuditLog.create.mock.invocationCallOrder[0]
    expect(createOrder).toBeLessThan(putOrder)
    expect(putOrder).toBeLessThan(auditOrder)
  })
})

describe('FASE 2 — publicación de bytes', () => {
  it('llama a put con la storageKey creada y el buffer', async () => {
    await StorageService.uploadFile(INPUT)

    const createdKey = mockEvidence.create.mock.calls[0][0].data.storageKey
    expect(mockStore.put).toHaveBeenCalledWith(createdKey, PNG)
  })

  it('si put falla, la fila queda PENDING: sin AuditLog, sin delete, sin borrar fila', async () => {
    mockStore.put.mockRejectedValue(new Error('boom'))

    await expect(StorageService.uploadFile(INPUT)).rejects.toThrow('boom')

    expect(mockEvidence.create).toHaveBeenCalledTimes(1)
    expect(mockEvidence.update).not.toHaveBeenCalled()
    expect(mockAuditLog.create).not.toHaveBeenCalled()
    expect((mockStore as Record<string, unknown>).delete).toBeUndefined()
  })

  it('EEXIST se comporta igual que cualquier otro fallo de FASE 2', async () => {
    mockStore.put.mockRejectedValue(Object.assign(new Error('exists'), { code: 'EEXIST' }))

    await expect(StorageService.uploadFile(INPUT)).rejects.toThrow()
    expect(mockEvidence.update).not.toHaveBeenCalled()
    expect(mockAuditLog.create).not.toHaveBeenCalled()
  })
})

describe('FASE 3 — confirmación', () => {
  it('hace update → stat → AuditLog CREATE, en ese orden y en la MISMA transacción', async () => {
    await StorageService.uploadFile(INPUT)

    const evidenceId = mockEvidence.create.mock.calls[0][0].data.id
    const createdKey = mockEvidence.create.mock.calls[0][0].data.storageKey
    expect(mockEvidence.update).toHaveBeenCalledWith({
      where: { id: evidenceId },
      data: { url: `/api/evidence/${evidenceId}/file` },
    })

    const audit = mockAuditLog.create.mock.calls[0][0].data
    expect(audit).toMatchObject({
      entityType: 'Evidence',
      entityId: evidenceId,
      action: 'CREATE',
      actorId: 'user_1',
    })

    const updateOrder = mockEvidence.update.mock.invocationCallOrder[0]
    const statOrder = mockStore.stat.mock.invocationCallOrder[0]
    const auditOrder = mockAuditLog.create.mock.invocationCallOrder[0]
    expect(updateOrder).toBeLessThan(statOrder)
    expect(statOrder).toBeLessThan(auditOrder)
    expect(mockStore.stat).toHaveBeenCalledWith(createdKey)

    // Dos transacciones: FASE 1 y FASE 3.
    expect(db.$transaction).toHaveBeenCalledTimes(2)
  })

  it('si la transacción de FASE 3 falla, la fila sigue PENDING y el objeto NO se borra', async () => {
    mockEvidence.update.mockRejectedValue(new Error('tx down'))

    await expect(StorageService.uploadFile(INPUT)).rejects.toThrow('tx down')

    expect(mockStore.put).toHaveBeenCalledTimes(1)
    expect(mockAuditLog.create).not.toHaveBeenCalled()
    expect((mockStore as Record<string, unknown>).delete).toBeUndefined()
  })

  it('si falla el AuditLog, la transacción revierte y la evidencia queda PENDING', async () => {
    mockAuditLog.create.mockRejectedValue(new Error('audit down'))

    await expect(StorageService.uploadFile(INPUT)).rejects.toThrow('audit down')
    // El update se intentó dentro de la tx que revierte; no hay confirmación.
    expect(mockStore.put).toHaveBeenCalledTimes(1)
  })

  it('si stat falla tras el update, FASE 3 rechaza sin AuditLog ni cleanup aplicativo', async () => {
    mockStore.stat.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))

    await expect(StorageService.uploadFile(INPUT)).rejects.toThrow('missing')

    expect(mockEvidence.update).toHaveBeenCalledTimes(1)
    expect(mockStore.stat).toHaveBeenCalledTimes(1)
    expect(mockAuditLog.create).not.toHaveBeenCalled()
    expect((mockStore as Record<string, unknown>).delete).toBeUndefined()
    expect((mockEvidence as Record<string, unknown>).deleteMany).toBeUndefined()
  })

  it('un rollback de D5.4 que dejó PENDING sin objeto no puede ser confirmado después', async () => {
    mockStore.stat.mockRejectedValue(Object.assign(new Error('object removed by reconciliation'), { code: 'ENOENT' }))

    await expect(StorageService.uploadFile(INPUT)).rejects.toThrow('object removed by reconciliation')
    expect(mockEvidence.update).toHaveBeenCalledTimes(1)
    expect(mockAuditLog.create).not.toHaveBeenCalled()
  })

  it('con stat exitoso conserva la respuesta CONFIRMED normal', async () => {
    const result = await StorageService.uploadFile(INPUT)
    expect(mockStore.stat).toHaveBeenCalledTimes(1)
    expect(mockAuditLog.create).toHaveBeenCalledTimes(1)
    expect(result.url).toBe(`/api/evidence/${result.id}/file`)
  })
})

describe('respuesta 201', () => {
  it('NUNCA expone storageKey', async () => {
    const result = await StorageService.uploadFile(INPUT)

    const createdKey = mockEvidence.create.mock.calls[0][0].data.storageKey
    expect(result).not.toHaveProperty('storageKey')
    expect(JSON.stringify(result)).not.toContain(createdKey)
    expect(JSON.stringify(result)).not.toContain('findings/find_1')
  })

  it('devuelve la URL de entrega autenticada y conserva los campos del contrato', async () => {
    const result = await StorageService.uploadFile(INPUT)

    expect(result.url).toBe(`/api/evidence/${result.id}/file`)
    expect(result).toMatchObject({
      findingId: 'find_1',
      originalFilename: 'captura.png',
      mimeType: 'image/png',
      fileSize: PNG.length,
      caption: 'una captura',
      uploadedBy: 'user_1',
    })
    expect(result.urlExpiresAt).toBeInstanceOf(Date)
    expect(result.uploadedAt).toBeInstanceOf(Date)
  })
})
