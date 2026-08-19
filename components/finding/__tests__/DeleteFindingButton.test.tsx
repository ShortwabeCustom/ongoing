// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeleteFindingButton } from '../DeleteFindingButton'

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => router }))

describe('DeleteFindingButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('confirma, elimina y vuelve al inventario', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)

    render(<DeleteFindingButton findingId="finding-1" observation="Hallazgo de prueba" />)
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar hallazgo' }))

    expect(screen.getByRole('dialog').textContent).toContain('Hallazgo de prueba')
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar hallazgo' })[1])

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/findings/finding-1', { method: 'DELETE' }))
    expect(router.push).toHaveBeenCalledWith('/findings')
    expect(router.refresh).toHaveBeenCalled()
  })

  it('mantiene la confirmación abierta y muestra el error de la API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    render(<DeleteFindingButton findingId="finding-1" observation="Hallazgo de prueba" />)
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar hallazgo' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar hallazgo' })[1])

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo eliminar')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(router.push).not.toHaveBeenCalled()
  })
})
