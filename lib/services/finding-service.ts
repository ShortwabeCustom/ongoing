import {
  Prisma,
  type ExperienceTag,
  type FindingEffort,
  type FindingPriority,
  type FindingSeverity,
  type FindingStatus,
  type IncidenceType,
} from '@/lib/generated/prisma/client'
import { getDb } from '@/lib/db-lazy'
import { type FindingStatusTransition, type FindingCreate, type FindingUpdate } from '@/lib/validators/finding'
import { FindingsQuery, parseSort } from '@/lib/validators/query'
import { SearchService } from '@/lib/services/search-service'

type FindingPatch = Omit<FindingUpdate, 'version'>

const FINDING_TRANSITIONS: Record<FindingStatus, FindingStatus[]> = {
  OPEN: ['TRIAGED', 'OPEN'],
  TRIAGED: ['IN_PROGRESS', 'OPEN', 'BLOCKED'],
  IN_PROGRESS: ['READY_FOR_VALIDATION', 'BLOCKED', 'IN_PROGRESS'],
  READY_FOR_VALIDATION: ['VALIDATED', 'IN_PROGRESS', 'READY_FOR_VALIDATION'],
  VALIDATED: ['CLOSED', 'REOPENED', 'VALIDATED'],
  CLOSED: ['REOPENED', 'CLOSED'],
  BLOCKED: ['IN_PROGRESS', 'BLOCKED'],
  REOPENED: ['IN_PROGRESS', 'REOPENED'],
}

