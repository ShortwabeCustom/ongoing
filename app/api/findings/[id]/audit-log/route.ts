import { NextRequest, NextResponse } from 'next/server'
import { AuditService } from '@/lib/services/audit-service'
import { AuditLogFilterSchema } from '@/lib/validators/workflow'
import { apiSuccess, apiError } from '@/lib/utils/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const findingId = params.id
    const { searchParams } = new URL(request.url)

    const filter = AuditLogFilterSchema.parse({
      action: searchParams.get('action'),
      userId: searchParams.get('userId'),
      limit: parseInt(searchParams.get('limit') ?? '50'),
      offset: parseInt(searchParams.get('offset') ?? '0'),
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
