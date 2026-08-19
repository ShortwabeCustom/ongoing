import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBatchActions } from '../useBatchActions'
import { useClearSelectionOnChange } from '../useClearSelectionOnChange'

let api: any
function Harness() {
  const [filter, setFilter] = useState('priority=HIGH')
  const batch = useBatchActions()
  useClearSelectionOnChange(filter, batch.clearSelection)
  api = { ...batch, filter, setFilter }
  return null
}

describe('regresión selección al cambiar filtros y borrar', () => {
  let root: ReturnType<typeof createRoot>
  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ deleted: 3, ids: ['a1111', 'b2222', 'c3333'] }) }))
    root = createRoot(document.createElement('div'))
    await act(async () => root.render(<Harness />))
  })
  afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })

  it('seleccionar 3 → cambiar filtro → selección 0', async () => {
    await act(async () => api.selectMany(['a1111', 'b2222', 'c3333']))
    expect(api.selectedIds).toHaveLength(3)
    await act(async () => api.setFilter('priority=CRITICAL'))
    expect(api.selectedIds).toHaveLength(0)
  })

  it('bulk delete limpia selección y conserva filtros activos', async () => {
    await act(async () => api.selectMany(['a1111', 'b2222', 'c3333']))
    await act(async () => { expect(await api.bulkDelete()).toBe(3) })
    expect(api.selectedIds).toHaveLength(0)
    expect(api.filter).toBe('priority=HIGH')
  })
})
