import { getDb } from '@/lib/db-lazy'
import {
  ResolutionState,
  UpdateResolutionStateInput,
  CreateResolutionInput,
  isValidTransition,
  getAllowedTransitions,
} from '@/lib/validators/workflow'
import { AuditAction } from '@/lib/validators/workflow'

export class ResolutionService {
  /**
   * Create a new resolution for a finding
   */
  static async createResolution(
    findingId: string,
    input: CreateResolutionInput,
    userId: string,
  ) {
    const prisma = getDb()
    const resolution = await prisma.resolution.create({
      data: {
        findingId,
        description: input.description,
        assignedTo: input.assignedTo,
        state: 'OPEN',
        createdBy: userId,
      },
      include: {
        evidence: {
          select: {
            id: true,
            originalFilename: true,
            caption: true,
            url: true,
          },
        },
      },
    })

    // Attach evidence if provided
    if (input.evidence.length > 0) {
      await prisma.evidence.updateMany({
        where: { id: { in: input.evidence } },
        data: { resolutionId: resolution.id },
      })
    }

    // Log to audit trail
    await this.logAudit(
      findingId,
      'CREATE',
      userId,
      { state: 'OPEN', description: input.description },
      null,
    )

    return resolution
  }

  /**
   * Get all resolutions for a finding
   */
  static async getResolutions(findingId: string, limit = 50, offset = 0) {
    const prisma = getDb()
    const [resolutions, total] = await Promise.all([
      prisma.resolution.findMany({
        where: { findingId },
        include: {
          evidence: {
            select: {
              id: true,
              originalFilename: true,
              caption: true,
              url: true,
            },
          },
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.resolution.count({ where: { findingId } }),
    ])

    return { items: resolutions, total }
  }

  /**
   * Get a specific resolution
   */
  static async getResolution(findingId: string, resolutionId: string) {
    const prisma = getDb()
    return prisma.resolution.findFirst({
      where: { id: resolutionId, findingId },
      include: {
        evidence: {
          select: {
            id: true,
            originalFilename: true,
            caption: true,
            url: true,
          },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    })
  }

  /**
   * Update resolution state (with transition validation)
   */
  static async updateResolutionState(
    findingId: string,
    resolutionId: string,
    input: UpdateResolutionStateInput,
    userId: string,
  ) {
    const prisma = getDb()
    // Get current resolution
    const current = await prisma.resolution.findFirst({
      where: { id: resolutionId, findingId },
    })

    if (!current) {
      throw new Error('Resolution not found')
    }

    // Validate state transition
    if (!isValidTransition(current.state as ResolutionState, input.state)) {
      throw new Error(
        `Invalid state transition: ${current.state} → ${input.state}. Allowed: ${getAllowedTransitions(current.state as ResolutionState).join(', ')}`,
      )
    }

    // Update resolution
    const updated = await prisma.resolution.update({
      where: { id: resolutionId },
      data: {
        state: input.state,
        notes: input.notes,
        updatedAt: new Date(),
      },
      include: {
        evidence: {
          select: {
            id: true,
            originalFilename: true,
            caption: true,
            url: true,
          },
        },
      },
    })

    // Attach/update evidence if provided
    if (input.evidence.length > 0) {
      // Detach current evidence
      await prisma.evidence.updateMany({
        where: { resolutionId },
        data: { resolutionId: null },
      })

      // Attach new evidence
      await prisma.evidence.updateMany({
        where: { id: { in: input.evidence } },
        data: { resolutionId },
      })
    }

    // Log to audit trail
    await this.logAudit(
      findingId,
      'STATE_CHANGED',
      userId,
      { state: current.state, notes: current.notes },
      { state: updated.state, notes: updated.notes },
    )

    return updated
  }

  /**
   * Log audit entry
   */
  static async logAudit(
    findingId: string,
    action: AuditAction,
    userId: string,
    before: Record<string, any> | null,
    after: Record<string, any> | null,
  ) {
    return prisma.auditLog.create({
      data: {
        findingId,
        action,
        actorId: userId,
        changes: { before, after },
        details: `${action}: ${before ? 'updated' : 'created'}`,
        ipAddress: undefined,
      },
    })
  }

  /**
   * Batch update resolutions
   */
  static async bulkUpdateState(
    findingId: string,
    updates: Array<{ resolutionId: string; state: ResolutionState }>,
    userId: string,
  ) {
    const results = []

    for (const update of updates) {
      try {
        const result = await this.updateResolutionState(
          findingId,
          update.resolutionId,
          { state: update.state },
          userId,
        )
        results.push({ id: update.resolutionId, success: true, result })
      } catch (error) {
        results.push({
          id: update.resolutionId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return results
  }
}
