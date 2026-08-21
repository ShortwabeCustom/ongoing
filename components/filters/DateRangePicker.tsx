'use client'

import * as React from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { useMediaQuery } from '@base-ui/react/unstable-use-media-query'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday as isTodayFn,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { PopoverContent, useExclusivePopover } from '@/components/ui/popover'
import { FilterTrigger } from './FilterTrigger'
import { QuickDatePresets, type QuickDatePresetOption } from './QuickDatePresets'

export interface DateRange {
  from?: Date
  to?: Date
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  fromLabel?: string
  toLabel?: string
  disabled?: boolean
  isDateDisabled?: (date: Date) => boolean
  className?: string
  /**
   * 'fields' (default): two "Desde"/"Hasta" boxes, both open the same
   * calendar — used by AnalysisPeriodPanel's sidebar.
   * 'button': a single FilterTrigger pill labeled `triggerLabel`, showing
   * "· Activa" when a range is set — used inline in a filter bar (Findings)
   * alongside Estado/Prioridad/etc.
   */
  variant?: 'fields' | 'button'
  /** Label for the 'button' variant. @default 'Fecha' */
  triggerLabel?: string
  /**
   * Quick-range shortcuts rendered inside this same popover, above the
   * calendar (section 38: one popover, not a second one). Only meaningful
   * for `variant="button"` — Analytics keeps its own presets next to its own
   * DateRangePicker instance (`variant="fields"`) instead of inside here, so
   * it doesn't pass this prop.
   */
  presets?: QuickDatePresetOption[]
  /** Active preset key, or `undefined` for a custom/no range. */
  presetValue?: string
  /** Selecting a preset applies it immediately and closes the popover. */
  onPresetChange?: (key: string) => void
}

const WEEKDAY_LABELS = [
  { short: 'L', full: 'lunes' },
  { short: 'M', full: 'martes' },
  { short: 'M', full: 'miércoles' },
  { short: 'J', full: 'jueves' },
  { short: 'V', full: 'viernes' },
  { short: 'S', full: 'sábado' },
  { short: 'D', full: 'domingo' },
]

