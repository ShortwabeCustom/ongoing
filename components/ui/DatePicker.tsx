'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerProps {
  value: string
  onChange: (date: string) => void
  label?: string
  disabled?: boolean
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function getFirstDayOfMonth(date: Date): number {
  const sundayBasedDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  ).getDay()

  // La UI comienza en lunes, mientras getDay() comienza en domingo.
  return (sundayBasedDay + 6) % 7
}

function formatDateForDisplay(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`)

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatMonthYear(date: Date): string {
  const months = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ]

  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

export function DatePicker({
  value,
  onChange,
  label,
  disabled = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = value ? new Date(`${value}T00:00:00`) : new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })

  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 320,
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!value) return

    const selectedDate = new Date(`${value}T00:00:00`)

    setCurrentMonth(
      new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        1
      )
    )
  }, [value])

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node

      if (
        !containerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return

    const rect = buttonRef.current.getBoundingClientRect()
    const viewportPadding = 8
    const gap = 8

    const desiredWidth = Math.max(
      buttonRef.current.offsetWidth,
      320
    )

    const width = Math.min(
      desiredWidth,
      Math.max(
        280,
        window.innerWidth - viewportPadding * 2
      )
    )

    const popoverHeight =
      popoverRef.current?.offsetHeight ?? 360

    let left = rect.left

    if (
      left + width >
      window.innerWidth - viewportPadding
    ) {
      left =
        window.innerWidth -
        width -
        viewportPadding
    }

    left = Math.max(viewportPadding, left)

    let top = rect.bottom + gap

    const doesNotFitBelow =
      top + popoverHeight >
      window.innerHeight - viewportPadding

    const fitsAbove =
      rect.top -
        gap -
        popoverHeight >=
      viewportPadding

    if (doesNotFitBelow && fitsAbove) {
      top =
        rect.top -
        gap -
        popoverHeight
    }

    top = Math.max(
      viewportPadding,
      Math.min(
        top,
        Math.max(
          viewportPadding,
          window.innerHeight -
            popoverHeight -
            viewportPadding
        )
      )
    )

    setPosition({
      top,
      left,
      width,
    })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return

    updatePosition()

    const frame =
      window.requestAnimationFrame(updatePosition)

    window.addEventListener(
      'resize',
      updatePosition
    )

    window.addEventListener(
      'scroll',
      updatePosition,
      true
    )

    return () => {
      window.cancelAnimationFrame(frame)

      window.removeEventListener(
        'resize',
        updatePosition
      )

      window.removeEventListener(
        'scroll',
        updatePosition,
        true
      )
    }
  }, [isOpen, updatePosition])

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - 1,
        1
      )
    )
  }

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1
      )
    )
  }

  const handleSelectDate = (day: number) => {
    const selectedDate = [
      currentMonth.getFullYear(),
      String(
        currentMonth.getMonth() + 1
      ).padStart(2, '0'),
      String(day).padStart(2, '0'),
    ].join('-')

    onChange(selectedDate)
    setIsOpen(false)
  }

  const renderCalendar = () => {
    const daysInMonth =
      getDaysInMonth(currentMonth)

    const firstDay =
      getFirstDayOfMonth(currentMonth)

    const days: (number | null)[] =
      Array(firstDay).fill(null)

    for (
      let day = 1;
      day <= daysInMonth;
      day += 1
    ) {
      days.push(day)
    }

    const today = new Date()

    const isCurrentMonth =
      today.getMonth() ===
        currentMonth.getMonth() &&
      today.getFullYear() ===
        currentMonth.getFullYear()

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Mes anterior"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#65766e] hover:bg-[#edf4ed]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <h3 className="text-sm font-semibold text-[#17251f]">
            {formatMonthYear(currentMonth)}
          </h3>

          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Mes siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#65766e] hover:bg-[#edf4ed]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {[
            'L',
            'M',
            'M',
            'J',
            'V',
            'S',
            'D',
          ].map((day, index) => (
            <div
              key={`${day}-${index}`}
              className="py-2 text-center text-xs font-semibold text-[#65766e]"
            >
              {day}
            </div>
          ))}

          {days.map((day, index) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${index}`}
                  aria-hidden="true"
                />
              )
            }

            const selectedValue = [
              currentMonth.getFullYear(),
              String(
                currentMonth.getMonth() + 1
              ).padStart(2, '0'),
              String(day).padStart(2, '0'),
            ].join('-')

            const isSelected =
              value === selectedValue

            const isToday =
              isCurrentMonth &&
              day === today.getDate()

            return (
              <button
                key={selectedValue}
                type="button"
                onClick={() =>
                  handleSelectDate(day)
                }
                aria-pressed={isSelected}
                className={`h-10 rounded-lg text-sm font-semibold transition ${
                  isSelected
                    ? 'bg-[#00a85a] text-white'
                    : isToday
                      ? 'bg-[#dbe4dd] text-[#17251f]'
                      : 'text-[#17251f] hover:bg-[#edf4ed]'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full"
    >
      {label && (
        <label className="mb-2 block text-sm font-semibold text-[#3d4d45]">
          {label}
        </label>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={() =>
          setIsOpen((open) => !open)
        }
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="pm-input flex h-11 w-full items-center justify-between px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#00a85a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#65766e]" />

          <span className="text-[#17251f]">
            {value
              ? formatDateForDisplay(value)
              : 'dd/mm/aaaa'}
          </span>
        </div>
      </button>

      {isOpen &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={
              label
                ? `Calendario: ${label}`
                : 'Calendario'
            }
            style={{
              position: 'fixed',
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `${position.width}px`,
              zIndex: 9999,
              maxHeight: 'calc(100vh - 16px)',
              overflowY: 'auto',
            }}
            className="rounded-lg border border-[#dbe4dd] bg-white p-4 shadow-lg"
          >
            {renderCalendar()}
          </div>,
          document.body
        )}
    </div>
  )
}
