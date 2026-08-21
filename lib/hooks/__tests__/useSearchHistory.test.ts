import { describe, expect, it } from 'vitest'

import { entrySignature } from '../useSearchHistory'

describe('entrySignature (FASE 6 issue 28 — dedup)', () => {
  it('produces the same signature for two entries with identical q/status/priority/filters', () => {
    const a = { q: 'domicilio', status: ['OPEN'], filters: { project: ['proj-1'] } }
    const b = { q: 'domicilio', status: ['OPEN'], filters: { project: ['proj-1'] } }
    expect(entrySignature(a)).toBe(entrySignature(b))
  })

  it('produces a different signature when the search text differs', () => {
    const a = { q: 'domicilio', filters: {} }
    const b = { q: 'otro', filters: {} }
    expect(entrySignature(a)).not.toBe(entrySignature(b))
  })

  it('produces a different signature when the active filters differ', () => {
    const a = { q: '', filters: { project: ['proj-1'] } }
    const b = { q: '', filters: { project: ['proj-2'] } }
    expect(entrySignature(a)).not.toBe(entrySignature(b))
  })

  it('treats missing q/status/priority/filters the same as their empty equivalents', () => {
    const a = { q: undefined as unknown as string, filters: undefined as any }
    const b = { q: '', filters: {} }
    expect(entrySignature(a)).toBe(entrySignature(b))
  })
})