function formatDisplayDate(date?: Date): string {
  if (!date) return 'dd/mm/aaaa'
  return format(date, 'dd/MM/yyyy')
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

interface MonthGridProps {
  month: Date
  draft: DateRange
  hoverDate: Date | null
  focusedDate: Date
  onHoverDate: (date: Date | null) => void
  onSelectDate: (date: Date) => void
  onFocusDate: (date: Date) => void
  onKeyNavigate: (event: React.KeyboardEvent, date: Date) => void
  isDateDisabled?: (date: Date) => boolean
  buttonRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>
}

function MonthGrid({
  month,
  draft,
  hoverDate,
  focusedDate,
  onHoverDate,
  onSelectDate,
  onFocusDate,
  onKeyNavigate,
  isDateDisabled,
  buttonRefs,
}: MonthGridProps) {
  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [month])

  const previewRange = React.useMemo(() => {
    if (!draft.from || draft.to || !hoverDate) return null
    return isBefore(hoverDate, draft.from)
      ? { start: hoverDate, end: draft.from }
      : { start: draft.from, end: hoverDate }
  }, [draft, hoverDate])

  return (
    <table className="w-full border-collapse select-none" role="grid" aria-label={capitalize(format(month, 'LLLL yyyy', { locale: es }))}>
      <caption className="mb-2 text-sm font-semibold text-foreground">
        {capitalize(format(month, 'LLLL yyyy', { locale: es }))}
      </caption>
      <thead>
        <tr>
          {WEEKDAY_LABELS.map((weekday, index) => (
            <th key={index} scope="col" className="pb-1 text-xs font-medium text-muted-foreground" abbr={weekday.full}>
              <abbr title={weekday.full} className="no-underline">
                {weekday.short}
              </abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: days.length / 7 }).map((_, weekIndex) => (
          <tr key={weekIndex}>
            {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day) => {
              const outsideMonth = !isSameMonth(day, month)
              const disabled = isDateDisabled?.(day) ?? false
              const isStart = draft.from && isSameDay(day, draft.from)
              const isEnd = draft.to && isSameDay(day, draft.to)
              const isSingle = isStart && !draft.to
              const isInRange =
                draft.from && draft.to && isWithinInterval(day, { start: draft.from, end: draft.to })
              const isPreview =
                !isInRange && previewRange && isWithinInterval(day, previewRange) && !isStart

              return (
                <td key={dateKey(day)} className="p-0 text-center">
                  <button
                    ref={(el) => {
                      if (el) buttonRefs.current.set(dateKey(day), el)
                      else buttonRefs.current.delete(dateKey(day))
                    }}
                    type="button"
                    role="gridcell"
                    disabled={disabled}
                    tabIndex={isSameDay(day, focusedDate) ? 0 : -1}
                    aria-selected={Boolean(isStart || isEnd)}
                    aria-current={isTodayFn(day) ? 'date' : undefined}
                    aria-label={format(day, 'd MMMM yyyy', { locale: es })}
                    onFocus={() => onFocusDate(day)}
                    onMouseEnter={() => onHoverDate(day)}
                    onMouseLeave={() => onHoverDate(null)}
                    onClick={() => onSelectDate(day)}
                    onKeyDown={(event) => onKeyNavigate(event, day)}
                    className={cn(
                      'relative size-11 text-sm outline-none transition-colors',
                      outsideMonth && 'text-muted-foreground/50',
                      !outsideMonth && !isStart && !isEnd && 'text-foreground',
                      'hover:bg-muted',
                      'focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50',
                      (isInRange || isPreview) && 'bg-primary/10',
                      isStart && !isSingle && 'rounded-l-full bg-primary font-semibold text-primary-foreground hover:bg-primary',
                      isEnd && !isSingle && 'rounded-r-full bg-primary font-semibold text-primary-foreground hover:bg-primary',
                      isSingle && 'rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary',
                      isTodayFn(day) && !isStart && !isEnd && 'font-semibold underline decoration-2 underline-offset-4',
                      disabled && 'cursor-not-allowed text-muted-foreground/40 hover:bg-transparent',
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Shared calendar for Findings and Analytics. Pure Date in/out — no query
 * params, router, or fetch inside. Selection is transactional (Cancelar /
 * Aplicar); nothing is committed via `onChange` until Aplicar is pressed, so
 * a half-picked range never triggers a data reload.
 */
function DateRangePicker({
  value,
  onChange,
  fromLabel = 'Desde',
  toLabel = 'Hasta',
  disabled,
  isDateDisabled,
  className,
  variant = 'fields',
  triggerLabel = 'Fecha',
  presets,
  presetValue,
  onPresetChange,
}: DateRangePickerProps) {
  const [draft, setDraft] = React.useState<DateRange>(value)
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(value.from ?? new Date())
  const [hoverDate, setHoverDate] = React.useState<Date | null>(null)
  const [focusedDate, setFocusedDate] = React.useState<Date>(value.from ?? new Date())
  const actionsRef = React.useRef<PopoverPrimitive.Root.Actions>(null)
  const buttonRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map())
  const pendingFocusRef = React.useRef(false)
  const notifyExclusive = useExclusivePopover()

  const isTwoMonth = useMediaQuery('(min-width: 900px)', { defaultMatches: true })

  React.useEffect(() => {
    if (pendingFocusRef.current) {
      buttonRefs.current.get(dateKey(focusedDate))?.focus()
      pendingFocusRef.current = false
    }
  }, [focusedDate, visibleMonth])

  function handleOpenChange(open: boolean) {
    notifyExclusive(open, () => actionsRef.current?.close())
    if (open) {
      setDraft(value)
      const anchor = value.from ?? new Date()
      setVisibleMonth(anchor)
      setFocusedDate(anchor)
    }
  }

  function handleSelectDate(day: Date) {
    if (isDateDisabled?.(day)) return

    setDraft((current) => {
      if (!current.from || current.to) {
        return { from: day, to: undefined }
      }
      // Section 27 decision: reorder automatically instead of forcing the
      // user to restart the selection when they pick an earlier date second.
      if (isBefore(day, current.from)) {
        return { from: day, to: current.from }
      }
      return { from: current.from, to: day }
    })
  }

  function handleKeyNavigate(event: React.KeyboardEvent, day: Date) {
    let next: Date

    switch (event.key) {
      case 'ArrowLeft':
        next = addDays(day, -1)
        break
      case 'ArrowRight':
        next = addDays(day, 1)
        break
      case 'ArrowUp':
        next = addWeeks(day, -1)
        break
      case 'ArrowDown':
        next = addWeeks(day, 1)
        break
      case 'Home':
        next = startOfWeek(day, { weekStartsOn: 1 })
        break
      case 'End':
        next = endOfWeek(day, { weekStartsOn: 1 })
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        handleSelectDate(day)
        return
      default:
        return
    }

    event.preventDefault()
    pendingFocusRef.current = true
    setFocusedDate(next)

    const monthsAhead = isTwoMonth ? 1 : 0
    if (isBefore(next, startOfMonth(visibleMonth))) {
      setVisibleMonth(startOfMonth(next))
    } else if (isAfter(next, endOfMonth(addMonths(visibleMonth, monthsAhead)))) {
      setVisibleMonth(startOfMonth(monthsAhead ? subMonths(next, monthsAhead) : next))
    }
  }

  function handleClear() {
    setDraft({ from: undefined, to: undefined })
  }

  function handleCancel() {
    setDraft(value)
    actionsRef.current?.close()
  }

  function handleApply() {
    const from = draft.from
    const to = draft.to ?? draft.from
    onChange(from ? { from, to } : { from: undefined, to: undefined })
    actionsRef.current?.close()
  }

  function handlePresetSelect(key: string) {
    onPresetChange?.(key)
    actionsRef.current?.close()
  }

  const secondMonth = addMonths(visibleMonth, 1)
  const hasRange = Boolean(value.from)

  return (
    <PopoverPrimitive.Root actionsRef={actionsRef} onOpenChange={handleOpenChange}>
      {variant === 'button' ? (
        <FilterTrigger
          label={triggerLabel}
          activeLabel={hasRange ? 'Activa' : undefined}
          disabled={disabled}
          className={className}
        />
      ) : (
      <div className={cn('flex items-end gap-2', className)}>
        <PopoverPrimitive.Trigger
          disabled={disabled}
          className={cn(
            'flex h-10 min-w-[9.5rem] flex-col justify-center rounded-lg border border-input bg-background px-3 text-left outline-none transition-colors',
            'hover:border-ring/60',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'data-[popup-open]:border-ring',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <span className="text-[11px] font-medium text-muted-foreground">{fromLabel}</span>
          <span className="text-sm text-foreground">{formatDisplayDate(value.from)}</span>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Trigger
          disabled={disabled}
          className={cn(
            'flex h-10 min-w-[9.5rem] flex-col justify-center rounded-lg border border-input bg-background px-3 text-left outline-none transition-colors',
            'hover:border-ring/60',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'data-[popup-open]:border-ring',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <span className="text-[11px] font-medium text-muted-foreground">{toLabel}</span>
          <span className="text-sm text-foreground">{formatDisplayDate(value.to)}</span>
        </PopoverPrimitive.Trigger>
      </div>
      )}

      <PopoverContent width="auto" positionerClassName="w-auto" className="p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          {presets ? triggerLabel : 'Rango de fechas'}
        </div>

        {presets && (
          <div className="mb-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rango rápido</p>
            <QuickDatePresets presets={presets} value={presetValue} onChange={handlePresetSelect} />
          </div>
        )}

        <div className={cn(presets && 'border-t border-border pt-3')}>
          {presets && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rango personalizado
            </p>
          )}

        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setVisibleMonth((m) => subMonths(m, 1))}
            className="rounded-md p-1.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
            className="rounded-md p-1.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className={cn('flex gap-4', isTwoMonth ? 'flex-row' : 'flex-col')}>
          <MonthGrid
            month={visibleMonth}
            draft={draft}
            hoverDate={hoverDate}
            focusedDate={focusedDate}
            onHoverDate={setHoverDate}
            onSelectDate={handleSelectDate}
            onFocusDate={setFocusedDate}
            onKeyNavigate={handleKeyNavigate}
            isDateDisabled={isDateDisabled}
            buttonRefs={buttonRefs}
          />
          {isTwoMonth && (
            <MonthGrid
              month={secondMonth}
              draft={draft}
              hoverDate={hoverDate}
              focusedDate={focusedDate}
              onHoverDate={setHoverDate}
              onSelectDate={handleSelectDate}
              onFocusDate={setFocusedDate}
              onKeyNavigate={handleKeyNavigate}
              isDateDisabled={isDateDisabled}
              buttonRefs={buttonRefs}
            />
          )}
        </div>

        <div className="mt-3 flex items-center gap-3 border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">{fromLabel}</span>
          <span className="font-medium text-foreground">{formatDisplayDate(draft.from)}</span>
          <span className="text-muted-foreground">{toLabel}</span>
          <span className="font-medium text-foreground">{formatDisplayDate(draft.to ?? draft.from)}</span>
        </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={handleClear}
            className="h-10 rounded-md px-2.5 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Limpiar
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="h-10 rounded-md border border-border px-3 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Aplicar
            </button>
          </div>
        </div>
      </PopoverContent>
    </PopoverPrimitive.Root>
  )
}

export { DateRangePicker }
