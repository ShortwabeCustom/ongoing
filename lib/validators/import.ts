import { z } from 'zod'

const MAX_FILE_SIZE = parseInt(process.env.NEXT_PUBLIC_IMPORT_MAX_FILE_SIZE || '52428800', 10) // 50MB default

export const ImportPreviewSchema = z.object({
  file: z
    .instanceof(File)
    .refine(
      (f) => ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'].includes(f.type),
      'Only XLSX or CSV files allowed'
    )
    .refine((f) => f.size <= MAX_FILE_SIZE, `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`),
  projectId: z.string().min(5),
  testSessionId: z.string().min(5).optional(),
})

export const ImportConfirmSchema = z.object({
  batchId: z.string().min(5),
  confirm: z.boolean().refine((v) => v === true, 'Confirmation required'),
})

export type ImportPreview = z.infer<typeof ImportPreviewSchema>
export type ImportConfirm = z.infer<typeof ImportConfirmSchema>

// Import preview result (returned from API)
export interface ImportPreviewResult {
  batchId: string
  summary: {
    totalRows: number
    validRows: number
    skippedRows: number
    newFindings: number
    potentialDuplicates: number
    duplicateRows: number
  }
  file: {
    name: string
    type: 'csv' | 'xlsx'
    sheets: Array<{
      name: string
      rows: number
      headers: string[]
      embeddedImageCount: number
    }>
    recognizedColumns: string[]
    unknownColumns: string[]
  }
  incidences: ImportIncidence[]
  preview: {
    rows: ImportPreviewRow[]
  }
}

export interface ImportIncidence {
  row: number
  sheet?: string
  type:
    | 'EMPTY_OBSERVATION'
    | 'INVALID_STATUS'
    | 'INVALID_AREA'
    | 'MISSING_EVIDENCE'
    | 'DUPLICATE'
    | 'UNKNOWN_COLUMN'
    | 'EMBEDDED_IMAGES_NOT_EXTRACTED'
    | 'OTHER'
  message: string
  severity: 'warning' | 'error'
}

export interface ImportPreviewRow {
  sourceRow: number
  observation: string
  area: string
  status: string
  evidenceFiles: string[]
  fingerprint: string
  isDuplicate: boolean
  isValid: boolean
}
