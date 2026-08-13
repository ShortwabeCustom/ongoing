import { existsSync } from 'fs'
import path from 'path'
import type { RawImportRow } from './import-parser'
import { generateFingerprint } from '@/lib/utils/fingerprint'

export type FindingStatus =
  | 'OPEN'
  | 'TRIAGED'
  | 'IN_PROGRESS'
  | 'READY_FOR_VALIDATION'
  | 'VALIDATED'
  | 'CLOSED'
  | 'BLOCKED'
  | 'REOPENED'

export type ExperienceTag = 'UI' | 'UX' | 'COPY' | 'DEV'
export type IncidenceType = 'DESIGN' | 'FUNCTIONALITY' | 'BUSINESS_RULE' | 'COPY'

export interface NormalizedEvidenceRef {
  originalRef: string
  originalFilename: string
  storageKey: string
  url?: string
  mimeType: string
  exists: boolean
}

export interface NormalizedFinding {
  sourceId?: string
  sourceSheet: string
  sourceRow: number
  round?: string
  stage?: string
  observation: string
  area: string
  status: FindingStatus
  adjustment?: string
  comments?: string
  incidenceTypes: IncidenceType[]
  experienceTags: ExperienceTag[]
  evidenceRefs: NormalizedEvidenceRef[]
  evidenceFiles: string[]
  fingerprint: string
}

export interface NormalizedImportRow {
  raw: RawImportRow
  normalized: NormalizedFinding | null
  sourceSheet: string
  sourceRow: number
  warnings: string[]
}

const STATUS_MAP: Record<string, FindingStatus> = {
  completado: 'VALIDATED',
  completed: 'VALIDATED',
  complete: 'VALIDATED',
  true: 'VALIDATED',
  verdadero: 'VALIDATED',
  pendiente: 'OPEN',
  pending: 'OPEN',
  false: 'OPEN',
  falso: 'OPEN',
  open: 'OPEN',
  triaged: 'TRIAGED',
  'in progress': 'IN_PROGRESS',
  in_progress: 'IN_PROGRESS',
  'ready for validation': 'READY_FOR_VALIDATION',
  ready_for_validation: 'READY_FOR_VALIDATION',
  validated: 'VALIDATED',
  closed: 'CLOSED',
  blocked: 'BLOCKED',
  reopened: 'REOPENED',
}

const AREA_MAP: Record<
  string,
  {
    incidenceTypes: IncidenceType[]
    experienceTags: ExperienceTag[]
    warning?: string
  }
> = {
  ui: { incidenceTypes: ['DESIGN'], experienceTags: ['UI'] },
  ux: { incidenceTypes: ['DESIGN'], experienceTags: ['UX'] },
  copy: { incidenceTypes: ['COPY'], experienceTags: ['COPY'] },
  dev: { incidenceTypes: ['FUNCTIONALITY'], experienceTags: ['DEV'] },
  funcionalidad: { incidenceTypes: ['FUNCTIONALITY'], experienceTags: [] },
  functionality: { incidenceTypes: ['FUNCTIONALITY'], experienceTags: [] },
  backend: {
    incidenceTypes: ['FUNCTIONALITY'],
    experienceTags: [],
    warning: 'Area Backend mapped to FUNCTIONALITY because the enum has no BACKEND value.',
  },
  negocio: { incidenceTypes: ['BUSINESS_RULE'], experienceTags: [] },
  business: { incidenceTypes: ['BUSINESS_RULE'], experienceTags: [] },
  'business rule': { incidenceTypes: ['BUSINESS_RULE'], experienceTags: [] },
}

const PUBLIC_IMAGES_DIR = path.join(process.cwd(), 'public', 'images')

