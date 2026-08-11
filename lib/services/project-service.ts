import { Prisma, type UserRole } from '@/lib/generated/prisma/client'
import { getDb } from '@/lib/db-lazy'
import {
  type ProjectCreateInput,
  type ProjectMemberCreateInput,
  type ProjectMemberUpdateInput,
  type ProjectUpdateInput,
} from '@/lib/validators/project'

type AuthUser = {
  id: string
  role?: UserRole | string
}

function projectAccessWhere(user: AuthUser, projectId?: string): Prisma.ProjectWhereInput {
  return {
    ...(projectId ? { id: projectId } : {}),
    deletedAt: null,
    ...(user.role === 'OWNER'
      ? {}
      : {
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } },
          ],
        }),
  }
}

export class ProjectService {
  static async listProjects(user: AuthUser, limit = 50, offset = 0) {
    const db = getDb()
    const where = projectAccessWhere(user)

    const [items, total] = await Promise.all([
      db.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          owner: { select: { id: true, email: true, name: true } },
          members: {
            include: {
              user: { select: { id: true, email: true, name: true } },
            },
          },
          _count: {
            select: {
              versions: true,
              testSessions: true,
              findings: true,
            },
          },
        },
      }),
      db.project.count({ where }),
    ])

    return { items, total, limit, offset, hasMore: offset + limit < total }
  }

  static async createProject(input: ProjectCreateInput, ownerId: string) {
    const db = getDb()

    return db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: input.name,
          description: input.description ?? undefined,
          ownerId,
          members: {
            create: {
              userId: ownerId,
              role: 'OWNER',
            },
          },
        },
        include: {
          owner: { select: { id: true, email: true, name: true } },
          members: true,
          _count: {
            select: {
              versions: true,
              testSessions: true,
              findings: true,
            },
          },
        },
      })

      await tx.auditLog.create({
        data: {
          entityType: 'Project',
          entityId: project.id,
          action: 'CREATE',
          actorId: ownerId,
          after: JSON.parse(JSON.stringify(project)),
        },
      })

      return project
    })
  }

  static async getProject(projectId: string, user: AuthUser) {
    const db = getDb()

    return db.project.findFirst({
      where: projectAccessWhere(user, projectId),
      include: {
        owner: { select: { id: true, email: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        },
        versions: {
          orderBy: { createdAt: 'desc' },
        },
        testSessions: {
          orderBy: { date: 'desc' },
          take: 20,
          include: {
            version: true,
            _count: { select: { findings: true } },
          },
        },
        _count: {
          select: {
            findings: true,
            testSessions: true,
            importBatches: true,
          },
        },
      },
    })
  }

  static async updateProject(projectId: string, input: ProjectUpdateInput, user: AuthUser) {
    const db = getDb()

    const existing = await this.getProject(projectId, user)
    if (!existing) throw new Error('NOT_FOUND')

    const updated = await db.project.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        members: true,
        _count: {
          select: {
            findings: true,
            testSessions: true,
            importBatches: true,
          },
        },
      },
    })

    await db.auditLog.create({
      data: {
        entityType: 'Project',
        entityId: projectId,
        action: 'UPDATE',
        actorId: user.id,
        before: JSON.parse(JSON.stringify(existing)),
        after: JSON.parse(JSON.stringify(updated)),
      },
    })

    return updated
  }

  static async assertProjectAccess(projectId: string, user: AuthUser) {
    const db = getDb()
    const project = await db.project.findFirst({
      where: projectAccessWhere(user, projectId),
      select: { id: true },
    })

    if (!project) throw new Error('NOT_FOUND')
  }

  static async assertProjectManagementAccess(projectId: string, user: AuthUser) {
    const db = getDb()

    if (user.role === 'OWNER') {
      const project = await db.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: { id: true },
      })
      if (!project) throw new Error('NOT_FOUND')
      return
    }

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { ownerId: user.id },
          {
            members: {
              some: {
                userId: user.id,
                role: 'OWNER',
              },
            },
          },
        ],
      },
      select: { id: true },
    })

    if (!project) throw new Error('FORBIDDEN')
  }

  static async listMembers(projectId: string, user: AuthUser) {
    await this.assertProjectAccess(projectId, user)
    const db = getDb()

    return db.projectMember.findMany({
      where: { projectId },
      orderBy: { joinedAt: 'asc' },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
      },
    })
  }

  static async addMember(projectId: string, input: ProjectMemberCreateInput, user: AuthUser) {
    await this.assertProjectManagementAccess(projectId, user)
    const db = getDb()

    return db.$transaction(async (tx) => {
      const targetUser = await tx.user.findFirst({
        where: { id: input.userId, deletedAt: null },
        select: { id: true },
      })
      if (!targetUser) throw new Error('USER_NOT_FOUND')

      const member = await tx.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId,
            userId: input.userId,
          },
        },
        update: { role: input.role },
        create: {
          projectId,
          userId: input.userId,
          role: input.role,
        },
        include: {
          user: { select: { id: true, email: true, name: true, role: true } },
        },
      })

      await tx.auditLog.create({
        data: {
          entityType: 'ProjectMember',
          entityId: member.id,
          action: 'UPDATE',
          actorId: user.id,
          after: {
            projectId,
            userId: input.userId,
            role: input.role,
          },
        },
      })

      return member
    })
  }

  static async updateMember(
    projectId: string,
    memberId: string,
    input: ProjectMemberUpdateInput,
    user: AuthUser,
  ) {
    await this.assertProjectManagementAccess(projectId, user)
    const db = getDb()

    return db.$transaction(async (tx) => {
      const current = await tx.projectMember.findFirst({
        where: { id: memberId, projectId },
        include: {
          project: { select: { ownerId: true } },
        },
      })

      if (!current) throw new Error('NOT_FOUND')
      if (current.userId === current.project.ownerId && input.role !== 'OWNER') {
        throw new Error('PROJECT_OWNER_ROLE_REQUIRED')
      }

      const updated = await tx.projectMember.update({
        where: { id: memberId },
        data: { role: input.role },
        include: {
          user: { select: { id: true, email: true, name: true, role: true } },
        },
      })

      await tx.auditLog.create({
        data: {
          entityType: 'ProjectMember',
          entityId: memberId,
          action: 'UPDATE',
          actorId: user.id,
          before: { role: current.role },
          after: { role: updated.role },
        },
      })

      return updated
    })
  }

  static async removeMember(projectId: string, memberId: string, user: AuthUser) {
    await this.assertProjectManagementAccess(projectId, user)
    const db = getDb()

    await db.$transaction(async (tx) => {
      const current = await tx.projectMember.findFirst({
        where: { id: memberId, projectId },
        include: {
          project: { select: { ownerId: true } },
        },
      })

      if (!current) throw new Error('NOT_FOUND')
      if (current.userId === current.project.ownerId) {
        throw new Error('PROJECT_OWNER_REQUIRED')
      }

      await tx.projectMember.delete({
        where: { id: memberId },
      })

      await tx.auditLog.create({
        data: {
          entityType: 'ProjectMember',
          entityId: memberId,
          action: 'DELETE',
          actorId: user.id,
          before: {
            projectId,
            userId: current.userId,
            role: current.role,
          },
        },
      })
    })
  }
}
