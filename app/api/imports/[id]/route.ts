import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db-lazy'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
