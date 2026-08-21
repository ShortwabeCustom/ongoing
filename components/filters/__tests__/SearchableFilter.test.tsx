import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { SearchableFilter } from '../SearchableFilter'

// Same jsdom gaps as the other filter primitive tests (matchMedia,
// ResizeObserver) — Base UI's popover positioning needs them.
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
  }
  if (!('ResizeObserver' in window)) {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // @ts-expect-error jsdom has no ResizeObserver
    window.ResizeObserver = ResizeObserverMock
    global.ResizeObserver = ResizeObserverMock
  }
  if (!Element.prototype.getAnimations) {
    Element.prototype.getAnimations = () => []
  }
})

afterEach(cleanup)

const OPTIONS = [
  { value: 'proj-1', label: 'Pruebas María 2.0' },
  { value: 'proj-2', label: 'Pruebas María 1.0' },
  { value: 'proj-3', label: 'Portal Elektra' },
]

describe('SearchableFilter (FASE 6 — Proyecto/Asignado matrix)', () => {
  it('opens on click and lists every option', async () => {
    render(<SearchableFilter label="Proyecto" options={OPTIONS} value={[]} onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Proyecto' }))

    expect(await screen.findByText('Pruebas María 2.0')).toBeTruthy()
    expect(screen.getByText('Pruebas María 1.0')).toBeTruthy()
    expect(screen.getByText('Portal Elektra')).toBeTruthy()
  })

  it('filters the option list as the user types', async () => {
    render(<SearchableFilter label="Proyecto" options={OPTIONS} value={[]} onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Proyecto' }))
    const search = await screen.findByPlaceholderText('Buscar...')
    fireEvent.change(search, { target: { value: 'Elektra' } })

    expect(screen.getByText('Portal Elektra')).toBeTruthy()
    expect(screen.queryByText('Pruebas María 2.0')).toBeNull()
  })

  it('shows the contextual empty label when the search matches nothing', async () => {
    render(
      <SearchableFilter
        label="Proyecto"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
        emptyLabel="No encontramos proyectos."
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Proyecto' }))
    const search = await screen.findByPlaceholderText('Buscar...')
    fireEvent.change(search, { target: { value: 'zzz-no-match' } })

    expect(await screen.findByText('No encontramos proyectos.')).toBeTruthy()
  })

  it('stays multiselect: picking two options reports both, unlike Analytics single-select usage', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<SearchableFilter label="Proyecto" options={OPTIONS} value={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Proyecto' }))
    fireEvent.click(await screen.findByText('Pruebas María 2.0'))
    expect(onChange).toHaveBeenCalledWith(['proj-1'])

    rerender(<SearchableFilter label="Proyecto" options={OPTIONS} value={['proj-1']} onChange={onChange} />)
    fireEvent.click(screen.getByText('Pruebas María 1.0'))
    expect(onChange).toHaveBeenCalledWith(['proj-1', 'proj-2'])
  })

  it('unchecking an already-selected option removes only that one', async () => {
    const onChange = vi.fn()
    render(<SearchableFilter label="Proyecto" options={OPTIONS} value={['proj-1', 'proj-2']} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /^Proyecto/ }))
    fireEvent.click(await screen.findByText('Pruebas María 2.0'))

    expect(onChange).toHaveBeenCalledWith(['proj-2'])
  })

  it('clears the search query after the popover closes and reopens', async () => {
    render(<SearchableFilter label="Proyecto" options={OPTIONS} value={[]} onChange={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: 'Proyecto' })
    fireEvent.click(trigger)
    const search = await screen.findByPlaceholderText('Buscar...')
    fireEvent.change(search, { target: { value: 'Elektra' } })
    expect(screen.queryByText('Pruebas María 2.0')).toBeNull()

    // Toggle closed via the same trigger, then reopen.
    fireEvent.click(trigger)
    fireEvent.click(trigger)

    expect(await screen.findByText('Pruebas María 2.0')).toBeTruthy()
    expect((await screen.findByPlaceholderText('Buscar...')) as HTMLInputElement).toHaveProperty('value', '')
  })

  it('shows a loading state instead of the option list', async () => {
    render(<SearchableFilter label="Asignado" options={[]} value={[]} onChange={vi.fn()} loading />)

    fireEvent.click(screen.getByRole('button', { name: 'Asignado' }))
    expect(await screen.findByText('Cargando...')).toBeTruthy()
  })
})
