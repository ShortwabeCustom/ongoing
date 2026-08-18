// @vitest-environment node
/**
 * ADR-001 D2 / D4 / D5.1 — compatibilidad de URLs sin signed URLs.
 *
 * Ni `refreshSignedUrl` ni `getEvidenceWithUrl` deben firmar nada, tocar el
 * filesystem, ni construir `/evidence/{storageKey}`. Solo devuelven la URL ya
 * persistida en `Evidence.url`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEvidence = vi.hoisted(() => ({ findFirst: vi.fn() }))
const mockStore = vi.hoisted(() => ({ exists: vi.fn(), put: vi.fn() }))
const mockFileClient = vi.hoisted(() => ({
  generateSignedUrl: vi.fn(),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  exists: vi.fn(),
}))

vi.mock('@/lib/db-lazy', () => ({ getDb: () => ({ evidence: mockEvidence }) }))
vi.mock('@/lib/storage/private-file-store', () => ({ PrivateFileStore: mockStore }))
vi.mock('@/lib/storage/storage-root', () => ({ getEvidenceStorageRoot: () => '/var/lib/evidence' }))
vi.mock('@/lib/storage/file-client', () => ({ FileStorageClient: mockFileClient }))

const { StorageService } = await import('@/lib/services/storage-service')

const LEGACY_KEY = 'legacy/public/images/captura.png'
const RUNTIME_KEY = 'findings/find_1/ev_1/captura.png'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('refreshSignedUrl — ya no firma nada', () => {
  it('evidencia inexistente o borrada ⇒ NOT_FOUND', async () => {
    mockEvidence.findFirst.mockResolvedValue(null)
    await expect(StorageService.refreshSignedUrl('ev_1')).rejects.toThrow('NOT_FOUND')
  })

  it('legacy con URL ⇒ devuelve la URL persistida', async () => {
    mockEvidence.findFirst.mockResolvedValue({
      id: 'ev_1',
      storageKey: LEGACY_KEY,
      url: '/images/captura.png',
    })

    const result = await StorageService.refreshSignedUrl('ev_1')
    expect(result.url).toBe('/images/captura.png')
    expect(mockFileClient.generateSignedUrl).not.toHaveBeenCalled()
  })

  it('legacy sin URL ⇒ conserva UNSIGNED_LEGACY_EVIDENCE', async () => {
    mockEvidence.findFirst.mockResolvedValue({ id: 'ev_1', storageKey: LEGACY_KEY, url: null })
    await expect(StorageService.refreshSignedUrl('ev_1')).rejects.toThrow(
      'UNSIGNED_LEGACY_EVIDENCE',
    )
  })

  it('runtime PENDING (url null) ⇒ UPLOAD_INCOMPLETE', async () => {
    mockEvidence.findFirst.mockResolvedValue({ id: 'ev_1', storageKey: RUNTIME_KEY, url: null })
    await expect(StorageService.refreshSignedUrl('ev_1')).rejects.toThrow('UPLOAD_INCOMPLETE')
  })

  it('runtime CONFIRMED ⇒ devuelve la URL persistida sin firmar ni tocar el disco', async () => {
    mockEvidence.findFirst.mockResolvedValue({
      id: 'ev_1',
      storageKey: RUNTIME_KEY,
      url: '/api/evidence/ev_1/file',
    })

    const result = await StorageService.refreshSignedUrl('ev_1')
    expect(result.url).toBe('/api/evidence/ev_1/file')
    expect(mockFileClient.generateSignedUrl).not.toHaveBeenCalled()
    expect(mockStore.exists).not.toHaveBeenCalled()
  })

  it('nunca devuelve una ruta /evidence/{storageKey}', async () => {
    mockEvidence.findFirst.mockResolvedValue({
      id: 'ev_1',
      storageKey: RUNTIME_KEY,
      url: '/api/evidence/ev_1/file',
    })
    const result = await StorageService.refreshSignedUrl('ev_1')
    expect(result.url).not.toContain(RUNTIME_KEY)
    expect(result.url.startsWith('/evidence/')).toBe(false)
  })
})

describe('getEvidenceWithUrl', () => {
  const base = {
    id: 'ev_1',
    findingId: 'find_1',
    originalFilename: 'captura.png',
    mimeType: 'image/png',
    fileSize: 10,
    caption: null,
    createdAt: new Date('2026-08-17T10:00:00Z'),
  }

  it('legacy ⇒ URL persistida', async () => {
    mockEvidence.findFirst.mockResolvedValue({ ...base, storageKey: LEGACY_KEY, url: '/images/x.png' })
    const result = await StorageService.getEvidenceWithUrl('ev_1')
    expect(result.url).toBe('/images/x.png')
    expect(mockFileClient.generateSignedUrl).not.toHaveBeenCalled()
  })

  it('runtime CONFIRMED ⇒ URL persistida', async () => {
    mockEvidence.findFirst.mockResolvedValue({
      ...base,
      storageKey: RUNTIME_KEY,
      url: '/api/evidence/ev_1/file',
    })
    const result = await StorageService.getEvidenceWithUrl('ev_1')
    expect(result.url).toBe('/api/evidence/ev_1/file')
    expect(mockFileClient.generateSignedUrl).not.toHaveBeenCalled()
  })

  it('runtime PENDING ⇒ UPLOAD_INCOMPLETE', async () => {
    mockEvidence.findFirst.mockResolvedValue({ ...base, storageKey: RUNTIME_KEY, url: null })
    await expect(StorageService.getEvidenceWithUrl('ev_1')).rejects.toThrow('UPLOAD_INCOMPLETE')
  })

  it('inexistente ⇒ NOT_FOUND', async () => {
    mockEvidence.findFirst.mockResolvedValue(null)
    await expect(StorageService.getEvidenceWithUrl('ev_1')).rejects.toThrow('NOT_FOUND')
  })
})

describe('objectExists', () => {
  it('legacy ⇒ true sin consultar el almacén privado', async () => {
    expect(await StorageService.objectExists(LEGACY_KEY)).toBe(true)
    expect(mockStore.exists).not.toHaveBeenCalled()
  })

  it('runtime ⇒ delega en PrivateFileStore.exists', async () => {
    mockStore.exists.mockResolvedValue(true)
    expect(await StorageService.objectExists(RUNTIME_KEY)).toBe(true)
    expect(mockStore.exists).toHaveBeenCalledWith(RUNTIME_KEY)
  })
})
