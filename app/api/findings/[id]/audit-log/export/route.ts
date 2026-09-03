import { NextRequest, NextResponse } from 'next/server'
import { AuditService } from '@/lib/services/audit-service'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'
import { FindingService } from '@/lib/services/finding-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // C-04: el CSV exportado incluye nombre y email del actor más el diff íntegro
  // antes/después. Exige sesión y VIEW_AUDIT_LOG_ANY, igual que la ruta de lectura.
  const { valid, user, error } = await checkRBAC(request, {
    allowedRoles: RBAC_PERMISSIONS.VIEW_AUDIT_LOG_ANY,
  })
  if (!valid) return error

  try {
    const { id: findingId } = await params
    await FindingService.assertFindingAccess(findingId, user)

    const csv = await AuditService.exportAuditLog(findingId)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-log-${findingId}.csv"`,
      },
    })
  } catch (error) {
    // El guard de acceso lanza NOT_FOUND igual que el resto de la app; se mapea
    // a 404 aquí en vez de colapsar todo en 500 como hacía este catch antes.
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json(
        { status: 'error', message: 'Finding not found' },
        { status: 404 },
      )
    }

    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Export failed',
      },
      { status: 500 },
    )
  }
}
