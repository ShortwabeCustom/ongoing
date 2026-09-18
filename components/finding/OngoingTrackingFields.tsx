'use client'

import {
  CHANNEL_OPTIONS,
  FINDING_TYPE_LABELS_ES,
  FINDING_TYPE_OPTIONS,
  INTERFACE_MODE_LABELS_ES,
  INTERFACE_MODE_OPTIONS,
} from '@/lib/constants/finding-options'

/** '' = sin dato. Las aprobaciones usan 'true' | 'false' para distinguir "No" de "sin dato". */
export type OngoingTrackingValues = {
  findingType: string
  channel: string
  jiraId: string
  interfaceMode: string
  approvalInternal: string
  approvalBusiness: string
  approvalTech: string
}

type FindingOngoingSource = {
  findingType?: string | null
  channel?: string | null
  jiraId?: string | null
  interfaceMode?: string | null
  approvalInternal?: boolean | null
  approvalBusiness?: boolean | null
  approvalTech?: boolean | null
}

export const EMPTY_ONGOING_VALUES: OngoingTrackingValues = {
  findingType: '',
  channel: '',
  jiraId: '',
  interfaceMode: '',
  approvalInternal: '',
  approvalBusiness: '',
  approvalTech: '',
}

const boolToField = (value: boolean | null | undefined) => (value == null ? '' : value ? 'true' : 'false')
const fieldToBool = (value: string) => (value === '' ? null : value === 'true')

export function ongoingValuesFromFinding(finding: FindingOngoingSource): OngoingTrackingValues {
  return {
    findingType: finding.findingType ?? '',
    channel: finding.channel ?? '',
    jiraId: finding.jiraId ?? '',
    interfaceMode: finding.interfaceMode ?? '',
    approvalInternal: boolToField(finding.approvalInternal),
    approvalBusiness: boolToField(finding.approvalBusiness),
    approvalTech: boolToField(finding.approvalTech),
  }
}

/** Payload para la API: los campos vacíos viajan como `null` (limpian el valor en un PATCH). */
export function ongoingValuesToPayload(values: OngoingTrackingValues) {
  return {
    findingType: values.findingType || null,
    channel: values.channel.trim() || null,
    jiraId: values.jiraId.trim() || null,
    interfaceMode: values.interfaceMode || null,
    approvalInternal: fieldToBool(values.approvalInternal),
    approvalBusiness: fieldToBool(values.approvalBusiness),
    approvalTech: fieldToBool(values.approvalTech),
  }
}

type OngoingTrackingFieldsProps = {
  values: OngoingTrackingValues
  onChange: (patch: Partial<OngoingTrackingValues>) => void
}

const inputClass =
  'pm-input h-11 w-full px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#00a85a]'
const labelClass = 'space-y-2 text-sm font-semibold text-[#3d4d45]'

const APPROVALS: Array<{ key: 'approvalInternal' | 'approvalBusiness' | 'approvalTech'; label: string }> = [
  { key: 'approvalInternal', label: 'Vobo. interno' },
  { key: 'approvalBusiness', label: 'Vobo. negocio' },
  { key: 'approvalTech', label: 'Vobo. TI' },
]

export function OngoingTrackingFields({ values, onChange }: OngoingTrackingFieldsProps) {
  return (
    <div className="space-y-4 border-t-2 border-dashed border-[#dbe4dd] pt-5">
      <p className="text-sm font-semibold text-[#3d4d45]">Seguimiento ONGOING</p>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Tipo
          <select
            value={values.findingType}
            onChange={(event) => onChange({ findingType: event.target.value })}
            className={inputClass}
          >
            <option value="">Sin especificar</option>
            {FINDING_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {FINDING_TYPE_LABELS_ES[option]}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Canal
          <input
            list="ongoing-channel-options"
            value={values.channel}
            maxLength={60}
            onChange={(event) => onChange({ channel: event.target.value })}
            className={inputClass}
          />
          <datalist id="ongoing-channel-options">
            {CHANNEL_OPTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>

        <label className={labelClass}>
          ID Jira
          <input
            value={values.jiraId}
            maxLength={60}
            placeholder="CREODM-12345"
            onChange={(event) => onChange({ jiraId: event.target.value })}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Modo
          <select
            value={values.interfaceMode}
            onChange={(event) => onChange({ interfaceMode: event.target.value })}
            className={inputClass}
          >
            <option value="">Sin especificar</option>
            {INTERFACE_MODE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {INTERFACE_MODE_LABELS_ES[option]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {APPROVALS.map(({ key, label }) => (
          <label key={key} className={labelClass}>
            {label}
            <select
              value={values[key]}
              onChange={(event) => onChange({ [key]: event.target.value })}
              className={inputClass}
            >
              <option value="">Sin especificar</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </label>
        ))}
      </div>
    </div>
  )
}
