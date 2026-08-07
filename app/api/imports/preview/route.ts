import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ImportPreviewSchema } from '@/lib/validators/import'
import { ImportService } from '@/lib/services/import-service'
import { getDb } from '@/lib/db-lazy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string
    const testSessionId = formData.get('testSessionId') as string | undefined

    // Validate file and projectId
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!projectId || !z.string().uuid().safeParse(projectId).success) {
      return NextResponse.json({ error: 'Valid projectId is required' }, { status: 400 })
    }

    // Check project exists
    const db = getDb()
    const project = await db.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Validate file type
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only CSV or XLSX files allowed' }, { status: 400 })
    }

    // Create or get TestSession
    let sessionId = testSessionId
    if (!sessionId) {
      const session = await db.testSession.create({
        data: {
          projectId,
          createdBy: 'system', // TODO: use actual user from auth
          name: `Import Preview - ${new Date().toISOString()}`,
          version: 1,
        },
      })
      sessionId = session.id
    }

    // Generate preview
    const preview = await ImportService.generatePreview(file, projectId, sessionId)

    // Create ImportBatch record (PENDING status)
    const batch = await db.importBatch.create({
      data: {
        id: preview.batchId,
        projectId,
        testSessionId: sessionId,
        originalFilename: file.name,
        fileSize: file.size,
        totalRows: preview.summary.totalRows,
        validRows: preview.summary.validRows,
        skippedRows: preview.summary.skippedRows,
        status: 'PENDING',
        importedBy: 'system', // TODO: use actual user from auth
      },
    })

    return NextResponse.json({
      batchId: preview.batchId,
      summary: preview.summary,
      incidences: preview.incidences,
      preview: preview.preview,
    })
  } catch (error) {
    console.error('Import preview error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import preview failed' },
      { status: 500 },
    )
  }
}
