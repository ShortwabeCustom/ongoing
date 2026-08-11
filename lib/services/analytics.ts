import { Prisma } from '@/lib/generated/prisma/client'
import { getDb } from '@/lib/db-lazy'
import { FindingService } from '@/lib/services/finding-service'
import { AnalyticsQuery } from '@/lib/validators/analytics-query'
import { startOfDay, startOfWeek } from 'date-fns'

const CLOSED_STATUSES = ['CLOSED', 'VALIDATED']

export class AnalyticsService {
  private static toFindingWhere(
    filters: AnalyticsQuery,
  ): Prisma.FindingWhereInput {
    const where = FindingService.buildWhereClause({
      status: filters.status,
      priority: filters.priority,
      severity: filters.severity,
      createdAfter: filters.from,
      createdBefore: filters.to,
      projectId: filters.projectId,
    })
    return where
  }

  static async getKPIs(filters: AnalyticsQuery) {
    const db = getDb()
    const where = this.toFindingWhere(filters)

    const [
      total,
      byStatus,
      validationStats,
      closedFindings,
      allFindings,
    ] = await Promise.all([
      db.finding.count({ where }),
      db.finding.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      db.validation.groupBy({
        by: ['result'],
        where: { finding: where },
        _count: true,
      }),
      db.finding.findMany({
        where: { ...where, status: { in: CLOSED_STATUSES as any } },
        select: { id: true, createdAt: true },
      }),
      db.finding.findMany({
        where,
        select: { id: true, createdAt: true },
      }),
    ])

    const closedStatusHistry = await db.findingStatusHistory.findMany({
      where: {
        finding: where,
        toStatus: { in: CLOSED_STATUSES as any },
      },
      select: { findingId: true, changedAt: true },
    })

    const statusMap = new Map<string, number>()
    byStatus.forEach((row) => {
      statusMap.set(row.status, (row as any)._count)
    })

    const validationMap = new Map<string, number>()
    validationStats.forEach((row) => {
      validationMap.set(row.result, (row as any)._count)
    })

    let avgResolutionTime = 0
    if (closedFindings.length > 0) {
      const closedWithHistory = closedFindings.filter((f) =>
        closedStatusHistry.find((h) => h.findingId === f.id),
      )
      if (closedWithHistory.length > 0) {
        const resolutionTimes = closedWithHistory
          .map((f) => {
            const historyRecord = closedStatusHistry.find(
              (h) => h.findingId === f.id,
            )
            if (!historyRecord) return 0
            const ms =
              historyRecord.changedAt.getTime() - f.createdAt.getTime()
            return ms / (1000 * 60 * 60 * 24)
          })
          .filter((d) => d > 0)
        avgResolutionTime =
          resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      }
    }

    const openCount = total - closedFindings.length
    const validationPass = validationMap.get('PASS') ?? 0
    const validationFail = validationMap.get('FAIL') ?? 0
    const validationPending = validationMap.get('PENDING') ?? 0
    const validationRate =
      validationPass + validationFail > 0
        ? (validationPass / (validationPass + validationFail)) * 100
        : 0

    return {
      total,
      open: openCount,
      closed: closedFindings.length,
      avgResolutionTimeDays: Math.round(avgResolutionTime * 10) / 10,
      validationPassCount: validationPass,
      validationFailCount: validationFail,
      validationPendingCount: validationPending,
      validationPassRate: Math.round(validationRate * 10) / 10,
      statusDistribution: Object.fromEntries(statusMap),
    }
  }

  static async getStatusBreakdown(filters: AnalyticsQuery) {
    const db = getDb()
    const where = this.toFindingWhere(filters)

    const breakdown = await db.finding.groupBy({
      by: ['status'],
      where,
      _count: true,
    })

    return Object.fromEntries(
      breakdown.map((row) => [row.status, (row as any)._count]),
    )
  }

  static async getPriorityBreakdown(filters: AnalyticsQuery) {
    const db = getDb()
    const where = this.toFindingWhere(filters)

    const breakdown = await db.finding.groupBy({
      by: ['priority'],
      where,
      _count: true,
    })

    return Object.fromEntries(
      breakdown.map((row) => [row.priority, (row as any)._count]),
    )
  }

  static async getSeverityBreakdown(filters: AnalyticsQuery) {
    const db = getDb()
    const where = this.toFindingWhere(filters)

    const breakdown = await db.finding.groupBy({
      by: ['severity'],
      where,
      _count: true,
    })

    return Object.fromEntries(
      breakdown.map((row) => [row.severity, (row as any)._count]),
    )
  }

  static async getTimeSeries(filters: AnalyticsQuery, granularity: 'day' | 'week' = 'day') {
    const db = getDb()
    const where = this.toFindingWhere(filters)

    const created = await db.finding.findMany({
      where,
      select: { createdAt: true },
    })

    const closed = await db.findingStatusHistory.findMany({
      where: {
        finding: where,
        toStatus: { in: CLOSED_STATUSES as any },
      },
      select: { changedAt: true },
    })

    const getKey = (date: Date) =>
      granularity === 'day'
        ? startOfDay(date).toISOString()
        : startOfWeek(date).toISOString()

    const createdByPeriod = new Map<string, number>()
    const closedByPeriod = new Map<string, number>()

    created.forEach((f) => {
      const key = getKey(f.createdAt)
      createdByPeriod.set(key, (createdByPeriod.get(key) ?? 0) + 1)
    })

    closed.forEach((h) => {
      const key = getKey(h.changedAt)
      closedByPeriod.set(key, (closedByPeriod.get(key) ?? 0) + 1)
    })

    const allKeys = new Set([
      ...createdByPeriod.keys(),
      ...closedByPeriod.keys(),
    ])
    const sortedKeys = Array.from(allKeys).sort()

    return {
      created: sortedKeys.map((key) => ({
        date: key,
        count: createdByPeriod.get(key) ?? 0,
      })),
      closed: sortedKeys.map((key) => ({
        date: key,
        count: closedByPeriod.get(key) ?? 0,
      })),
    }
  }

  static async getResolutionFunnel(filters: AnalyticsQuery) {
    const db = getDb()
    const where = this.toFindingWhere(filters)

    const breakdown = await db.resolution.groupBy({
      by: ['state'],
      where: { finding: where },
      _count: true,
    })

    return Object.fromEntries(
      breakdown.map((row) => [row.state, (row as any)._count]),
    )
  }

  static async getValidationRate(filters: AnalyticsQuery) {
    const db = getDb()
    const where = this.toFindingWhere(filters)

    const breakdown = await db.validation.groupBy({
      by: ['result'],
      where: { finding: where },
      _count: true,
    })

    return Object.fromEntries(
      breakdown.map((row) => [row.result, (row as any)._count]),
    )
  }

  static async getRecentActivitySummary(limit: number = 50) {
    const db = getDb()

    const activities = await db.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    })

    const actionCounts = await db.activity.groupBy({
      by: ['action'],
      _count: true,
    })

    return {
      activities: activities.map((a) => ({
        id: a.id,
        userId: a.userId,
        userName: a.user.name,
        userEmail: a.user.email,
        userRole: a.user.role,
        action: a.action,
        resourceType: a.resourceType,
        resourceId: a.resourceId,
        details: a.details,
        createdAt: a.createdAt,
      })),
      actionCounts: Object.fromEntries(
        actionCounts.map((row) => [row.action, (row as any)._count]),
      ),
    }
  }
}
