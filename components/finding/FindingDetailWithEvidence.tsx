'use client'

import { Finding, Evidence } from '@/lib/types'
import { MapPin, AlertTriangle, Flag, ShieldAlert, User, CalendarDays, Hash, Workflow as WorkflowIcon, Pencil } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useLookups } from '@/lib/hooks/useLookups'
import { EditFindingDialog } from '@/components/finding/EditFindingDialog'
import { FindingScreensSection } from '@/components/finding/FindingScreensSection'
import { FindingEvidenceSection } from '@/components/finding/FindingEvidenceSection'
import { SupportLinksList } from '@/components/finding/SupportLinksList'
import { FindingComments, type FindingComment } from '@/components/finding/FindingComments'
import {
  EXPERIENCE_TAG_LABELS_ES,
  INCIDENCE_TYPE_LABELS_ES,
  PRIORITY_LABELS_ES,
  SEVERITY_LABELS_ES,
} from '@/lib/constants/finding-options'

interface FindingDetailWithEvidenceProps {
  finding: Finding & { evidence?: Evidence[]; comments?: FindingComment[] }
  actions?: ReactNode
}

export function FindingDetailWithEvidence({
  finding,
  actions,
}: FindingDetailWithEvidenceProps) {
  const auth = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const { assignees } = useLookups(finding.projectId)
  const canEdit = Boolean(auth.user?.role && ['OWNER', 'QA_LEAD'].includes(auth.user.role))
  const areaValues = finding.experienceTags?.map((tag) => tag.experienceTag) ?? []
  const incidenceValues = finding.incidenceTypes?.map((type) => type.incidenceType) ?? []
  const labeledArea = areaValues.map((tag) => EXPERIENCE_TAG_LABELS_ES[tag] ?? tag).join(', ')
  const area = finding.area ?? (labeledArea || '-')
  const incidenceTypes =
    incidenceValues.map((type) => INCIDENCE_TYPE_LABELS_ES[type] ?? type).join(', ') || '-'
  const assigneeName = (finding as any).assignee?.name ?? '-'
  const classificationLabel = incidenceValues.length || areaValues.length ? 'Clasificado' : 'Sin clasificar'
  const screenSlots = [
    {
      title: 'Pantalla anterior',
      caption: 'Pantalla anterior',
      legacyValue: finding.previousScreen,
    },
    {
      title: 'Pantalla actual',
      caption: 'Pantalla actual',
      legacyValue: finding.currentScreen,
    },
  ]

  const findScreenEvidence = (caption: string) => {
    const normalizedCaption = caption.toLowerCase()

    return (
      (finding.evidence ?? []).find(
        (item) =>
          item.mimeType.startsWith('image/') &&
          item.caption?.toLowerCase().trim() === normalizedCaption,
      ) ??
      (finding.evidence ?? []).find(
        (item) =>
          item.mimeType.startsWith('image/') &&
          item.caption?.toLowerCase().includes(normalizedCaption),
      )
    )
  }

  const createdDate = typeof finding.createdAt === 'string'
    ? new Date(finding.createdAt).toLocaleDateString('es-ES')
    : (finding.createdAt instanceof Date
        ? finding.createdAt.toLocaleDateString('es-ES')
        : '-')

  const metaFields = [
    { icon: MapPin, label: 'Área', value: area },
    { icon: AlertTriangle, label: 'Incidencia', value: incidenceTypes },
    { icon: Flag, label: 'Prioridad', value: PRIORITY_LABELS_ES[finding.priority] ?? finding.priority },
    { icon: ShieldAlert, label: 'Severidad', value: SEVERITY_LABELS_ES[finding.severity] ?? finding.severity },
    { icon: User, label: 'Responsable', value: assigneeName },
    { icon: CalendarDays, label: 'Creado', value: createdDate },
    { icon: Hash, label: 'Versión', value: finding.version.toString() },
    ...(finding.flowStep
      ? [{ icon: WorkflowIcon, label: 'Paso del flujo', value: finding.flowStep }]
      : []),
  ]

  return (
    <div className="space-y-6">
      <section className="pm-card p-6 md:p-8">
        <div
          className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          role="group"
          aria-label="Acciones del hallazgo"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {actions}
            <span className="rounded-full border border-[#dbe4dd] bg-white px-3 py-1.5 text-xs font-semibold text-[#3d4d45]">
              {classificationLabel}
            </span>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#052b20] px-4 text-sm font-semibold text-white transition hover:bg-[#0b3e30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a85a] focus-visible:ring-offset-2"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editar hallazgo
            </button>
          )}
        </div>
      </section>

      <section className="pm-card p-6 md:p-8">
        <h3 className="mb-6 text-xl font-bold text-[#17251f]">Detalles del hallazgo</h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {metaFields.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e0f5e9] text-[#052b20]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#65766e]">{label}</p>
                <p className={`mt-0.5 text-sm font-semibold text-[#17251f] ${label === 'Incidencia' ? 'line-clamp-2' : 'truncate'}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <FindingComments
        findingId={finding.id}
        initialComments={finding.comments}
      />

      <FindingScreensSection
        finding={finding}
        screenSlots={screenSlots}
        findScreenEvidence={findScreenEvidence}
      />

      <FindingEvidenceSection
        finding={finding}
        evidence={finding.evidence || []}
      />

      <SupportLinksList
        links={(finding as any).supportLinks || []}
      />

      <EditFindingDialog
        open={editOpen}
        finding={finding}
        assignees={assignees}
        onClose={() => setEditOpen(false)}
      />
    </div>
  )
}
