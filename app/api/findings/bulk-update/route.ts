import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db-lazy'
import { apiSuccess, apiError, ApiError } from '@/lib/utils/api-response'

export const dynamic = 'force-dynamic'

const BulkUpdateSchema = z.object({
  ids: z.array(z.string().min(5)).min(1, 'At least one ID required'),
  updates: z.object({
    status: z.enum(['OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION', 'VALIDATED', 'CLOSED', 'BLOCKED', 'REOPENED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    severity: z.enum(['COSMETIC', 'MINOR', 'MAJOR', 'BLOCKER']).optional(),
    assigneeId: z.string().optional().nullable(),
  }).refine((data) => Object.keys(data).length > 0, 'At least one field to update is required'),
})

export async function POST(request: NextRequest) {
  try {
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

    // Update all findings in parallel
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const updated = await db.finding.updateMany({
            where: {
              id,
              deletedAt: null,
            },
            data: {
              ...updates,
              version: { increment: 1 },
              updatedAt: new Date(),
              updatedBy: 'system', // TODO: use actual user from auth in FASE 7
            },
          })

          if (updated.count === 0) {
            return {
              id,
              error: 'NOT_FOUND',
            }
          }

          // Fetch updated record
          const record = await db.finding.findUnique({
            where: { id },
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

          return {
            id,
            ...record,
          }
        } catch (error) {
          return {
            id,
            error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
          }
        }
      }),
    )

    // Separate successful and failed updates
    const successful = results.filter((r) => !('error' in r))
    const failed = results.filter((r) => 'error' in r)

    // Determine response status
    const hasErrors = failed.length > 0
    const statusCode = hasErrors ? 207 : 200 // 207 Multi-Status for partial success

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
