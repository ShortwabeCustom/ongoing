import { getDb } from '@/lib/db-lazy'
import { projectAccessWhere } from '@/lib/services/project-service'

type AuthUser = {
  id: string
  role?: string
}

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
   * Get all active platform users available for assignment.
   *
   * The responsible selector is platform-wide: a newly created user must be
   * available immediately, even before being added as a project member and
   * regardless of their role.
   */
  static async getAssignees(_projectId?: string): Promise<AssigneeOption[]> {
    const db = getDb()

    return db.user.findMany({
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
   * Get projects accessible to the authenticated user (members, or all
   * projects for the global OWNER role). Siempre se deriva del usuario de
   * sesión — nunca de un parámetro que pueda mandar el cliente.
   */
  static async getProjects(user: AuthUser): Promise<ProjectOption[]> {
    const db = getDb()

    return db.project.findMany({
      where: {
        ...projectAccessWhere(user),
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
