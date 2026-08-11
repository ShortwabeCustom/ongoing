import { randomUUID } from 'crypto'
import { getDb } from '@/lib/db-lazy'
import { parseImportFile, type ParsedImportFile } from './import-parser'
import {
  NormalizationService,
  type NormalizedFinding,
  type NormalizedImportRow,
} from './normalization-service'
import { SearchService } from '@/lib/services/search-service'
import type { ImportPreviewResult, ImportIncidence, ImportPreviewRow } from '@/lib/validators/import'

const KNOWN_COLUMNS = new Set([
  'ID',
  'Ronda',
  'Fila fuente',
  'Observación',
  'Ajuste',
  'Comentarios',
  'Estatus',
  'Estado',
  'Área',
  'Area',
  'Etapa',
  'Evidencias',
  'Evidencia',
])

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function normalizeImportRows(
  parsed: ParsedImportFile,
  projectId: string,
  testSessionId?: string,
): NormalizedImportRow[] {
  return parsed.sheets.flatMap((sheet) =>
    sheet.rows.map((row) =>
      NormalizationService.normalizeRow(row.data, {
        projectId,
        testSessionId,
        sourceSheet: sheet.name,
        sourceRow: row.sourceRow,
      }),
    ),
  )
}

function rowKey(row: Pick<NormalizedImportRow, 'sourceSheet' | 'sourceRow'>): string {
  return `${row.sourceSheet}:${row.sourceRow}`
}

function duplicateRowKeys(rows: NormalizedImportRow[]): Set<string> {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  rows.forEach((row) => {
    if (!row.normalized) return

    if (seen.has(row.normalized.fingerprint)) {
      duplicates.add(rowKey(row))
    } else {
      seen.add(row.normalized.fingerprint)
    }
  })

  return duplicates
}

async function existingFingerprints(fingerprints: string[]): Promise<Set<string>> {
  if (fingerprints.length === 0) return new Set()

  const db = getDb()
  const existing = await db.finding.findMany({
    where: {
      sourceFingerprint: {
        in: fingerprints,
      },
      deletedAt: null,
    },
    select: {
      sourceFingerprint: true,
    },
  })

  return new Set(
    existing
      .map((finding) => finding.sourceFingerprint)
      .filter((fingerprint): fingerprint is string => !!fingerprint),
  )
}

function buildColumnReport(parsed: ParsedImportFile) {
  const headers = unique(parsed.sheets.flatMap((sheet) => sheet.headers))
  const recognizedColumns = headers.filter((header) => KNOWN_COLUMNS.has(header))
  const unknownColumns = headers.filter((header) => !KNOWN_COLUMNS.has(header))

  return { recognizedColumns, unknownColumns }
}

function buildIncidences(
  parsed: ParsedImportFile,
  rows: NormalizedImportRow[],
  existing: Set<string>,
  duplicatesInFile: Set<string>,
): ImportIncidence[] {
  const incidences: ImportIncidence[] = []

  parsed.warnings.forEach((warning) => {
    incidences.push({
      row: 0,
      type: warning.includes('embedded image') ? 'EMBEDDED_IMAGES_NOT_EXTRACTED' : 'OTHER',
      message: warning,
      severity: 'warning',
    })
  })

  const { unknownColumns } = buildColumnReport(parsed)
  unknownColumns.forEach((column) => {
    incidences.push({
      row: 0,
      type: 'UNKNOWN_COLUMN',
      message: `Unknown column preserved but not mapped: ${column}`,
      severity: 'warning',
    })
  })

  rows.forEach((row) => {
    if (!row.normalized) {
      incidences.push({
        sheet: row.sourceSheet,
        row: row.sourceRow,
        type: 'EMPTY_OBSERVATION',
        message: 'Fila sin observación; no se convertirá en Finding.',
        severity: 'warning',
      })
      return
    }

    row.warnings.forEach((warning) => {
      incidences.push({
        sheet: row.sourceSheet,
        row: row.sourceRow,
        type: warning.includes('Evidence')
          ? 'MISSING_EVIDENCE'
          : warning.includes('area')
            ? 'INVALID_AREA'
            : warning.includes('status')
              ? 'INVALID_STATUS'
              : 'OTHER',
        message: warning,
        severity: 'warning',
      })
    })

    if (existing.has(row.normalized.fingerprint)) {
      incidences.push({
        sheet: row.sourceSheet,
        row: row.sourceRow,
        type: 'DUPLICATE',
        message: 'Ya existe un Finding con el mismo fingerprint.',
        severity: 'warning',
      })
    } else if (duplicatesInFile.has(rowKey(row))) {
      incidences.push({
        sheet: row.sourceSheet,
        row: row.sourceRow,
        type: 'DUPLICATE',
        message: 'Fingerprint duplicado dentro del archivo.',
        severity: 'warning',
      })
    }
  })

  return incidences
}

