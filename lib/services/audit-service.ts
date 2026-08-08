import { getDb } from '@/lib/db-lazy'
import { AuditLogFilter } from '@/lib/validators/workflow'

export class AuditService {
  /**
   * Get audit log entries for a finding
   */
  static async getAuditLog(findingId: string, filter: AuditLogFilter) {
    const prisma = getDb()
    const where: Record<string, any> = { findingId }

    if (filter.action) {
      where.action = filter.action
    }

    if (filter.userId) {
      where.actorId = filter.userId
    }

    if (filter.dateRange) {
      where.createdAt = {
        gte: filter.dateRange[0],
        lte: filter.dateRange[1],
      }
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filter.limit,
        skip: filter.offset,
      }),
      prisma.auditLog.count({ where }),
    ])

    return { items, total }
  }

  /**
   * Get audit log entry by ID
   */
  static async getAuditLogEntry(id: string) {
    const prisma = getDb()
    return prisma.auditLog.findUnique({
      where: { id },
      include: {
        actor: {
          select: { id: true, name: true, email: true },
        },
      },
    })
  }

  /**
   * Export audit log as CSV
   */
  static async exportAuditLog(findingId: string): Promise<string> {
    const prisma = getDb()
    const logs = await prisma.auditLog.findMany({
      where: { findingId },
      include: {
        actor: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // CSV headers
    const headers = ['Timestamp', 'Action', 'Actor', 'Email', 'Changes', 'Details']
    const rows = logs.map((log) => [
      log.createdAt.toISOString(),
      log.action,
      log.actor?.name || 'System',
      log.actor?.email || '',
      log.changes ? JSON.stringify(log.changes) : '',
      log.details || '',
    ])

    // Format CSV
    const csv = [
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    return csv
  }

  /**
   * Get audit statistics for a finding
   */
  static async getAuditStats(findingId: string) {
    const prisma = getDb()
    const [
      total,
      byAction,
      byActor,
      latestChanges,
    ] = await Promise.all([
      prisma.auditLog.count({ where: { findingId } }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where: { findingId },
        _count: { id: true },
      }),
      prisma.auditLog.groupBy({
        by: ['actorId'],
        where: { findingId },
        _count: { id: true },
      }),
      prisma.auditLog.findMany({
        where: { findingId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          createdAt: true,
          action: true,
          actor: {
            select: { name: true },
          },
        },
      }),
    ])

    return {
      total,
      byAction,
      byActor,
      latestChanges,
    }
  }

  /**
   * Get change history for a field
   */
  static async getFieldHistory(findingId: string, fieldName: string) {
    const prisma = getDb()
    const logs = await prisma.auditLog.findMany({
      where: { findingId },
      include: {
        actor: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return logs
      .filter(
        (log) =>
          log.changes &&
          (log.changes.before?.[fieldName] !== undefined ||
            log.changes.after?.[fieldName] !== undefined),
      )
      .map((log) => ({
        timestamp: log.createdAt,
        action: log.action,
        actor: log.actor,
        before: log.changes?.before?.[fieldName],
        after: log.changes?.after?.[fieldName],
      }))
  }

  /**
   * Clear audit log for a finding (admin only)
   */
  static async clearAuditLog(findingId: string) {
    const prisma = getDb()
    return prisma.auditLog.deleteMany({
      where: { findingId },
    })
  }
}
