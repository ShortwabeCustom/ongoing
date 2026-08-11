import { getDb } from '@/lib/db-lazy'
import {
  CreateValidationInput,
  CheckValidationInput,
  ValidationCriterion,
  AuditAction,
} from '@/lib/validators/workflow'

export class ValidationService {
  /**
   * Create a new validation checkpoint for a finding
   */
  static async createValidation(
    findingId: string,
    input: CreateValidationInput,
    userId: string,
  ) {
    const prisma = getDb()
    const validation = await prisma.validation.create({
      data: {
        findingId,
        criteria: input.criteria,
        notes: input.notes,
        result: 'PENDING',
        validatedBy: null,
        validatedAt: null,
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
        data: { validationId: validation.id },
      })
    }

    // Log to audit trail
    await this.logAudit(
      findingId,
      'CREATE',
      userId,
      null,
      { result: 'PENDING', criteria: input.criteria },
    )

    return validation
  }

  /**
   * Get all validations for a finding
   */
  static async getValidations(findingId: string, limit = 50, offset = 0) {
    const prisma = getDb()
    const [validations, total] = await Promise.all([
      prisma.validation.findMany({
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
          validator: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.validation.count({ where: { findingId } }),
    ])

    return { items: validations, total }
  }

  /**
   * Get a specific validation
   */
  static async getValidation(findingId: string, validationId: string) {
    const prisma = getDb()
    return prisma.validation.findFirst({
      where: { id: validationId, findingId },
      include: {
        evidence: {
          select: {
            id: true,
            originalFilename: true,
            caption: true,
            url: true,
          },
        },
        validator: {
          select: { id: true, name: true, email: true },
        },
      },
    })
  }

  /**
   * Check/run validation (hybrid: system validates + manual approval)
   */
  static async checkValidation(
    findingId: string,
    validationId: string,
    input: CheckValidationInput,
    userId: string,
  ) {
    const prisma = getDb()
    // Get current validation
    const validation = await prisma.validation.findFirst({
      where: { id: validationId, findingId },
    })

    if (!validation) {
      throw new Error('Validation not found')
    }

    // Current criteria
    const currentCriteria = (validation.criteria as ValidationCriterion[]) || []

    // Update criteria with results from input
    const updatedCriteria = currentCriteria.map((criterion) => ({
      ...criterion,
      passed: input.results[criterion.id] ?? criterion.passed,
    }))

    // Calculate result: all must pass
    const allPassed = updatedCriteria.every((c) => c.passed === true)
    const anyFailed = updatedCriteria.some((c) => c.passed === false)

    const result = allPassed ? 'PASS' : anyFailed ? 'FAIL' : 'PENDING'

    // Update validation
    const updated = await prisma.validation.update({
      where: { id: validationId },
      data: {
        criteria: updatedCriteria,
        result,
        notes: input.notes,
        validatedBy: userId,
        validatedAt: new Date(),
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

    // Log to audit trail
    await this.logAudit(
      findingId,
      'VALIDATE',
      userId,
      { result: validation.result, criteria: currentCriteria },
      { result, criteria: updatedCriteria },
    )

    return updated
  }

  /**
   * Get latest validation result for a finding
   */
  static async getLatestValidation(findingId: string) {
    const prisma = getDb()
    return prisma.validation.findFirst({
      where: { findingId },
      orderBy: { validatedAt: 'desc' },
      include: {
        evidence: {
          select: {
            id: true,
            originalFilename: true,
            caption: true,
            url: true,
          },
        },
        validator: {
          select: { id: true, name: true, email: true },
        },
      },
    })
  }

  /**
   * Check if validation is required before closing
   */
  static async isValidationRequired(findingId: string): Promise<boolean> {
    // Can be configured per project/finding type
    // For now: always require validation
    return true
  }

  /**
   * Get validation history for a finding
   */
  static async getValidationHistory(findingId: string) {
    const prisma = getDb()
    return prisma.validation.findMany({
      where: { findingId, result: { not: 'PENDING' } },
      include: {
        validator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { validatedAt: 'desc' },
    })
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
    const prisma = getDb()

    return prisma.auditLog.create({
      data: {
        entityType: 'Finding',
        entityId: findingId,
        action,
        actorId: userId,
        before: before ?? undefined,
        after: after ?? undefined,
      },
    })
  }
}
