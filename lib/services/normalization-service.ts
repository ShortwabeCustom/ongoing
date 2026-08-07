import type { RawCSVRow } from './csv-parser'

export type FindingStatus = 'OPEN' | 'IN_REVIEW' | 'VALIDATED' | 'RESOLVED' | 'CLOSED'
export type ExperienceTag = 'UI' | 'UX' | 'COPY' | 'DESIGN' | 'DEVELOPMENT'

export interface NormalizedFinding {
  sourceRow: number
  observation: string
  area: string
  status: FindingStatus
  resolution?: string
  comments?: string
  experienceTags: ExperienceTag[]
  evidenceFiles: string[]
}

const STATUS_MAP: Record<string, FindingStatus> = {
  'Completado': 'VALIDATED',
  'Pendiente': 'OPEN',
}

const AREA_TO_TAG_MAP: Record<string, ExperienceTag> = {
  'UI': 'UI',
  'UX': 'UX',
  'Copy': 'COPY',
  'Design': 'DESIGN',
  'Development': 'DEVELOPMENT',
}

export class NormalizationService {
  static normalizeRow(
    rawRow: RawCSVRow,
    rowIndex: number,
  ): NormalizedFinding | null {
    const observation = this.getString(rawRow, ['Observación', 'observation'])
    const area = this.getString(rawRow, ['Área', 'area', 'Area'])
    const statusRaw = this.getString(rawRow, ['Estatus', 'Status', 'status'])
    const resolution = this.getString(rawRow, ['Ajuste', 'Modificación', 'adjustment'])
    const comments = this.getString(rawRow, ['Comentarios', 'comments'])
    const evidenceRaw = this.getString(rawRow, ['Evidencias', 'evidence', 'Evidence'])

    if (!observation?.trim()) {
      return null
    }

    const status = STATUS_MAP[statusRaw] || 'OPEN'
    const sourceRow = parseInt(this.getString(rawRow, ['Fila fuente', 'sourceRow']) || String(rowIndex + 2), 10)

    const tag = area && area in AREA_TO_TAG_MAP ? AREA_TO_TAG_MAP[area as keyof typeof AREA_TO_TAG_MAP] : undefined
    const experienceTags: ExperienceTag[] = tag ? [tag] : []

    const evidenceFiles = evidenceRaw
      ?.split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean) || []

    return {
      sourceRow,
      observation: observation.trim(),
      area: area?.trim() || 'Unspecified',
      status,
      resolution: resolution?.trim(),
      comments: comments?.trim(),
      experienceTags,
      evidenceFiles,
    }
  }

  private static getString(row: RawCSVRow, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = row[key]
      if (value && typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
    return undefined
  }
}
