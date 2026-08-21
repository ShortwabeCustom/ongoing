import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { MultiSelectFilter } from '../MultiSelectFilter'

// vitest.config.mjs doesn't set test.globals, so @testing-library/react's
// automatic afterEach(cleanup) registration doesn't fire — do it explicitly.
// @testing-library/jest-dom isn't installed, so assertions below use plain
// DOM properties (textContent, etc.) instead of its matchers.
afterEach(cleanup)

const OPTIONS = [
  { value: 'open', label: 'Abierto' },
  { value: 'in_progress', label: 'En progreso' },
]

describe('MultiSelectFilter', () => {
  it('opens on click, toggles an option via its label, and reports the new value', async () => {
    const onChange = vi.fn()
    render(<MultiSelectFilter label="Estado" options={OPTIONS} value={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Estado' }))
    const option = await screen.findByText('Abierto')
    fireEvent.click(option)

    expect(onChange).toHaveBeenCalledWith(['open'])
  })

  it('unchecks an already-selected option back to an empty selection', async () => {
    const onChange = vi.fn()
    render(<MultiSelectFilter label="Estado" options={OPTIONS} value={['open']} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Estado · 1 seleccionados' }))
    const option = await screen.findByText('Abierto')
    fireEvent.click(option)

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('renders the count both visually and in the accessible name when a value is already selected', () => {
    render(<MultiSelectFilter label="Estado" options={OPTIONS} value={['open', 'in_progress']} onChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Estado · 2 seleccionados' })
    expect(trigger.textContent).toContain('2')
  })
})
