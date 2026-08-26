// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FindingComments, type FindingComment } from '../FindingComments'

const auth = vi.hoisted(() => ({ user: null as { id: string; role: string } | null, loading: false }))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: auth.user, loading: auth.loading }),
}))

const ownComment: FindingComment = {
  id: 'comment-1',
  text: 'Ya validamos este flujo',
  createdAt: '2026-08-19T22:10:00.000Z',
  updatedAt: '2026-08-19T22:10:00.000Z',
  creator: { id: 'user-1', name: 'Ana', email: 'ana@example.com' },
}

const otherComment: FindingComment = {
  id: 'comment-2',
  text: 'Confirmo desde diseño',
  createdAt: '2026-08-19T23:00:00.000Z',
  updatedAt: '2026-08-19T23:00:00.000Z',
  creator: { id: 'user-2', name: 'Luis', email: 'luis@example.com' },
}

describe('FindingComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.user = null
    auth.loading = false
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('muestra el estado vacío cuando no hay comentarios', () => {
    auth.user = { id: 'user-1', role: 'DEVELOPER' }
    render(<FindingComments findingId="finding-1" initialComments={[]} />)

    expect(screen.getByText('Todavía no hay comentarios')).toBeTruthy()
  })

  it('lista los comentarios ordenados y solo permite borrar los propios (o como OWNER/QA_LEAD)', () => {
    auth.user = { id: 'user-1', role: 'DEVELOPER' }
    render(<FindingComments findingId="finding-1" initialComments={[otherComment, ownComment]} />)

    expect(screen.getByText('Ya validamos este flujo')).toBeTruthy()
    expect(screen.getByText('Confirmo desde diseño')).toBeTruthy()
    expect(screen.getAllByLabelText(/^Eliminar comentario de/)).toHaveLength(1)
    expect(screen.getByLabelText('Eliminar comentario de Ana')).toBeTruthy()
  })

  it('un VIEWER no ve el formulario para comentar', () => {
    auth.user = { id: 'user-3', role: 'VIEWER' }
    render(<FindingComments findingId="finding-1" initialComments={[]} />)

    expect(screen.queryByLabelText('Agregar comentario')).toBeNull()
  })

  it('publica un comentario nuevo y lo añade a la lista', async () => {
    auth.user = { id: 'user-1', role: 'DEVELOPER' }
    const created: FindingComment = {
      id: 'comment-3',
      text: 'Nuevo comentario',
      createdAt: '2026-08-20T09:00:00.000Z',
      updatedAt: '2026-08-20T09:00:00.000Z',
      creator: { id: 'user-1', name: 'Ana', email: 'ana@example.com' },
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => created })
    vi.stubGlobal('fetch', fetchMock)

    render(<FindingComments findingId="finding-1" initialComments={[]} />)
    fireEvent.change(screen.getByLabelText('Agregar comentario'), { target: { value: 'Nuevo comentario' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/findings/finding-1/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Nuevo comentario' }),
      }),
    )
    expect(await screen.findByText('Nuevo comentario')).toBeTruthy()
  })

  it('muestra el error de la API si falla la publicación y conserva el texto', async () => {
    auth.user = { id: 'user-1', role: 'DEVELOPER' }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: 'No autorizado' }) }),
    )

    render(<FindingComments findingId="finding-1" initialComments={[]} />)
    fireEvent.change(screen.getByLabelText('Agregar comentario'), { target: { value: 'Intento fallido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))

    expect((await screen.findByRole('alert')).textContent).toContain('No autorizado')
  })

  it('pide confirmación y elimina el comentario propio', async () => {
    auth.user = { id: 'user-1', role: 'DEVELOPER' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'comment-1' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<FindingComments findingId="finding-1" initialComments={[ownComment]} />)
    fireEvent.click(screen.getByLabelText('Eliminar comentario de Ana'))
    expect(screen.getByText('¿Eliminar este comentario?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/findings/finding-1/comments/comment-1', { method: 'DELETE' }),
    )
    await waitFor(() => expect(screen.queryByText('Ya validamos este flujo')).toBeNull())
  })

  it('OWNER puede eliminar comentarios de otros usuarios', () => {
    auth.user = { id: 'owner-1', role: 'OWNER' }
    render(<FindingComments findingId="finding-1" initialComments={[otherComment]} />)

    expect(screen.getByLabelText('Eliminar comentario de Luis')).toBeTruthy()
  })
})
