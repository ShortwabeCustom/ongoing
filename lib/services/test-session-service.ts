import { getDb } from '@/lib/db-lazy'
import { type TestSessionCreateInput } from '@/lib/validators/project'
import { ProjectService } from '@/lib/services/project-service'

type AuthUser = {
  id: string
  role?: string
}

export class TestSessionService {
  static async listSessions(projectId: string, user: AuthUser, limit = 50, offset = 0) {
    await ProjectService.assertProjectAccess(projectId, user)

    const db = getDb()
    const [items, total] = await Promise.all([
      db.testSession.findMany({
        where: { projectId },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
        include: {
          version: true,
          creator: { select: { id: true, email: true, name: true } },
          _count: { select: { findings: true, importBatches: true } },
        },
      }),
      db.testSession.count({ where: { projectId } }),
    ])

    return { items, total, limit, offset, hasMore: offset + limit < total }
  }

  static async createSession(projectId: string, input: TestSessionCreateInput, user: AuthUser) {
    await ProjectService.assertProjectAccess(projectId, user)

    const db = getDb()
    return db.$transaction(async (tx) => {
      const version = await tx.productVersion.upsert({
        where: {
          projectId_version: {
            projectId,
            version: input.version,
          },
        },
        update: {},
        create: {
          projectId,
          version: input.version,
        },
      })

      const session = await tx.testSession.create({
        data: {
          projectId,
          versionId: version.id,
          name: input.name,
          date: input.date,
          environment: input.environment ?? undefined,
          createdBy: user.id,
        },
        include: {
          version: true,
          creator: { select: { id: true, email: true, name: true } },
          _count: { select: { findings: true, importBatches: true } },
        },
      })

      await tx.auditLog.create({
        data: {
          entityType: 'TestSession',
          entityId: session.id,
          action: 'CREATE',
          actorId: user.id,
          after: JSON.parse(JSON.stringify(session)),
        },
      })

      return session
    })
  }
}
