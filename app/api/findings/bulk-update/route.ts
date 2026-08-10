import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db-lazy'
import { SearchService } from '@/lib/services/search-service'
import { apiSuccess, apiError, ApiError } from '@/lib/utils/api-response'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export const dynamic = 'force-dynamic'

const BulkUpdateSchema = z.object({
  ids: z.array(z.string().min(5)).min(1, 'At least one ID required').max(100, 'Maximum 100 IDs allowed'),
  updates: z.object({
    status: z.enum(['OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION', 'VALIDATED', 'CLOSED', 'BLOCKED', 'REOPENED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    severity: z.enum(['COSMETIC', 'MINOR', 'MAJOR', 'BLOCKER']).optional(),
    assigneeId: z.string().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
  }).refine((data) => Object.keys(data).length > 0, 'At least one field to update is required'),
})

export async function POST(request: NextRequest) {
  try {
    const { valid, user, error } = await checkRBAC(request, {
      allowedRoles: RBAC_PERMISSIONS.EDIT_FINDING_ANY,
    })
    if (!valid) return error

    const body = await request.json()

    // Validate payload
    const validationResult = BulkUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Invalid bulk update data',
        validationResult.error.flatten().fieldErrors as Record<string, string[]>,
        400,
      )
    }

    const { ids, updates } = validationResult.data
    const db = getDb()

    // Prepare update data with metadata
    const updateData = {
      ...updates,
      version: { increment: 1 },
      updatedAt: new Date(),
      updatedBy: user.id,
    }

    // FASE 14: Atomic transaction for consistency
    const results = await db.$transaction(async (tx) => {
      // Bulk update all findings in one operation
      const updateResult = await tx.finding.updateMany({
        where: {
          id: { in: ids },
          deletedAt: null,
        },
        data: updateData,
      })

      // Fetch updated findings
      const updatedFindings = await tx.finding.findMany({
        where: {
          id: { in: ids },
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
          priority: true,
          severity: true,
          assigneeId: true,
          version: true,
          updatedAt: true,
        },
      })

      // Map results: successful if found, failed if not found
      const resultMap = new Map(updatedFindings.map((f) => [f.id, f]))
      return ids.map((id) => {
        const found = resultMap.get(id)
        return found
          ? { id, ...found }
          : { id, error: 'NOT_FOUND' }
      })
    })

    const successful = results.filter((r) => !('error' in r))
    const failed = results.filter((r) => 'error' in r)

    // FASE 14: Index updated findings in Elasticsearch (fire-and-forget)
    if (successful.length > 0) {
      const findingsToIndex = await db.finding.findMany({
        where: {
          id: { in: successful.map((r) => r.id) },
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

      const indexDocuments = findingsToIndex.map((finding) => {
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

      void SearchService.bulkIndexFindings(indexDocuments)
    }

    // Determine response status
    const hasErrors = failed.length > 0
    const statusCode = hasErrors ? 207 : 200

    return apiSuccess(
      {
        updated: successful.length,
        failed: failed.length,
        results,
      },
      statusCode,
    )
  } catch (error) {
    return apiError(error)
  }
}
