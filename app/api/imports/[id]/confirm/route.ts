import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db-lazy'
import { ImportService } from '@/lib/services/import-service'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = getDb()
  try {
    const { id: batchId } = await params

    // Get ImportBatch
    const batch = await db.importBatch.findUnique({
      where: { id: batchId },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })
    }

    if (batch.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cannot confirm import with status ${batch.status}` },
        { status: 400 },
      )
    }

    // Get file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File is required for confirmation' }, { status: 400 })
    }

    // Confirm import
    const result = await ImportService.confirmImport(
      batchId,
      batch.projectId,
      file,
      'system', // TODO: use actual user from auth
      batch.testSessionId,
    )

    return NextResponse.json({
      success: true,
      importBatchId: result.importBatchId,
      findingsCreated: result.findingsCreated,
    })
  } catch (error) {
    console.error('Import confirm error:', error)

    // Try to mark batch as FAILED
    try {
      const { id: batchId } = await params
      await db.importBatch.update({
        where: { id: batchId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      })
    } catch (e) {
      console.error('Failed to update batch status:', e)
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import confirmation failed' },
      { status: 500 },
    )
  }
}