export class ImportService {
  static async generatePreview(
    file: File,
    projectId: string,
    testSessionId?: string,
  ): Promise<ImportPreviewResult> {
    const parsed = await parseImportFile(file)
    const normalizedRows = normalizeImportRows(parsed, projectId, testSessionId)
    const validRows = normalizedRows
      .map((row) => row.normalized)
      .filter((row): row is NormalizedFinding => row !== null)

    const duplicatesInFile = duplicateRowKeys(normalizedRows)
    const existing = await existingFingerprints(validRows.map((row) => row.fingerprint))

    const previewRows: ImportPreviewRow[] = normalizedRows
      .filter((row): row is NormalizedImportRow & { normalized: NormalizedFinding } => row.normalized !== null)
      .map((row) => {
        const isDuplicate =
          existing.has(row.normalized.fingerprint) || duplicatesInFile.has(rowKey(row))
        return {
          sourceRow: row.normalized.sourceRow,
          observation: row.normalized.observation,
          area: row.normalized.area,
          status: row.normalized.status,
          evidenceFiles: row.normalized.evidenceFiles,
          fingerprint: row.normalized.fingerprint,
          isDuplicate,
          isValid: !isDuplicate,
        }
      })

    const duplicateRows = previewRows.filter((row) => row.isDuplicate).length
    const skippedRows = normalizedRows.length - validRows.length
    const { recognizedColumns, unknownColumns } = buildColumnReport(parsed)

    return {
      batchId: this.generateBatchId(),
      summary: {
        totalRows: normalizedRows.length,
        validRows: validRows.length,
        skippedRows,
        newFindings: validRows.length - duplicateRows,
        potentialDuplicates: duplicateRows,
        duplicateRows,
      },
      file: {
        name: parsed.fileName,
        type: parsed.fileType,
        sheets: parsed.sheets.map((sheet) => ({
          name: sheet.name,
          rows: sheet.rows.length,
          headers: sheet.headers,
          embeddedImageCount: sheet.embeddedImageCount,
        })),
        recognizedColumns,
        unknownColumns,
      },
      incidences: buildIncidences(parsed, normalizedRows, existing, duplicatesInFile),
      preview: {
        rows: previewRows,
      },
    }
  }

