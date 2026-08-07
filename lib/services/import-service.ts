import { getDb } from '@/lib/db-lazy'
import { parseCSV, type RawCSVRow } from './csv-parser'
import { NormalizationService, type NormalizedFinding } from './normalization-service'
import type { ImportPreviewResult, ImportIncidence, ImportPreviewRow } from '@/lib/validators/import'

export class ImportService {
  static async generatePreview(
    file: File,
    projectId: string,
    testSessionId?: string,
  ): Promise<ImportPreviewResult> {
    // Parse CSV
    const rawRows = await parseCSV(file)

    // Normalize rows
    const normalized: Array<{ raw: RawCSVRow; normalized: NormalizedFinding | null; rowIndex: number }> = rawRows.map(
      (raw, idx) => ({
        raw,
        normalized: NormalizationService.normalizeRow(raw, idx),
        rowIndex: idx,
      }),
    )

    // Generate incidences and count valid rows
    const incidences: ImportIncidence[] = []
    let validCount = 0
    let skippedCount = 0

    normalized.forEach((item, idx) => {
      if (!item.normalized) {
        skippedCount++
        const observation = item.raw['Observación'] || item.raw['observation'] || ''
        if (!observation?.trim()) {
          incidences.push({
            row: idx + 2,
            type: 'EMPTY_OBSERVATION',
            message: 'Fila sin observación',
            severity: 'warning',
          })
        }
        return
      }

      validCount++
    })

    // Create ImportBatch (PENDING status)
    const batchId = this.generateBatchId()

    // Build preview rows
    const previewRows: ImportPreviewRow[] = normalized
      .filter((item) => item.normalized !== null)
      .map((item) => ({
        sourceRow: item.normalized!.sourceRow,
        observation: item.normalized!.observation,
        area: item.normalized!.area,
        status: item.normalized!.status,
        evidenceFiles: item.normalized!.evidenceFiles,
        isValid: true,
      }))

    return {
      batchId,
      summary: {
        totalRows: rawRows.length,
        validRows: validCount,
        skippedRows: skippedCount,
        newFindings: validCount,
        potentialDuplicates: 0, // MVP: skip duplicate detection
      },
      incidences,
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
  ): Promise<{ importBatchId: string; findingsCreated: number }> {
    // Parse CSV
    const rawRows = await parseCSV(file)

    // Normalize and import within transaction
    const db = getDb()
    const result = await db.$transaction(async (tx: any) => {
      const normalizedRows: Array<{ normalized: NormalizedFinding; raw: RawCSVRow; rowIndex: number }> = []

      rawRows.forEach((raw, idx) => {
        const normalized = NormalizationService.normalizeRow(raw, idx)
        if (normalized) {
          normalizedRows.push({ normalized, raw, rowIndex: idx })
        }
      })

      // Create findings
      const createdFindings = []

      for (const item of normalizedRows) {
        const { normalized } = item

        const finding = await tx.finding.create({
          data: {
            projectId,
            testSessionId,
            observation: normalized.observation,
            status: normalized.status,
            sourceRow: normalized.sourceRow,
            importBatchId: batchId,
            createdBy: userId,
          },
        })

        // Create evidence records
        for (const filename of normalized.evidenceFiles) {
          await tx.evidence.create({
            data: {
              findingId: finding.id,
              type: 'IMAGE',
              storageKey: `evidence/${projectId}/${finding.id}/${filename}`,
              originalFilename: filename,
              mimeType: 'image/jpeg',
              createdBy: userId,
            },
          })
        }

        // Create experience tag mappings
        for (const tag of normalized.experienceTags) {
          await tx.findingExperienceTag.create({
            data: {
              findingId: finding.id,
              experienceTag: tag,
            },
          })
        }

        // Create status history
        await tx.findingStatusHistory.create({
          data: {
            findingId: finding.id,
            newStatus: normalized.status,
            previousStatus: null,
            action: 'IMPORT',
            changedBy: userId,
            reason: `Imported from ${file.name}`,
          },
        })

        createdFindings.push(finding)
      }

      // Update ImportBatch
      const batch = await tx.importBatch.update({
        where: { id: batchId },
        data: {
          status: 'COMPLETED',
          totalRows: rawRows.length,
          validRows: createdFindings.length,
          skippedRows: rawRows.length - createdFindings.length,
        },
      })

      // Create AuditLog
      await tx.auditLog.create({
        data: {
          action: 'IMPORT',
          resource: 'Finding',
          resourceId: createdFindings.map((f) => f.id).join(','),
          changes: {
            imported: createdFindings.length,
            file: file.name,
          },
          createdBy: userId,
        },
      })

      return batch
    })

    return {
      importBatchId: result.id,
      findingsCreated: result.validRows,
    }
  }

  private static generateBatchId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }
}
