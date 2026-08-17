import { NextRequest, NextResponse } from 'next/server'
import { AuditService } from '@/lib/services/audit-service'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // C-04: el CSV exportado incluye nombre y email del actor más el diff íntegro
  // antes/después. Exige sesión y VIEW_AUDIT_LOG_ANY, igual que la ruta de lectura.
  const { valid, error } = await checkRBAC(request, {
    allowedRoles: RBAC_PERMISSIONS.VIEW_AUDIT_LOG_ANY,
  })
  if (!valid) return error

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
