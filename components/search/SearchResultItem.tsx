'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import {
  EXPERIENCE_TAG_LABELS_ES,
  INCIDENCE_TYPE_LABELS_ES,
  PRIORITY_LABELS_ES,
  STATUS_LABELS_ES,
} from '@/lib/constants/finding-options'

interface SearchResultItemProps {
  id: string
  observation: string
  highlightedObservation?: string
  status: string
  priority: string
  severity: string
  projectId: string
  assigneeId?: string
  experienceTags?: Array<{ experienceTag: string }> | string[]
  incidenceTypes?: Array<{ incidenceType: string }> | string[]
  selected: boolean
  onToggleSelect: (id: string) => void
  showCheckbox: boolean
}

function readRelationValue(item: unknown, key: 'experienceTag' | 'incidenceType') {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return undefined

  const value = (item as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

export function SearchResultItem({
  id,
  observation,
  highlightedObservation,
  status,
  priority,
  severity,
  projectId,
  assigneeId,
  experienceTags,
  incidenceTypes,
  selected,
  onToggleSelect,
  showCheckbox,
}: SearchResultItemProps) {
  const displayObservation = highlightedObservation || observation
  const areaValues =
    experienceTags
      ?.map((tag) => readRelationValue(tag, 'experienceTag'))
      .filter((tag): tag is string => Boolean(tag)) ?? []
  const incidenceValues =
    incidenceTypes
      ?.map((type) => readRelationValue(type, 'incidenceType'))
      .filter((type): type is string => Boolean(type)) ?? []
  const areaLabel =
    areaValues.map((tag) => EXPERIENCE_TAG_LABELS_ES[tag] ?? tag).join(', ') ||
    incidenceValues.map((type) => INCIDENCE_TYPE_LABELS_ES[type] ?? type).join(', ') ||
    String(severity)

  return (
    <div className="flex items-start gap-3">
      {showCheckbox && (
        <label
          className="flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer shrink-0 mt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(id)}
            aria-label={`Seleccionar hallazgo ${id}`}
            className="h-5 w-5 rounded border-[#a8bab0] text-[#052b20] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
          />
        </label>
      )}

      <div className="min-w-0 flex-1 border-l border-[#dbe4dd] pl-3">
        <Link
          href={`/findings/${id}`}
          className="group/link flex items-start justify-between gap-3 text-base font-semibold leading-6 text-[#17251f] transition hover:text-[#087244] md:text-sm"
        >
          <span
            className="line-clamp-2"
            dangerouslySetInnerHTML={{
              __html: displayObservation,
            }}
          />
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#00a85a] opacity-0 transition group-hover/link:opacity-100" />
        </Link>

        <p className="mt-2 text-xs font-semibold text-[#65766e]">
          {STATUS_LABELS_ES[status] ?? status}
          <span className="px-1.5 text-[#a8bab0]">·</span>
          {PRIORITY_LABELS_ES[priority] ?? priority}
          <span className="px-1.5 text-[#a8bab0]">·</span>
          {areaLabel}
        </p>
      </div>
    </div>
  )
}
