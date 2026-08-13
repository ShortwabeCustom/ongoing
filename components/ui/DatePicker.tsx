'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

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
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
}

function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatMonthYear(date: Date): string {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

export function DatePicker({ value, onChange, label, disabled = false }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = value ? new Date(value + 'T00:00:00') : new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    )
  }

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    )
  }

  const handleSelectDate = (day: number) => {
    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const isoString = selectedDate.toISOString().split('T')[0]
    onChange(isoString)
    setIsOpen(false)
  }

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const days: (number | null)[] = Array(firstDay).fill(null)

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    const weeks: (number | null)[][] = []
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }

    const today = new Date()
    const isCurrentMonth =
      today.getMonth() === currentMonth.getMonth() &&
      today.getFullYear() === currentMonth.getFullYear()

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#edf4ed] text-[#65766e]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-sm font-semibold text-[#17251f]">
            {formatMonthYear(currentMonth)}
          </h3>
          <button
            onClick={handleNextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#edf4ed] text-[#65766e]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-[#65766e] py-2">
              {day}
            </div>
          ))}

          {weeks.map((week, weekIdx) =>
            week.map((day, dayIdx) => {
              const dayKey = `${weekIdx}-${dayIdx}`
              if (day === null) {
                return <div key={dayKey} />
              }

              const isSelected = value === `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isToday = isCurrentMonth && day === today.getDate()

              return (
                <button
                  key={dayKey}
                  onClick={() => handleSelectDate(day)}
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
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="block text-sm font-semibold text-[#3d4d45] mb-2">
          {label}
        </label>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="pm-input h-11 w-full px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#00a85a] flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#65766e]" />
          <span className="text-[#17251f]">
            {value ? formatDateForDisplay(value) : 'Selecciona fecha'}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-lg border border-[#dbe4dd] shadow-lg p-4 w-80">
          {renderCalendar()}
        </div>
      )}
    </div>
  )
}