function hasOwn<T extends object>(object: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function toAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function isValidFindingTransition(from: FindingStatus, to: FindingStatus) {
  return FINDING_TRANSITIONS[from]?.includes(to) ?? false
}

function getAllowedFindingTransitions(status: FindingStatus) {
  return FINDING_TRANSITIONS[status] ?? []
}

function getCount(row: { _count?: unknown }) {
  if (typeof row._count === 'number') return row._count
  if (row._count && typeof row._count === 'object' && '_all' in row._count) {
    return Number((row._count as { _all: number })._all)
  }
  return 0
}

export class FindingService {
  /**
   * Build WHERE clause from API filters. This keeps filtering in PostgreSQL
   * instead of pulling the inventory into the browser.
   */
  static buildWhereClause(filters: Partial<FindingsQuery>): Prisma.FindingWhereInput {
    const where: Prisma.FindingWhereInput = {
      deletedAt: null,
    }
    const and: Prisma.FindingWhereInput[] = []

    if (filters.status?.length) {
      where.status = { in: filters.status as FindingStatus[] }
    }

    if (filters.priority?.length) {
      where.priority = { in: filters.priority as FindingPriority[] }
    }

    if (filters.severity?.length) {
      where.severity = { in: filters.severity as FindingSeverity[] }
    }

    const experienceTags = filters.experienceTag ?? filters.area
    if (experienceTags?.length) {
      where.experienceTags = {
        some: {
          experienceTag: { in: experienceTags as ExperienceTag[] },
        },
      }
    }

    if (filters.incidenceType?.length) {
      where.incidenceTypes = {
        some: {
          incidenceType: { in: filters.incidenceType as IncidenceType[] },
        },
      }
    }

    if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId
    }

    if (filters.projectId) {
      where.projectId = filters.projectId
    }

    const testSessionId = filters.testSessionId ?? filters.session
    if (testSessionId) {
      where.testSessionId = testSessionId
    }

    const createdAfter = filters.createdAfter ?? filters.createdFrom
    const createdBefore = filters.createdBefore ?? filters.createdTo
    if (createdAfter || createdBefore) {
      where.createdAt = {}
      if (createdAfter) where.createdAt.gte = new Date(createdAfter)
      if (createdBefore) where.createdAt.lte = new Date(createdBefore)
    }

    if (filters.updatedAfter || filters.updatedBefore) {
      where.updatedAt = {}
      if (filters.updatedAfter) where.updatedAt.gte = new Date(filters.updatedAfter)
      if (filters.updatedBefore) where.updatedAt.lte = new Date(filters.updatedBefore)
    }

    if (filters.screen) {
      const screenFilter = { contains: filters.screen, mode: 'insensitive' as const }
      and.push({
        OR: [
          { previousScreen: screenFilter },
          { currentScreen: screenFilter },
          { flowStep: screenFilter },
        ],
      })
    }

    if (filters.search) {
      const textFilter = { contains: filters.search, mode: 'insensitive' as const }
      and.push({
        OR: [
          { observation: textFilter },
          { folio: textFilter },
          { previousScreen: textFilter },
          { currentScreen: textFilter },
          { flowStep: textFilter },
          { comments: { some: { text: textFilter } } },
          { resolutions: { some: { description: textFilter } } },
        ],
      })
    }

    if (and.length > 0) {
      where.AND = and
    }

    return where
  }

  /**
   * List findings with filters, sorting, and pagination.
   */
  static async listFindings(filters: FindingsQuery) {
    const db = getDb()
    const where = this.buildWhereClause(filters)
    const orderBy = parseSort(filters.sort)

    const [items, total] = await Promise.all([
      db.finding.findMany({
        where,
        orderBy,
        skip: filters.offset,
        take: filters.limit,
        include: {
          project: {
            select: { id: true, name: true },
          },
          testSession: {
            select: { id: true, name: true, date: true, environment: true },
          },
          creator: {
            select: { id: true, email: true, name: true },
          },
          assignee: {
            select: { id: true, email: true, name: true },
          },
          experienceTags: true,
          incidenceTypes: true,
          _count: {
            select: {
              evidence: true,
              comments: true,
              resolutions: true,
              validations: true,
            },
          },
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
   * Create a finding in a project/test session with normalized categories.
   */
  static async createFinding(projectId: string, input: FindingCreate, createdBy: string) {
    const db = getDb()
    const status = (input.status ?? 'OPEN') as FindingStatus

    const finding = await db.$transaction(async (tx) => {
      if (input.testSessionId) {
        const testSession = await tx.testSession.findFirst({
          where: {
            id: input.testSessionId,
            projectId,
            project: { deletedAt: null },
          },
          select: { id: true },
        })

        if (!testSession) {
          throw new Error('TEST_SESSION_NOT_FOUND')
        }
      }

      const createdAt = input.createdDate ? new Date(input.createdDate) : undefined

      const created = await tx.finding.create({
        data: {
          projectId,
          testSessionId: input.testSessionId ?? undefined,
          folio: input.folio ?? undefined,
          observation: input.observation,
          status,
          priority: input.priority,
          severity: input.severity,
          effort: input.effort,
          previousScreen: input.previousScreen ?? undefined,
          currentScreen: input.currentScreen ?? undefined,
          flowStep: input.flowStep ?? undefined,
          assigneeId: input.assigneeId ?? undefined,
          dueDate: input.dueDate ?? undefined,
          createdBy,
          createdAt,
          incidenceTypes: {
            create: input.incidenceTypes.map((incidenceType) => ({ incidenceType })),
          },
          experienceTags: input.experienceTags?.length
            ? {
                create: input.experienceTags.map((experienceTag) => ({ experienceTag })),
              }
            : undefined,
          supportLinks: input.supportLinks?.length
            ? {
                create: input.supportLinks.map((link) => ({
                  title: link.title ?? undefined,
                  url: link.url,
                  createdBy,
                })),
              }
            : undefined,
        },
        include: {
          incidenceTypes: true,
          experienceTags: true,
          supportLinks: true,
          evidence: true,
          creator: { select: { id: true, email: true, name: true } },
          assignee: { select: { id: true, email: true, name: true } },
        },
      })

      await tx.findingStatusHistory.create({
        data: {
          findingId: created.id,
          fromStatus: 'OPEN',
          toStatus: status,
          reason: status === 'OPEN' ? 'Finding created' : 'Initial imported status',
          changedBy: createdBy,
        },
      })

      await tx.auditLog.create({
        data: {
          entityType: 'Finding',
          entityId: created.id,
          action: 'CREATE',
          actorId: createdBy,
          after: toAuditJson(created),
        },
      })

      return created
    })

    void SearchService.indexFinding({
      id: finding.id,
      observation: finding.observation,
      evidenceDescriptions: '',
      status: finding.status,
      priority: finding.priority,
      severity: finding.severity,
      assigneeId: finding.assigneeId || undefined,
      projectId: finding.projectId,
      evidenceCount: 0,
      createdAt: finding.createdAt,
      updatedAt: finding.updatedAt,
    })

    return finding
  }

  /**
   * Get single finding with full relations for detail screens.
   */
  static async getFinding(id: string) {
    const db = getDb()

    return db.finding.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true },
        },
        testSession: {
          select: { id: true, name: true, date: true, environment: true },
        },
        creator: {
          select: { id: true, email: true, name: true },
        },
        assignee: {
          select: { id: true, email: true, name: true },
        },
        updater: {
          select: { id: true, email: true, name: true },
        },
        evidence: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            originalFilename: true,
            url: true,
            caption: true,
            mimeType: true,
            fileSize: true,
            createdAt: true,
            resolutionId: true,
            validationId: true,
          },
        },
        resolutions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            state: true,
            description: true,
            notes: true,
            assignedTo: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        validations: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            result: true,
            notes: true,
            criteria: true,
            validatedBy: true,
            validatedAt: true,
            createdAt: true,
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          include: {
            creator: { select: { id: true, email: true, name: true } },
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            reason: true,
            changedAt: true,
            changedBy: true,
            changer: { select: { id: true, email: true, name: true } },
          },
        },
        experienceTags: true,
        incidenceTypes: true,
        supportLinks: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            url: true,
            createdAt: true,
          },
        },
      },
    })
  }

  /**
   * Serialize dates in finding data for Server → Client boundary.
   * Converts all Date objects to ISO 8601 strings.
   */
  private static serializeFinding(data: any): any {
    if (!data) return data

    const serialized = { ...data }

    // Serialize top-level dates
    if (serialized.createdAt instanceof Date) {
      serialized.createdAt = serialized.createdAt.toISOString()
    }
    if (serialized.updatedAt instanceof Date) {
      serialized.updatedAt = serialized.updatedAt.toISOString()
    }
    if (serialized.deletedAt instanceof Date) {
      serialized.deletedAt = serialized.deletedAt.toISOString()
    }
    if (serialized.dueDate instanceof Date) {
      serialized.dueDate = serialized.dueDate.toISOString()
    }

    // Serialize testSession dates
    if (serialized.testSession) {
      serialized.testSession = { ...serialized.testSession }
      if (serialized.testSession.date instanceof Date) {
        serialized.testSession.date = serialized.testSession.date.toISOString()
      }
    }

    // Serialize evidence dates
    if (Array.isArray(serialized.evidence)) {
      serialized.evidence = serialized.evidence.map((ev: any) => {
        const evCopy = { ...ev }
        if (evCopy.createdAt instanceof Date) {
          evCopy.createdAt = evCopy.createdAt.toISOString()
        }
        if (evCopy.uploadedAt instanceof Date) {
          evCopy.uploadedAt = evCopy.uploadedAt.toISOString()
        }
        if (evCopy.urlExpiresAt instanceof Date) {
          evCopy.urlExpiresAt = evCopy.urlExpiresAt.toISOString()
        }
        return evCopy
      })
    }

    // Serialize resolutions dates
    if (Array.isArray(serialized.resolutions)) {
      serialized.resolutions = serialized.resolutions.map((res: any) => {
        const resCopy = { ...res }
        if (resCopy.createdAt instanceof Date) {
          resCopy.createdAt = resCopy.createdAt.toISOString()
        }
        if (resCopy.updatedAt instanceof Date) {
          resCopy.updatedAt = resCopy.updatedAt.toISOString()
        }
        return resCopy
      })
    }

    // Serialize validations dates
    if (Array.isArray(serialized.validations)) {
      serialized.validations = serialized.validations.map((val: any) => {
        const valCopy = { ...val }
        if (valCopy.createdAt instanceof Date) {
          valCopy.createdAt = valCopy.createdAt.toISOString()
        }
        if (valCopy.validatedAt instanceof Date) {
          valCopy.validatedAt = valCopy.validatedAt.toISOString()
        }
        return valCopy
      })
    }

    // Serialize comments dates
    if (Array.isArray(serialized.comments)) {
      serialized.comments = serialized.comments.map((com: any) => {
        const comCopy = { ...com }
        if (comCopy.createdAt instanceof Date) {
          comCopy.createdAt = comCopy.createdAt.toISOString()
        }
        if (comCopy.updatedAt instanceof Date) {
          comCopy.updatedAt = comCopy.updatedAt.toISOString()
        }
        if (comCopy.creator && comCopy.creator.createdAt instanceof Date) {
          comCopy.creator = { ...comCopy.creator, createdAt: comCopy.creator.createdAt.toISOString() }
        }
        return comCopy
      })
    }

    // Serialize statusHistory dates
    if (Array.isArray(serialized.statusHistory)) {
      serialized.statusHistory = serialized.statusHistory.map((hist: any) => {
        const histCopy = { ...hist }
        if (histCopy.changedAt instanceof Date) {
          histCopy.changedAt = histCopy.changedAt.toISOString()
        }
        if (histCopy.changer && histCopy.changer.createdAt instanceof Date) {
          histCopy.changer = { ...histCopy.changer, createdAt: histCopy.changer.createdAt.toISOString() }
        }
        return histCopy
      })
    }

    return serialized
  }

  /**
   * Get finding with fresh signed URLs for evidence.
   */
  static async getFindingWithSignedUrls(id: string) {
    const finding = await this.getFinding(id)

    if (!finding || !finding.evidence) {
      return this.serializeFinding(finding)
    }

    const { StorageService } = await import('@/lib/services/storage-service')

    const evidenceWithUrls = await Promise.all(
      finding.evidence.map(async (ev) => {
        try {
          const withUrl = await StorageService.getEvidenceWithUrl(ev.id)
          return {
            ...ev,
            url: withUrl.url,
            urlExpiresAt: withUrl.urlExpiresAt,
            uploadedAt: withUrl.uploadedAt,
          }
        } catch {
          return {
            ...ev,
            uploadedAt: ev.createdAt,
          }
        }
      }),
    )

    return this.serializeFinding({
      ...finding,
      evidence: evidenceWithUrls,
    })
  }

  /**
   * Aggregate operational statistics from the database.
   */
  static async getStatistics(projectId?: string) {
    const db = getDb()
    const where: Prisma.FindingWhereInput = {
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
    }

    const [
      byStatus,
      byPriority,
      bySeverity,
      byIncidenceType,
      byExperienceTag,
      byScreen,
      byTestSession,
      unassigned,
      total,
      openFindings,
      validatedFindings,
      closedFindings,
      blockedFindings,
      evidenceCount,
    ] = await Promise.all([
      db.finding.groupBy({ by: ['status'], where, _count: true }),
      db.finding.groupBy({ by: ['priority'], where, _count: true }),
      db.finding.groupBy({ by: ['severity'], where, _count: true }),
      db.findingIncidenceType.groupBy({
        by: ['incidenceType'],
        where: { finding: where },
        _count: { _all: true },
      }),
      db.findingExperienceTag.groupBy({
        by: ['experienceTag'],
        where: { finding: where },
        _count: { _all: true },
      }),
      db.finding.groupBy({
        by: ['currentScreen'],
        where,
        _count: true,
        orderBy: { _count: { currentScreen: 'desc' } },
        take: 25,
      }),
      db.finding.groupBy({
        by: ['testSessionId'],
        where,
        _count: true,
        orderBy: { _count: { testSessionId: 'desc' } },
        take: 25,
      }),
      db.finding.count({ where: { ...where, assigneeId: null } }),
      db.finding.count({ where }),
      db.finding.count({ where: { ...where, status: { in: ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'REOPENED'] } } }),
      db.finding.count({ where: { ...where, status: 'VALIDATED' } }),
      db.finding.count({ where: { ...where, status: 'CLOSED' } }),
      db.finding.count({ where: { ...where, status: 'BLOCKED' } }),
      db.evidence.count({ where: { deletedAt: null, finding: where } }),
    ])

    return {
      total,
      totalFindings: total,
      openFindings,
      validatedFindings,
      closedFindings,
      blockedFindings,
      evidenceCount,
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, getCount(row)])),
      statusDistribution: Object.fromEntries(byStatus.map((row) => [row.status, getCount(row)])),
      byPriority: Object.fromEntries(byPriority.map((row) => [row.priority, getCount(row)])),
      priorityDistribution: Object.fromEntries(byPriority.map((row) => [row.priority, getCount(row)])),
      bySeverity: Object.fromEntries(bySeverity.map((row) => [row.severity, getCount(row)])),
      severityDistribution: Object.fromEntries(bySeverity.map((row) => [row.severity, getCount(row)])),
      byIncidenceType: Object.fromEntries(byIncidenceType.map((row) => [row.incidenceType, getCount(row)])),
      byExperienceTag: Object.fromEntries(byExperienceTag.map((row) => [row.experienceTag, getCount(row)])),
      byArea: Object.fromEntries(byExperienceTag.map((row) => [row.experienceTag, getCount(row)])),
      byScreen: Object.fromEntries(byScreen.map((row) => [row.currentScreen ?? 'Unspecified', getCount(row)])),
      byTestSession: Object.fromEntries(byTestSession.map((row) => [row.testSessionId, getCount(row)])),
      unassigned,
    }
  }

  /**
   * Update finding with optimistic locking and explicit allowlisted fields.
   */
  static async updateFinding(
    id: string,
    updates: FindingPatch,
    currentVersion: number,
    updatedBy: string,
    reason?: string,
  ) {
    const db = getDb()

    await db.$transaction(async (tx) => {
      const current = await tx.finding.findUnique({
        where: { id },
        include: {
          incidenceTypes: true,
          experienceTags: true,
        },
      })

      if (!current) throw new Error('NOT_FOUND')
      if (current.deletedAt) throw new Error('DELETED')
      if (current.version !== currentVersion) throw new Error('VERSION_MISMATCH')

      const nextStatus = updates.status as FindingStatus | undefined
      if (nextStatus && nextStatus !== current.status && !isValidFindingTransition(current.status, nextStatus)) {
        throw new Error(
          `INVALID_STATUS_TRANSITION:${current.status}:${nextStatus}:${getAllowedFindingTransitions(current.status).join(',')}`,
        )
      }

      const data: Prisma.FindingUncheckedUpdateManyInput = {
        version: { increment: 1 },
        updatedAt: new Date(),
        updatedBy,
      }

      if (hasOwn(updates, 'folio')) data.folio = updates.folio ?? null
      if (hasOwn(updates, 'observation') && updates.observation !== undefined) data.observation = updates.observation
      if (hasOwn(updates, 'status') && updates.status !== undefined) data.status = updates.status as FindingStatus
      if (hasOwn(updates, 'priority') && updates.priority !== undefined) data.priority = updates.priority as FindingPriority
      if (hasOwn(updates, 'severity') && updates.severity !== undefined) data.severity = updates.severity as FindingSeverity
      if (hasOwn(updates, 'effort') && updates.effort !== undefined) data.effort = updates.effort as FindingEffort
      if (hasOwn(updates, 'previousScreen')) data.previousScreen = updates.previousScreen ?? null
      if (hasOwn(updates, 'currentScreen')) data.currentScreen = updates.currentScreen ?? null
      if (hasOwn(updates, 'flowStep')) data.flowStep = updates.flowStep ?? null
      if (hasOwn(updates, 'assigneeId')) data.assigneeId = updates.assigneeId ?? null
      if (hasOwn(updates, 'dueDate')) data.dueDate = updates.dueDate ?? null

      const updated = await tx.finding.updateMany({
        where: {
          id,
          version: currentVersion,
          deletedAt: null,
        },
        data,
      })

      if (updated.count === 0) throw new Error('VERSION_MISMATCH')

      if (updates.incidenceTypes) {
        await tx.findingIncidenceType.deleteMany({ where: { findingId: id } })
        await tx.findingIncidenceType.createMany({
          data: updates.incidenceTypes.map((incidenceType) => ({
            findingId: id,
            incidenceType,
          })),
          skipDuplicates: true,
        })
      }

      if (updates.experienceTags) {
        await tx.findingExperienceTag.deleteMany({ where: { findingId: id } })
        if (updates.experienceTags.length > 0) {
          await tx.findingExperienceTag.createMany({
            data: updates.experienceTags.map((experienceTag) => ({
              findingId: id,
              experienceTag,
            })),
            skipDuplicates: true,
          })
        }
      }

      if (updates.supportLinks) {
        await tx.supportLink.deleteMany({ where: { findingId: id } })
        if (updates.supportLinks.length > 0) {
          await tx.supportLink.createMany({
            data: updates.supportLinks.map((link) => ({
              findingId: id,
              title: link.title ?? null,
              url: link.url,
              createdBy: updatedBy,
            })),
          })
        }
      }

      const after = await tx.finding.findUnique({
        where: { id },
        include: {
          incidenceTypes: true,
          experienceTags: true,
          supportLinks: true,
        },
      })

      if (nextStatus && nextStatus !== current.status) {
        await tx.findingStatusHistory.create({
          data: {
            findingId: id,
            fromStatus: current.status,
            toStatus: nextStatus,
            reason,
            changedBy: updatedBy,
          },
        })

        await tx.auditLog.create({
          data: {
            entityType: 'Finding',
            entityId: id,
            action: 'STATUS_CHANGE',
            actorId: updatedBy,
            before: toAuditJson({ status: current.status, version: current.version }),
            after: toAuditJson({ status: nextStatus, version: current.version + 1, reason }),
          },
        })
      }

      if (hasOwn(updates, 'assigneeId') && updates.assigneeId !== current.assigneeId) {
        await tx.auditLog.create({
          data: {
            entityType: 'Finding',
            entityId: id,
            action: 'ASSIGN',
            actorId: updatedBy,
            before: toAuditJson({ assigneeId: current.assigneeId }),
            after: toAuditJson({ assigneeId: updates.assigneeId ?? null }),
          },
        })
      }

      await tx.auditLog.create({
        data: {
          entityType: 'Finding',
          entityId: id,
          action: 'UPDATE',
          actorId: updatedBy,
          before: toAuditJson(current),
          after: toAuditJson(after),
        },
      })
    })

    const updatedFinding = await this.getFinding(id)

    if (updatedFinding) {
      const evidenceDescriptions = (updatedFinding.evidence ?? [])
        .map((e) => [e.caption, e.originalFilename].filter(Boolean).join(' '))
        .join(' ')

      void SearchService.indexFinding({
        id: updatedFinding.id,
        observation: updatedFinding.observation,
        evidenceDescriptions,
        status: updatedFinding.status,
        priority: updatedFinding.priority,
        severity: updatedFinding.severity,
        assigneeId: updatedFinding.assigneeId || undefined,
        projectId: updatedFinding.projectId,
        evidenceCount: updatedFinding.evidence?.length || 0,
        createdAt: updatedFinding.createdAt,
        updatedAt: updatedFinding.updatedAt,
      })
    }

    return updatedFinding
  }

  static async transitionFinding(
    id: string,
    input: FindingStatusTransition,
    changedBy: string,
  ) {
    return this.updateFinding(
      id,
      { status: input.toStatus },
      input.version,
      changedBy,
      input.reason,
    )
  }

  static async getComments(findingId: string, limit = 50, offset = 0) {
    const db = getDb()
    const [items, total] = await Promise.all([
      db.comment.findMany({
        where: { findingId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          creator: { select: { id: true, email: true, name: true } },
        },
      }),
      db.comment.count({ where: { findingId } }),
    ])

    return { items, total, limit, offset }
  }

  static async addComment(findingId: string, text: string, createdBy: string) {
    const db = getDb()

    const comment = await db.$transaction(async (tx) => {
      const finding = await tx.finding.findFirst({
        where: { id: findingId, deletedAt: null },
        select: { id: true },
      })

      if (!finding) throw new Error('NOT_FOUND')

      const created = await tx.comment.create({
        data: {
          findingId,
          text,
          createdBy,
        },
        include: {
          creator: { select: { id: true, email: true, name: true } },
        },
      })

      await tx.auditLog.create({
        data: {
          entityType: 'Finding',
          entityId: findingId,
          action: 'UPDATE',
          actorId: createdBy,
          after: toAuditJson({ commentId: created.id, text: created.text }),
        },
      })

      return created
    })

    return comment
  }

  /**
   * Soft delete finding.
   */
  static async deleteFinding(id: string, deletedBy: string) {
    const db = getDb()

    const deletedAt = new Date()
    const updated = await db.$transaction(async (tx) => {
      const current = await tx.finding.findUnique({
        where: { id },
        select: { id: true, deletedAt: true },
      })

      if (!current) throw new Error('NOT_FOUND')
      if (current.deletedAt) throw new Error('ALREADY_DELETED')

      const result = await tx.finding.updateMany({
        where: { id, deletedAt: null },
        data: {
          deletedAt,
          updatedBy: deletedBy,
          updatedAt: deletedAt,
        },
      })

      if (result.count === 0) throw new Error('ALREADY_DELETED')

      await tx.auditLog.create({
        data: {
          entityType: 'Finding',
          entityId: id,
          action: 'DELETE',
          actorId: deletedBy,
          before: toAuditJson(current),
          after: toAuditJson({ id, deletedAt }),
        },
      })

      return result
    })

    void SearchService.removeFromIndex(id)

    return { id, deletedAt, updated }
  }
}
