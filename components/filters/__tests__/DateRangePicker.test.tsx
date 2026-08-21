import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { DateRangePicker } from '../DateRangePicker'

afterEach(cleanup)

// jsdom implements neither matchMedia nor ResizeObserver, both of which the
// popover positioning (Base UI/floating-ui) and useMediaQuery rely on.
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
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
})

function openPicker() {
  fireEvent.click(screen.getAllByRole('button', { name: /Desde/ })[0])
}

describe('DateRangePicker', () => {
  it('selects a start and end day, then commits the range on Aplicar', async () => {
    const onChange = vi.fn()
    render(<DateRangePicker value={{}} onChange={onChange} />)

    openPicker()
    const day10 = await screen.findByRole('gridcell', { name: /10 /i })
    fireEvent.click(day10)
    const day20 = screen.getByRole('gridcell', { name: /20 /i })
    fireEvent.click(day20)

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const range = onChange.mock.calls[0][0]
    expect(range.from.getDate()).toBe(10)
    expect(range.to.getDate()).toBe(20)
  })

  it('reorders the range automatically when the second click lands before the first', async () => {
    const onChange = vi.fn()
    render(<DateRangePicker value={{}} onChange={onChange} />)

    openPicker()
    const day20 = await screen.findByRole('gridcell', { name: /20 /i })
    fireEvent.click(day20)
    const day10 = screen.getByRole('gridcell', { name: /10 /i })
    fireEvent.click(day10)

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))

    const range = onChange.mock.calls[0][0]
    expect(range.from.getDate()).toBe(10)
    expect(range.to.getDate()).toBe(20)
  })

  it('does not call onChange when Cancelar is pressed after picking dates', async () => {
    const onChange = vi.fn()
    render(<DateRangePicker value={{}} onChange={onChange} />)

    openPicker()
    const day10 = await screen.findByRole('gridcell', { name: /10 /i })
    fireEvent.click(day10)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('Limpiar clears the draft so Aplicar commits an empty range', async () => {
    const from = new Date(2026, 6, 21)
    const to = new Date(2026, 7, 20)
    const onChange = vi.fn()
    render(<DateRangePicker value={{ from, to }} onChange={onChange} />)

    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(onChange).toHaveBeenCalledWith({ from: undefined, to: undefined })
  })

  it('variant="button" renders a single FilterTrigger showing "Activa" once a range is set (FASE 4)', () => {
    const { rerender } = render(<DateRangePicker variant="button" triggerLabel="Fecha" value={{}} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Fecha' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Desde/ })).toBeNull()

    rerender(
      <DateRangePicker
        variant="button"
        triggerLabel="Fecha"
        value={{ from: new Date(2026, 6, 21), to: new Date(2026, 7, 20) }}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Fecha · Activa' })).toBeTruthy()
  })

  it('variant="button" still opens the same calendar and commits a range on Aplicar', async () => {
    const onChange = vi.fn()
    render(<DateRangePicker variant="button" value={{}} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Fecha' }))
    const day10 = await screen.findByRole('gridcell', { name: /10 /i })
    fireEvent.click(day10)
    const day20 = screen.getByRole('gridcell', { name: /20 /i })
    fireEvent.click(day20)
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const range = onChange.mock.calls[0][0]
    expect(range.from.getDate()).toBe(10)
    expect(range.to.getDate()).toBe(20)
  })
})
