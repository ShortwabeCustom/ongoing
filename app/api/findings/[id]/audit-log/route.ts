import { NextRequest } from 'next/server'
import { AuditService } from '@/lib/services/audit-service'
import { AuditLogFilterSchema } from '@/lib/validators/workflow'
import { apiSuccess, apiError } from '@/lib/utils/api-response'

function parseIntegerParam(value: string | null) {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: findingId } = await params
    const { searchParams } = new URL(request.url)

    const filter = AuditLogFilterSchema.parse({
      action: searchParams.get('action') || undefined,
      userId: searchParams.get('userId') || undefined,
      limit: parseIntegerParam(searchParams.get('limit')),
      offset: parseIntegerParam(searchParams.get('offset')),
    })

    const result = await AuditService.getAuditLog(findingId, filter)

    return apiSuccess({
      status: 'success',
      data: result,
    })
  } catch (error) {
    return apiError(error)
  }
}
