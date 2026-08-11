import { NextRequest, NextResponse } from 'next/server'
import { AuditService } from '@/lib/services/audit-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: findingId } = await params

    const csv = await AuditService.exportAuditLog(findingId)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-log-${findingId}.csv"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Export failed',
      },
      { status: 500 },
    )
  }
}
