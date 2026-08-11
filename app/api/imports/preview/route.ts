import { NextRequest, NextResponse } from 'next/server'
import { ImportPreviewSchema } from '@/lib/validators/import'
import { ImportService } from '@/lib/services/import-service'
import { getDb } from '@/lib/db-lazy'
import { getSession } from '@/lib/auth/lucia'

export const dynamic = 'force-dynamic'

const IMPORT_VERSION = 'legacy-import'

async function getOrCreateImportSession(
  projectId: string,
  userId: string,
  testSessionId?: string,
) {
  const db = getDb()

  if (testSessionId) {
    const existing = await db.testSession.findFirst({
      where: { id: testSessionId, projectId },
      select: { id: true },
    })

    if (!existing) {
      throw new Error('TEST_SESSION_NOT_FOUND')
    }

    return existing.id
  }

  const version = await db.productVersion.upsert({
    where: {
      projectId_version: {
        projectId,
        version: IMPORT_VERSION,
      },
    },
    update: {},
    create: {
      projectId,
      version: IMPORT_VERSION,
    },
  })

  const session = await db.testSession.create({
    data: {
      projectId,
      versionId: version.id,
      createdBy: userId,
      name: `Import ${new Date().toISOString()}`,
      date: new Date(),
      environment: 'legacy-import',
    },
  })

  return session.id
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const user = session?.user as { id: string } | undefined
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const projectId = formData.get('projectId')
    const testSessionId = formData.get('testSessionId')

    const validation = ImportPreviewSchema.safeParse({
      file,
      projectId,
      testSessionId: typeof testSessionId === 'string' && testSessionId ? testSessionId : undefined,
    })

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid import preview request',
          fields: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }

    const db = getDb()
    const project = await db.project.findFirst({
      where: { id: validation.data.projectId, deletedAt: null },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const sessionId = await getOrCreateImportSession(
      validation.data.projectId,
      user.id,
      validation.data.testSessionId,
    )

    const preview = await ImportService.generatePreview(
      validation.data.file,
      validation.data.projectId,
      sessionId,
    )

    await db.importBatch.create({
      data: {
        id: preview.batchId,
        projectId: validation.data.projectId,
        testSessionId: sessionId,
        originalFilename: validation.data.file.name,
        fileSize: validation.data.file.size,
        totalRows: preview.summary.totalRows,
        validRows: preview.summary.validRows,
        skippedRows: preview.summary.skippedRows,
        status: 'PENDING',
        importedBy: user.id,
      },
    })

    return NextResponse.json(preview)
  } catch (error) {
    console.error('Import preview error:', error)
    const message = error instanceof Error ? error.message : 'Import preview failed'
    const status = message === 'TEST_SESSION_NOT_FOUND' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
