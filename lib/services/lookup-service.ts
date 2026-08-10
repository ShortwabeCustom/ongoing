import { getDb } from '@/lib/db-lazy'

export interface AssigneeOption {
  id: string
  name: string
}

export interface ProjectOption {
  id: string
  name: string
}

export class LookupService {
  /**
   * Get all users available for assignment (excluding GUEST role)
   * Optionally filter by project membership
   */
  static async getAssignees(projectId?: string): Promise<AssigneeOption[]> {
    const db = getDb()

    if (projectId) {
      // Get users who are members of this project (exclude VIEWER role)
      return db.user.findMany({
        where: {
          role: { not: 'VIEWER' },
          deletedAt: null,
          projectMembers: {
            some: {
              projectId,
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      })
    }

    // Get all non-viewer users
    return db.user.findMany({
      where: {
        role: { not: 'VIEWER' },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    })
  }

  /**
   * Get all projects (optionally filter by user membership)
   */
  static async getProjects(userId?: string): Promise<ProjectOption[]> {
    const db = getDb()

    if (userId) {
      // Get projects where user is a member
      return db.project.findMany({
        where: {
          deletedAt: null,
          members: {
            some: {
              userId,
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      })
    }

    // Get all active projects
    return db.project.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    })
  }

  /**
   * Get assignee details (name, avatar) by ID
   */
  static async getAssigneeById(userId: string): Promise<AssigneeOption | null> {
    const db = getDb()

    return db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
      },
    })
  }

  /**
   * Get project details by ID
   */
  static async getProjectById(projectId: string): Promise<ProjectOption | null> {
    const db = getDb()

    return db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
      },
    })
  }

  /**
   * Batch get assignee names (for Elasticsearch facet enrichment)
   */
  static async getAssigneesByIds(userIds: string[]): Promise<Map<string, string>> {
    const db = getDb()

    const users = await db.user.findMany({
      where: {
        id: { in: userIds },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
    })

    return new Map(users.map((u) => [u.id, u.name]))
  }

  /**
   * Batch get project names (for Elasticsearch facet enrichment)
   */
  static async getProjectsByIds(projectIds: string[]): Promise<Map<string, string>> {
    const db = getDb()

    const projects = await db.project.findMany({
      where: {
        id: { in: projectIds },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
    })

    return new Map(projects.map((p) => [p.id, p.name]))
  }
}