  static async confirmImport(
    batchId: string,
    projectId: string,
    file: File,
    userId: string,
    testSessionId: string,
  ): Promise<{
    importBatchId: string
    findingsCreated: number
    duplicatesSkipped: number
    skippedRows: number
  }> {
    const parsed = await parseImportFile(file)
    const normalizedRows = normalizeImportRows(parsed, projectId, testSessionId)
    const validRows = normalizedRows
      .map((row) => row.normalized)
      .filter((row): row is NormalizedFinding => row !== null)

    const seenInFile = new Set<string>()
    const rowsForImport: NormalizedFinding[] = []
    let duplicatesSkipped = 0

    const existingBefore = await existingFingerprints(validRows.map((row) => row.fingerprint))
    validRows.forEach((row) => {
      if (existingBefore.has(row.fingerprint) || seenInFile.has(row.fingerprint)) {
        duplicatesSkipped++
        return
      }
      seenInFile.add(row.fingerprint)
      rowsForImport.push(row)
    })

    const db = getDb()
    const result = await db.$transaction(async (tx) => {
      const createdFindings = []

      for (const normalized of rowsForImport) {
        const finding = await tx.finding.create({
          data: {
            projectId,
            testSessionId,
            observation: normalized.observation,
            status: normalized.status,
            sourceSheet: normalized.sourceSheet,
            sourceRow: normalized.sourceRow,
            sourceFingerprint: normalized.fingerprint,
            importBatchId: batchId,
            createdBy: userId,
          },
        })

        for (const evidence of normalized.evidenceRefs) {
          await tx.evidence.create({
            data: {
              findingId: finding.id,
              type: evidence.mimeType.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
              storageKey: evidence.storageKey,
              url: evidence.url,
              originalFilename: evidence.originalFilename,
              mimeType: evidence.mimeType,
              caption: evidence.originalRef,
              createdBy: userId,
            },
          })
        }

        for (const incidenceType of normalized.incidenceTypes) {
          await tx.findingIncidenceType.create({
            data: {
              findingId: finding.id,
              incidenceType,
            },
          })
        }

        for (const tag of normalized.experienceTags) {
          await tx.findingExperienceTag.create({
            data: {
              findingId: finding.id,
              experienceTag: tag,
            },
          })
        }

        if (normalized.adjustment) {
          await tx.resolution.create({
            data: {
              findingId: finding.id,
              description: normalized.adjustment,
              state: normalized.status === 'VALIDATED' ? 'IMPLEMENTED' : 'OPEN',
              createdBy: userId,
            },
          })
        }

        if (normalized.comments) {
          await tx.comment.create({
            data: {
              findingId: finding.id,
              text: normalized.comments,
              createdBy: userId,
            },
          })
        }

        await tx.findingStatusHistory.create({
          data: {
            findingId: finding.id,
            fromStatus: 'OPEN',
            toStatus: normalized.status,
            changedBy: userId,
            reason: `Imported from ${file.name}`,
          },
        })

        await tx.auditLog.create({
          data: {
            entityType: 'Finding',
            entityId: finding.id,
            action: 'IMPORT',
            actorId: userId,
            after: {
              status: finding.status,
              sourceSheet: finding.sourceSheet,
              sourceRow: finding.sourceRow,
              sourceFingerprint: finding.sourceFingerprint,
            },
          },
        })

        createdFindings.push(finding)
      }

      const batch = await tx.importBatch.update({
        where: { id: batchId },
        data: {
          status: 'COMPLETED',
          totalRows: normalizedRows.length,
          validRows: createdFindings.length,
          skippedRows: normalizedRows.length - createdFindings.length,
        },
      })

      return { batch, createdFindings }
    })

    if (result.createdFindings.length > 0) {
      const createdFindings = await db.finding.findMany({
        where: {
          importBatchId: batchId,
          deletedAt: null,
        },
        include: {
          evidence: {
            select: {
              caption: true,
              originalFilename: true,
            },
          },
        },
      })

      const findingsToIndex = createdFindings.map((finding) => {
        const evidenceDescriptions = (finding.evidence ?? [])
          .map((e) => [e.caption, e.originalFilename].filter(Boolean).join(' '))
          .join(' ')

        return {
          id: finding.id,
          observation: finding.observation,
          evidenceDescriptions,
          status: finding.status,
          priority: finding.priority,
          severity: finding.severity,
          assigneeId: finding.assigneeId || undefined,
          projectId: finding.projectId,
          evidenceCount: finding.evidence?.length || 0,
          createdAt: finding.createdAt,
          updatedAt: finding.updatedAt,
        }
      })

      void SearchService.bulkIndexFindings(findingsToIndex)
    }

    return {
      importBatchId: result.batch.id,
      findingsCreated: result.createdFindings.length,
      duplicatesSkipped,
      skippedRows: normalizedRows.length - validRows.length,
    }
  }

  private static generateBatchId(): string {
    return `imp_${randomUUID()}`
  }
}
