import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db-lazy'
import { ImportService } from '@/lib/services/import-service'
import { getSession } from '@/lib/auth/lucia'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = getDb()
  const { id: batchId } = await params

  try {
    const session = await getSession()
    const user = session?.user as { id: string } | undefined
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

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

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File is required for confirmation' }, { status: 400 })
    }

    const result = await ImportService.confirmImport(
      batchId,
      batch.projectId,
      file,
      user.id,
      batch.testSessionId,
    )

    return NextResponse.json({
      success: true,
      importBatchId: result.importBatchId,
      findingsCreated: result.findingsCreated,
      duplicatesSkipped: result.duplicatesSkipped,
      skippedRows: result.skippedRows,
    })
  } catch (error) {
    console.error('Import confirm error:', error)

    try {
      await db.importBatch.update({
        where: { id: batchId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      })
    } catch (updateError) {
      console.error('Failed to update batch status:', updateError)
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import confirmation failed' },
      { status: 500 },
    )
  }
}
