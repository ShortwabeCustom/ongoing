import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db-lazy'
import { checkRBAC, RBAC_PERMISSIONS } from '@/lib/middleware/rbac'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // P0-B (continuación): esta ruta no tenía NINGUNA comprobación de sesión ni de rol y
  // exponía metadatos internos de lotes de importación (fichero de origen, tamaño, recuento
  // de filas, mensajes de error, proyecto y sesión de prueba) a cualquier visitante anónimo.
  // Se cablea CREATE_FINDING porque este endpoint pertenece al pipeline de importación →
  // creación de hallazgos (sondeo del estado del lote), no a la lectura general de hallazgos:
  // los roles de solo lectura (BUSINESS_REVIEWER, VIEWER) no tienen por qué consultar
  // el estado interno de un trabajo de importación que nunca pueden lanzar.
  const { valid, error } = await checkRBAC(request, {
    allowedRoles: RBAC_PERMISSIONS.CREATE_FINDING,
  })
  if (!valid) return error

  try {
    const { id: batchId } = await params
    const db = getDb()

    const batch = await db.importBatch.findUnique({
      where: { id: batchId },
      include: {
        testSession: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: batch.id,
      status: batch.status,
      projectId: batch.projectId,
      testSessionId: batch.testSessionId,
      originalFilename: batch.originalFilename,
      fileSize: batch.fileSize,
      totalRows: batch.totalRows,
      validRows: batch.validRows,
      skippedRows: batch.skippedRows,
      errorMessage: batch.errorMessage,
      createdAt: batch.createdAt,
      importedAt: batch.importedAt,
    })
  } catch (error) {
    console.error('Get import batch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get import batch' },
      { status: 500 },
    )
  }
}
