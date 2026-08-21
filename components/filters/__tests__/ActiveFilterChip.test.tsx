import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { ActiveFilterChip, ActiveFilterChipList } from '../ActiveFilterChip'

afterEach(cleanup)

describe('ActiveFilterChip', () => {
  it('exposes an accessible name that identifies which filter the × removes', () => {
    render(<ActiveFilterChip label="Estado" value="Abierto" onRemove={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Eliminar filtro Estado: Abierto' })).toBeTruthy()
  })

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn()
    render(<ActiveFilterChip label="Prioridad" value="Alta" onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button', { name: /Eliminar filtro/ }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})

describe('ActiveFilterChipList', () => {
  it('renders nothing when there are no chips', () => {
    const { container } = render(<ActiveFilterChipList onClearAll={vi.fn()}>{[]}</ActiveFilterChipList>)
    expect(container.firstChild).toBeNull()
  })

  it('renders the chips and a working "Limpiar filtros" action when chips exist', () => {
    const onClearAll = vi.fn()
    render(
      <ActiveFilterChipList onClearAll={onClearAll}>
        <ActiveFilterChip label="Estado" value="Abierto" onRemove={vi.fn()} />
      </ActiveFilterChipList>,
    )

    expect(screen.getByText('Estado: Abierto')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })
})
