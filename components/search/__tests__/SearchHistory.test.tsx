import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'

import { SearchHistory } from '../SearchHistory'
import type { SearchHistoryEntry, SavedFilterEntry } from '@/lib/types/search'

afterEach(cleanup)

function baseProps(overrides: Partial<ComponentProps<typeof SearchHistory>> = {}) {
  return {
    onClose: vi.fn(),
    recent: [] as SearchHistoryEntry[],
    saved: [] as SavedFilterEntry[],
    onSelectRecent: vi.fn(),
    onSelectSaved: vi.fn(),
    onRemoveRecent: vi.fn(),
    onRemoveSaved: vi.fn(),
    onRenameSaved: vi.fn(),
    onClearRecentAll: vi.fn(),
    isLoading: false,
    ...overrides,
  }
}

describe('SearchHistory ("Vistas" — FASE 6 issue "(Sin texto)")', () => {
  it('renders a real search term as the entry label', () => {
    render(
      <SearchHistory
        {...baseProps({
          recent: [{ id: '1', q: 'domicilio', filters: {}, timestamp: Date.now() }],
        })}
      />,
    )

    expect(screen.getByText('domicilio')).toBeTruthy()
    expect(screen.queryByText('(Sin texto)')).toBeNull()
  })

  it('never renders the literal "(Sin texto)" placeholder, even for a filters-only entry with empty q', () => {
    render(
      <SearchHistory
        {...baseProps({
          recent: [{ id: '1', q: '', status: ['OPEN'], filters: {}, timestamp: Date.now() }],
        })}
      />,
    )

    expect(screen.queryByText('(Sin texto)')).toBeNull()
    expect(screen.getByText('Abierto')).toBeTruthy()
  })

  it('resolves a Proyecto id to its real name via projectLabels', () => {
    render(
      <SearchHistory
        {...baseProps({
          recent: [{ id: '1', q: '', filters: { project: ['proj-1'] }, timestamp: Date.now() }],
          projectLabels: { 'proj-1': 'Pruebas María 2.0' },
        })}
      />,
    )

    expect(screen.getByText('Proyecto: Pruebas María 2.0')).toBeTruthy()
  })

  it('selecting a recent entry calls onSelectRecent and closes', () => {
    const onSelectRecent = vi.fn()
    const onClose = vi.fn()
    render(
      <SearchHistory
        {...baseProps({
          recent: [{ id: '1', q: 'domicilio', filters: {}, timestamp: Date.now() }],
          onSelectRecent,
          onClose,
        })}
      />,
    )

    fireEvent.click(screen.getByText('domicilio'))
    expect(onSelectRecent).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows "Guardadas" (not the old "Guardados") as the saved-filters tab label', () => {
    render(<SearchHistory {...baseProps()} />)
    expect(screen.getByText('Guardadas')).toBeTruthy()
  })
})
