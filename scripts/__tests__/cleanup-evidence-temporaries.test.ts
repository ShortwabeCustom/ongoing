// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cleanupTemporaries = vi.hoisted(() => vi.fn())

vi.mock('../../lib/storage/private-file-store', () => ({
  PrivateFileStore: { cleanupTemporaries },
}))

const { main } = await import('../cleanup-evidence-temporaries')

describe('cleanup-evidence-temporaries CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve exit code distinto de cero cuando hubo fallos individuales', async () => {
    cleanupTemporaries.mockResolvedValue({ scanned: 2, cleaned: 1, skipped: 0, failed: 1 })

    await expect(main(['--grace-minutes', '30', '--execute'])).resolves.toBe(1)
  })
})