function normalizeKey(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function splitEvidenceRefs(value: string | undefined): string[] {
  if (!value?.trim()) return []
  return value
    .split(/[|,\n;]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function mimeTypeFor(filename: string): string {
  const extension = path.extname(filename).toLowerCase()
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.png') return 'image/png'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  if (extension === '.pdf') return 'application/pdf'
  return 'application/octet-stream'
}

function resolveEvidence(ref: string): NormalizedEvidenceRef {
  const trimmed = ref.trim()
  const basename = path.basename(trimmed)
  const parsed = path.parse(basename)

  const candidates = [
    basename,
    `${parsed.name}.jpg`,
    `${parsed.name}.jpeg`,
    `${parsed.name}.png`,
    `${parsed.name}.webp`,
  ]

  const matched = candidates.find((candidate) =>
    existsSync(path.join(PUBLIC_IMAGES_DIR, candidate)),
  )

  if (matched) {
    return {
      originalRef: trimmed,
      originalFilename: basename,
      storageKey: `legacy/public/images/${matched}`,
      url: `/images/${matched}`,
      mimeType: mimeTypeFor(matched),
      exists: true,
    }
  }

  return {
    originalRef: trimmed,
    originalFilename: basename,
    storageKey: `legacy/unresolved/${basename}`,
    mimeType: mimeTypeFor(basename),
    exists: false,
  }
}

export class NormalizationService {
  static normalizeRow(
    rawRow: RawImportRow,
    context: {
      projectId: string
      testSessionId?: string
      sourceSheet: string
      sourceRow: number
    },
  ): NormalizedImportRow {
    const warnings: string[] = []
    const observation = this.getString(rawRow, ['Observación', 'Observation', 'observation'])
    const area = this.getString(rawRow, ['Área', 'Area', 'area'])?.trim() || 'Unspecified'
    const statusRaw = this.getString(rawRow, ['Estatus', 'Estado', 'Status', 'status'])
    const adjustment = this.getString(rawRow, ['Ajuste', 'Modificación', 'Modificacion', 'adjustment'])
    const comments = this.getString(rawRow, ['Comentarios', 'Comments', 'comments'])
    const evidenceRaw = this.getString(rawRow, ['Evidencias', 'Evidencia', 'Evidence', 'evidence'])
    const stage = this.getString(rawRow, ['Etapa', 'Stage', 'stage'])
    const round = this.getString(rawRow, ['Ronda', 'Round', 'round'])
    const sourceId = this.getString(rawRow, ['ID', 'Id', 'id'])
    const sourceRow = Number.parseInt(
      this.getString(rawRow, ['Fila fuente', 'Source row', 'sourceRow']) ?? String(context.sourceRow),
      10,
    )

    if (!observation?.trim()) {
      return {
        raw: rawRow,
        normalized: null,
        sourceSheet: context.sourceSheet,
        sourceRow: Number.isFinite(sourceRow) ? sourceRow : context.sourceRow,
        warnings: ['SKIPPED_EMPTY_OBSERVATION'],
      }
    }

    const normalizedStatus = STATUS_MAP[normalizeKey(statusRaw)] ?? 'OPEN'
    if (statusRaw && !STATUS_MAP[normalizeKey(statusRaw)]) {
      warnings.push(`Unknown status "${statusRaw}" mapped to OPEN.`)
    }

    const areaMapping = AREA_MAP[normalizeKey(area)]
    const incidenceTypes = areaMapping?.incidenceTypes ?? []
    const experienceTags = areaMapping?.experienceTags ?? []
    if (!areaMapping) {
      warnings.push(`Unknown area "${area}" left without category mapping.`)
    } else if (areaMapping.warning) {
      warnings.push(areaMapping.warning)
    }

    const evidenceRefs = splitEvidenceRefs(evidenceRaw).map(resolveEvidence)
    evidenceRefs
      .filter((evidence) => !evidence.exists)
      .forEach((evidence) => warnings.push(`Evidence reference not found: ${evidence.originalRef}`))

    const effectiveSourceRow = Number.isFinite(sourceRow) ? sourceRow : context.sourceRow
    const fingerprint = generateFingerprint(context.projectId, effectiveSourceRow, observation, {
      testSessionId: context.testSessionId,
      sourceSheet: context.sourceSheet,
      sourceId,
    })

    return {
      raw: rawRow,
      normalized: {
        sourceId,
        sourceSheet: context.sourceSheet,
        sourceRow: effectiveSourceRow,
        round: round?.trim(),
        stage: stage?.trim(),
        observation: observation.trim(),
        area,
        status: normalizedStatus,
        adjustment: adjustment?.trim(),
        comments: comments?.trim(),
        incidenceTypes,
        experienceTags,
        evidenceRefs,
        evidenceFiles: evidenceRefs.map((evidence) => evidence.originalRef),
        fingerprint,
      },
      sourceSheet: context.sourceSheet,
      sourceRow: effectiveSourceRow,
      warnings,
    }
  }

  private static getString(row: RawImportRow, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = row[key]
      if (value && typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
    return undefined
  }
}
