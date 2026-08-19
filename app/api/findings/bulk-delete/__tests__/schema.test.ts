import { describe, expect, it } from 'vitest'
import { BulkDeleteSchema } from '@/lib/validators/bulk-delete'

describe('BulkDeleteSchema', () => {
  it('deduplica IDs conservando orden', () => {
    expect(BulkDeleteSchema.parse({ ids: ['cuid-one', 'cuid-one', 'cuid-two'] }).ids).toEqual(['cuid-one', 'cuid-two'])
  })

  it('exige entre 1 y 100 IDs con formato no vacío', () => {
    expect(BulkDeleteSchema.safeParse({ ids: [] }).success).toBe(false)
    expect(BulkDeleteSchema.safeParse({ ids: ['x'] }).success).toBe(false)
  })
})
