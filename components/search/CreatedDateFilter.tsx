'use client'

import { Calendar } from 'lucide-react'

interface CreatedDateOption {
  date: string
  label: string
  count: number
}

const TEST_SESSION_DATES: CreatedDateOption[] = [
  { date: '2026-07-30', label: '30 Jul', count: 100 },
  { date: '2026-07-31', label: '31 Jul', count: 15 },
  { date: '2026-08-03', label: '3 Ago', count: 1 },
  { date: '2026-08-04', label: '4 Ago', count: 48 },
  { date: '2026-08-06', label: '6 Ago', count: 3 },
  { date: '2026-08-10', label: '10 Ago', count: 17 },
  { date: '2026-08-11', label: '11 Ago', count: 11 },
  { date: '2026-08-12', label: '12 Ago', count: 10 },
]

interface CreatedDateFilterProps {
  selectedDate?: string
  onSelectDate: (date: string) => void
  onClearDate: () => void
}

export function CreatedDateFilter({
  selectedDate,
  onSelectDate,
  onClearDate,
}: CreatedDateFilterProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-[#17251f] mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        Creado (Test Session)
      </legend>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TEST_SESSION_DATES.map((option) => (
          <button
            key={option.date}
            type="button"
            onClick={() => onSelectDate(option.date)}
            className={`p-2 rounded-lg border text-xs font-medium transition-all flex flex-col items-center gap-1 ${
              selectedDate === option.date
                ? 'border-[#0369A1] bg-[#0369A1] text-white'
                : 'border-[#dbe4dd] bg-white text-[#17251f] hover:border-[#0369A1] hover:bg-[#f0f9ff]'
            }`}
          >
            <span>{option.label}</span>
            <span className={`text-xs ${selectedDate === option.date ? 'opacity-90' : 'text-[#65766e]'}`}>
              ({option.count})
            </span>
          </button>
        ))}
      </div>

      {selectedDate && (
        <button
          type="button"
          onClick={onClearDate}
          className="mt-3 text-xs text-[#0369A1] hover:text-[#0369A1] hover:underline font-medium"
        >
          Limpiar fecha
        </button>
      )}
    </fieldset>
  )
}
