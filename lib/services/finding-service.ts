import { Prisma } from '@prisma/client'
import { getDb } from '@/lib/db-lazy'
import { FindingsQuery, parseSort } from '@/lib/validators/query'

export class FindingService {
  /**
   * Build WHERE clause from filters
   */
  static buildWhereClause(filters: Partial<FindingsQuery>): Prisma.FindingWhereInput {
    const where: Prisma.FindingWhereInput = {
      deletedAt: null, // Exclude soft-deleted findings
    }

    if (filters.status?.length) {
      where.status = { in: filters.status as Prisma.FindingStatus[] }
    }

    if (filters.priority?.length) {
      where.priority = { in: filters.priority as Prisma.FindingPriority[] }
    }

    if (filters.severity?.length) {
      where.severity = { in: filters.severity as Prisma.FindingSeverity[] }
    }

    if (filters.area?.length) {
      // area is stored in experienceTags relationship
      // Use some() to match if ANY of the specified areas exist
      where.experienceTags = {
        some: {
          experienceTag: { in: filters.area as Prisma.ExperienceTag[] },
        },
      }
    }

    if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId
    }

    // Date range filters
    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {}
      if (filters.createdAfter) {
        where.createdAt.gte = new Date(filters.createdAfter)
      }
      if (filters.createdBefore) {
        where.createdAt.lte = new Date(filters.createdBefore)
      }
    }

    if (filters.updatedAfter || filters.updatedBefore) {
      where.updatedAt = {}
      if (filters.updatedAfter) {
        where.updatedAt.gte = new Date(filters.updatedAfter)
      }
      if (filters.updatedBefore) {
        where.updatedAt.lte = new Date(filters.updatedBefore)
      }
    }

    // Text search in observation
    if (filters.search) {
      where.observation = {
        search: filters.search,
      }
    }

    return where
  }

  /**
   * List findings with filters, sorting, and pagination
   */
  static async listFindings(filters: FindingsQuery) {
    const db = getDb()

    const where = this.buildWhereClause(filters)
    const orderBy = parseSort(filters.sort)

    // Execute queries in parallel
    const [items, total] = await Promise.all([
      db.finding.findMany({
        where,
        orderBy,
        skip: filters.offset,
        take: filters.limit,
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          assignee: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          experienceTags: true,
          incidenceTypes: true,
        },
      }),
      db.finding.count({ where }),
    ])

    return {
      items,
      total,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: filters.offset + filters.limit < total,
    }
  }

  /**
   * Get single finding with full relations
   */
  static async getFinding(id: string) {
    const db = getDb()

    return db.finding.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        updater: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        evidence: {
          select: {
            id: true,
            originalFilename: true,
            url: true,
            caption: true,
            mimeType: true,
            fileSize: true,
            createdAt: true,
          },
        },
        resolution: {
          select: {
            id: true,
            status: true,
            description: true,
            createdAt: true,
          },
        },
        validation: {
          select: {
            id: true,
            result: true,
            feedback: true,
            createdAt: true,
          },
        },
        experienceTags: true,
        incidenceTypes: true,
      },
    })
  }

  /**
   * Get finding with fresh signed URLs for evidence
   * (Call this in GET endpoint instead of getFinding)
   */
  static async getFindingWithSignedUrls(id: string) {
    const finding = await this.getFinding(id)

    if (!finding || !finding.evidence) {
      return finding
    }

    // Regenerate signed URLs for all evidence files
    const { StorageService } = await import('@/lib/services/storage-service')

    const evidenceWithUrls = await Promise.all(
      finding.evidence.map(async (ev) => {
        try {
          const withUrl = await StorageService.getEvidenceWithUrl(ev.id)
          return {
            id: withUrl.id,
            originalFilename: withUrl.originalFilename,
            url: withUrl.url,
            urlExpiresAt: withUrl.urlExpiresAt,
            caption: withUrl.caption,
            mimeType: withUrl.mimeType,
            fileSize: withUrl.fileSize,
            uploadedAt: withUrl.uploadedAt,
          }
        } catch {
          // If URL generation fails, return evidence as-is
          return {
            id: ev.id,
            originalFilename: ev.originalFilename,
            url: ev.url,
            caption: ev.caption,
            mimeType: ev.mimeType,
            fileSize: ev.fileSize,
            uploadedAt: ev.createdAt,
          }
        }
      }),
    )

    return {
      ...finding,
      evidence: evidenceWithUrls,
    }
  }

  /**
   * Get findings statistics
   */
  static async getStatistics() {
    const db = getDb()

    const [byStatus, byPriority, bySeverity, byArea, total, unassigned] = await Promise.all([
      db.finding.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),
      db.finding.groupBy({
        by: ['priority'],
        where: { deletedAt: null },
        _count: true,
      }),
      db.finding.groupBy({
        by: ['severity'],
        where: { deletedAt: null },
        _count: true,
      }),
      db.finding.count({ where: { deletedAt: null, assigneeId: null } }),
      db.finding.count({ where: { deletedAt: null } }),
    ])

    // Group by area (experienceTags)
    const areaData = await db.finding.findMany({
      where: { deletedAt: null },
      select: {
        experienceTags: {
          select: {
            experienceTag: true,
          },
        },
      },
    })

    const byAreaMap = new Map<string, number>()
    areaData.forEach((finding) => {
      finding.experienceTags.forEach((tag) => {
        const current = byAreaMap.get(tag.experienceTag) || 0
        byAreaMap.set(tag.experienceTag, current + 1)
      })
    })

    return {
      total,
      byStatus: Object.fromEntries(
        byStatus.map((row) => [
          row.status,
          (row as any)._count,
        ]),
      ),
      byPriority: Object.fromEntries(
        byPriority.map((row) => [
          row.priority,
          (row as any)._count,
        ]),
      ),
      bySeverity: Object.fromEntries(
        bySeverity.map((row) => [
          row.severity,
          (row as any)._count,
        ]),
      ),
      byArea: Object.fromEntries(byAreaMap),
      unassigned,
    }
  }

  /**
   * Update finding with optimistic locking
   */
  static async updateFinding(
    id: string,
    updates: Prisma.FindingUpdateInput,
    currentVersion: number,
    updatedBy: string,
  ) {
    const db = getDb()

    const updated = await db.finding.updateMany({
      where: {
        id,
        version: currentVersion,
        deletedAt: null,
      },
      data: {
        ...updates,
        version: { increment: 1 },
        updatedAt: new Date(),
        updatedBy,
      },
    })

    if (updated.count === 0) {
      // Check if finding exists to distinguish between not found and version mismatch
      const finding = await db.finding.findUnique({
        where: { id },
        select: { version: true, deletedAt: true },
      })

      if (!finding) {
        throw new Error('NOT_FOUND')
      }
      if (finding.deletedAt) {
        throw new Error('DELETED')
      }

      throw new Error('VERSION_MISMATCH')
    }

    return this.getFinding(id)
  }

  /**
   * Soft delete finding
   */
  static async deleteFinding(id: string, deletedBy: string) {
    const db = getDb()

    const updated = await db.finding.updateMany({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        updatedBy: deletedBy,
        updatedAt: new Date(),
      },
    })

    if (updated.count === 0) {
      const finding = await db.finding.findUnique({
        where: { id },
        select: { deletedAt: true },
      })

      if (!finding) {
        throw new Error('NOT_FOUND')
      }

      throw new Error('ALREADY_DELETED')
    }

    return { id, deletedAt: new Date() }
  }
}
