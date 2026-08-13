import { getEsClient } from '@/lib/es-lazy'
import { FINDINGS_INDEX, ensureIndexExists } from '@/lib/elasticsearch/findings-index'
import {
  Prisma,
  type FindingPriority,
  type FindingSeverity,
  type FindingStatus,
} from '@/lib/generated/prisma/client'
import { getDb } from '@/lib/db-lazy'
import { SearchQuery } from '@/lib/validators/search-query'

export interface SearchFindingItem {
  id: string
  observation: string
  highlightedObservation?: string
  status: string
  priority: string
  severity: string
  assigneeId?: string
  projectId: string
  experienceTags?: Array<{ experienceTag: string }>
  incidenceTypes?: Array<{ incidenceType: string }>
  createdAt: string
}

export interface SearchFacet {
  [key: string]: number
}

export interface SearchResponse {
  total: number
  items: SearchFindingItem[]
  took_ms: number
  source?: 'elasticsearch' | 'postgresql'
  warning?: string
  facets: {
    status?: Record<string, number>
    priority?: Record<string, number>
    severity?: Record<string, number>
    assignee?: Array<{ id: string; doc_count: number }>
    project?: Array<{ id: string; doc_count: number }>
  }
}

export interface FindingDocument {
  id: string
  observation: string
  evidenceDescriptions: string
  status: string
  priority: string
  severity: string
  assigneeId?: string
  projectId: string
  evidenceCount?: number
  createdAt: Date
  updatedAt: Date
}

type TermsBucket = {
  key: string | number
  doc_count: number
}

type TermsAggregation = {
  buckets?: TermsBucket[]
}

let elasticsearchUnavailableUntil = 0
const ELASTICSEARCH_RETRY_DELAY_MS = 30_000

function isElasticsearchEnabled() {
  return process.env.ELASTICSEARCH_ENABLED === 'true' && Boolean(process.env.ELASTICSEARCH_URL)
}

function getTermsBuckets(aggregation: unknown): TermsBucket[] {
  return (aggregation as TermsAggregation | undefined)?.buckets ?? []
}

function toFacetRecord(rows: Array<{ [key: string]: unknown; _count: number }>, field: string) {
  return Object.fromEntries(rows.map((row) => [String(row[field]), row._count]))
}

function buildPostgresWhere(query: SearchQuery): Prisma.FindingWhereInput {
  const where: Prisma.FindingWhereInput = {
    deletedAt: null,
  }
  const and: Prisma.FindingWhereInput[] = []

  if (query.status?.length) {
    where.status = { in: query.status as FindingStatus[] }
  }

  if (query.priority?.length) {
    where.priority = { in: query.priority as FindingPriority[] }
  }

  if (query.severity?.length) {
    where.severity = { in: query.severity as FindingSeverity[] }
  }

  if (query.assignee?.length) {
    where.assigneeId = { in: query.assignee }
  }

  if (query.project?.length) {
    where.projectId = { in: query.project }
  }

  // FASE 14.1: Date filtering by type
  if (query.dateFrom || query.dateTo) {
    const dateRange: Prisma.DateTimeFilter = {}
    if (query.dateFrom) dateRange.gte = new Date(query.dateFrom)
    if (query.dateTo) dateRange.lte = new Date(query.dateTo)

    const dateType = query.dateType || 'created'

    switch (dateType) {
      case 'created':
        where.createdAt = dateRange
        break
      case 'updated':
        where.updatedAt = dateRange
        break
      case 'imported':
        // Filter by ImportBatch.importedAt
        // For findings without importBatchId, they won't match (created manually)
        where.importBatch = {
          importedAt: dateRange,
        }
        break
      case 'session':
        // Filter by TestSession.date
        where.testSession = {
          date: dateRange,
        }
        break
    }
  }

  if (query.hasEvidence !== undefined && query.hasEvidence !== 'any') {
    const hasEvidence =
      query.hasEvidence === true || query.hasEvidence === 'with'

    where.evidence = hasEvidence
      ? { some: { deletedAt: null } }
      : { none: { deletedAt: null } }
  }

  if (query.q) {
    const textFilter = { contains: query.q, mode: 'insensitive' as const }
    and.push({
      OR: [
        { observation: textFilter },
        { folio: textFilter },
        { previousScreen: textFilter },
        { currentScreen: textFilter },
        { flowStep: textFilter },
        { evidence: { some: { deletedAt: null, caption: textFilter } } },
        { evidence: { some: { deletedAt: null, originalFilename: textFilter } } },
        { comments: { some: { text: textFilter } } },
        { resolutions: { some: { description: textFilter } } },
      ],
    })
  }

  if (and.length) {
    where.AND = and
  }

  return where
}

export class SearchService {
  /**
   * Index a single finding in Elasticsearch
   */
  static async indexFinding(finding: FindingDocument): Promise<void> {
    if (!isElasticsearchEnabled()) return

    try {
      await ensureIndexExists()

      const client = getEsClient()
      await client.index({
        index: FINDINGS_INDEX,
        id: finding.id,
        body: {
          id: finding.id,
          observation: finding.observation,
          evidenceDescriptions: finding.evidenceDescriptions,
          status: finding.status,
          priority: finding.priority,
          severity: finding.severity,
          assigneeId: finding.assigneeId,
          projectId: finding.projectId,
          evidenceCount: finding.evidenceCount || 0,
          createdAt: finding.createdAt.toISOString(),
          updatedAt: finding.updatedAt.toISOString(),
        },
      })
    } catch (error) {
      console.error(`[Elasticsearch] Failed to index finding ${finding.id}:`, error)
      // Fire-and-forget: don't throw, indexation failure should never block the main operation
    }
  }

  /**
   * Remove a finding from the Elasticsearch index
   */
  static async removeFromIndex(id: string): Promise<void> {
    if (!isElasticsearchEnabled()) return

    try {
      const client = getEsClient()
      await client.delete({
        index: FINDINGS_INDEX,
        id,
      })
    } catch (error: any) {
      // 404 is expected if the document was never indexed or already deleted
      if (error?.statusCode !== 404) {
        console.error(`[Elasticsearch] Failed to remove finding ${id}:`, error)
      }
      // Fire-and-forget: don't throw
    }
  }

  /**
   * Bulk index multiple findings
   */
  static async bulkIndexFindings(findings: FindingDocument[]): Promise<void> {
    if (findings.length === 0) return
    if (!isElasticsearchEnabled()) return

    try {
      await ensureIndexExists()

      const client = getEsClient()

      const body = findings.flatMap((finding) => [
        { index: { _index: FINDINGS_INDEX, _id: finding.id } },
        {
          id: finding.id,
          observation: finding.observation,
          evidenceDescriptions: finding.evidenceDescriptions,
          status: finding.status,
          priority: finding.priority,
          severity: finding.severity,
          assigneeId: finding.assigneeId,
          projectId: finding.projectId,
          evidenceCount: finding.evidenceCount || 0,
          createdAt: finding.createdAt.toISOString(),
          updatedAt: finding.updatedAt.toISOString(),
        },
      ])

      const result = await client.bulk({ body })

      if (result.errors) {
        const errorDetails = result.items
          .filter((item: any) => item.index?.error)
          .map((item: any) => `${item.index._id}: ${item.index.error.reason}`)
          .slice(0, 5)
          .join('; ')
        console.error(`[Elasticsearch] Bulk indexing had errors (showing first 5): ${errorDetails}`)
      }
    } catch (error) {
      console.error(`[Elasticsearch] Failed to bulk index ${findings.length} findings:`, error)
      // Fire-and-forget: don't throw
    }
  }

  /**
   * Search findings with full-text and filters
   */
  static async search(query: SearchQuery): Promise<SearchResponse> {
    if (!isElasticsearchEnabled()) {
      return this.searchPostgres(query, 'Elasticsearch disabled; using PostgreSQL fallback')
    }

    // FASE 14.1: If filtering by imported/session dates, use PostgreSQL directly
    // (Elasticsearch index doesn't have these fields)
    if (query.dateType === 'imported' || query.dateType === 'session') {
      return this.searchPostgres(query, `Using PostgreSQL for dateType="${query.dateType}"`)
    }

    const now = Date.now()
    if (now < elasticsearchUnavailableUntil) {
      return this.searchPostgres(query, 'Elasticsearch temporarily unavailable')
    }

    try {
      return await this.searchElasticsearch(query)
    } catch (error) {
      elasticsearchUnavailableUntil = Date.now() + ELASTICSEARCH_RETRY_DELAY_MS
      console.warn('[Search] Elasticsearch unavailable; falling back to PostgreSQL:', error)
      return this.searchPostgres(query, 'Elasticsearch unavailable; using PostgreSQL fallback')
    }
  }

  private static async searchElasticsearch(query: SearchQuery): Promise<SearchResponse> {
    await ensureIndexExists()

    const client = getEsClient()

    const filters = []

    if (query.status?.length) {
      filters.push({ terms: { status: query.status } })
    }

    if (query.priority?.length) {
      filters.push({ terms: { priority: query.priority } })
    }

    if (query.severity?.length) {
      filters.push({ terms: { severity: query.severity } })
    }

    // FASE 14: Support both single and multiple assignees
    if (query.assignee?.length) {
      filters.push({ terms: { assigneeId: query.assignee } })
    }

    // FASE 14: Support both single and multiple projects
    if (query.project?.length) {
      filters.push({ terms: { projectId: query.project } })
    }

    // FASE 14.1: Date range filtering by type
    if (query.dateFrom || query.dateTo) {
      const rangeFilter: any = {}
      if (query.dateFrom) {
        rangeFilter.gte = new Date(query.dateFrom).toISOString()
      }
      if (query.dateTo) {
        rangeFilter.lte = new Date(query.dateTo).toISOString()
      }

      const dateType = query.dateType || 'created'
      const dateField = dateType === 'updated' ? 'updatedAt' : 'createdAt'
      filters.push({ range: { [dateField]: rangeFilter } })
    }

    // FASE 14: Filter by evidence presence
    if (query.hasEvidence !== undefined) {
      if (query.hasEvidence) {
        filters.push({ range: { evidenceCount: { gt: 0 } } })
      } else {
        filters.push({ term: { evidenceCount: 0 } })
      }
    }

    const boolQuery: any = {
      filter: filters.length > 0 ? filters : undefined,
    }

    if (query.q) {
      boolQuery.must = {
        multi_match: {
          query: query.q,
          fields: ['observation', 'evidenceDescriptions'],
          type: 'best_fields',
          operator: 'and',
        },
      }
    }

    const searchBody: any = {
      query: {
        bool: boolQuery,
      },
      highlight: {
        fields: {
          observation: {},
        },
        pre_tags: ['<em>'],
        post_tags: ['</em>'],
      },
      aggs: {
        status: {
          terms: { field: 'status', size: 20 },
        },
        priority: {
          terms: { field: 'priority', size: 20 },
        },
        severity: {
          terms: { field: 'severity', size: 20 },
        },
        assignee: {
          terms: { field: 'assigneeId', size: 50 },
        },
        project: {
          terms: { field: 'projectId', size: 50 },
        },
      },
      from: query.offset,
      size: query.limit,
    }

    const startTime = Date.now()
    const result = await client.search({
      index: FINDINGS_INDEX,
      body: searchBody,
    })
    const took_ms = Date.now() - startTime

    const total = typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value ?? 0

    const items: SearchFindingItem[] = (result.hits.hits ?? []).map((hit: any) => ({
      id: hit._source.id,
      observation: hit._source.observation,
      highlightedObservation: hit.highlight?.observation?.[0] ?? undefined,
      status: hit._source.status,
      priority: hit._source.priority,
      severity: hit._source.severity,
      assigneeId: hit._source.assigneeId,
      projectId: hit._source.projectId,
      experienceTags: hit._source.experienceTags,
      incidenceTypes: hit._source.incidenceTypes,
      createdAt: hit._source.createdAt,
    }))

    const facets: SearchResponse['facets'] = {}

    if (result.aggregations?.status) {
      facets.status = {}
      for (const bucket of getTermsBuckets(result.aggregations.status)) {
        facets.status[String(bucket.key)] = bucket.doc_count
      }
    }

    if (result.aggregations?.priority) {
      facets.priority = {}
      for (const bucket of getTermsBuckets(result.aggregations.priority)) {
        facets.priority[String(bucket.key)] = bucket.doc_count
      }
    }

    if (result.aggregations?.severity) {
      facets.severity = {}
      for (const bucket of getTermsBuckets(result.aggregations.severity)) {
        facets.severity[String(bucket.key)] = bucket.doc_count
      }
    }

    // FASE 14: Assignee facets
    if (result.aggregations?.assignee) {
      facets.assignee = getTermsBuckets(result.aggregations.assignee).map((bucket) => ({
        id: String(bucket.key),
        doc_count: bucket.doc_count,
      }))
    }

    // FASE 14: Project facets
    if (result.aggregations?.project) {
      facets.project = getTermsBuckets(result.aggregations.project).map((bucket) => ({
        id: String(bucket.key),
        doc_count: bucket.doc_count,
      }))
    }

    return {
      total,
      items,
      took_ms,
      source: 'elasticsearch',
      facets,
    }
  }

  private static async searchPostgres(query: SearchQuery, warning?: string): Promise<SearchResponse> {
    const db = getDb()
    const startTime = Date.now()
    const where = buildPostgresWhere(query)

    const [items, total, statusFacetRows, priorityFacetRows, severityFacetRows, assigneeFacetRows, projectFacetRows] =
      await Promise.all([
        db.finding.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: query.offset,
          take: query.limit,
          select: {
            id: true,
            observation: true,
            status: true,
            priority: true,
            severity: true,
            assigneeId: true,
            projectId: true,
            experienceTags: {
              select: { experienceTag: true },
            },
            incidenceTypes: {
              select: { incidenceType: true },
            },
            createdAt: true,
          },
        }),
        db.finding.count({ where }),
        db.finding.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
        db.finding.groupBy({
          by: ['priority'],
          where,
          _count: true,
        }),
        db.finding.groupBy({
          by: ['severity'],
          where,
          _count: true,
        }),
        db.finding.groupBy({
          by: ['assigneeId'],
          where: { ...where, assigneeId: { not: null } },
          _count: true,
        }),
        db.finding.groupBy({
          by: ['projectId'],
          where,
          _count: true,
        }),
      ])

    return {
      total,
      items: items.map((item) => ({
        id: item.id,
        observation: item.observation,
        status: item.status,
        priority: item.priority,
        severity: item.severity,
        assigneeId: item.assigneeId ?? undefined,
        projectId: item.projectId,
        experienceTags: item.experienceTags,
        incidenceTypes: item.incidenceTypes,
        createdAt: item.createdAt.toISOString(),
      })),
      took_ms: Date.now() - startTime,
      source: 'postgresql',
      warning,
      facets: {
        status: toFacetRecord(statusFacetRows, 'status'),
        priority: toFacetRecord(priorityFacetRows, 'priority'),
        severity: toFacetRecord(severityFacetRows, 'severity'),
        assignee: assigneeFacetRows.map((row) => ({
          id: row.assigneeId ?? '',
          doc_count: row._count,
        })),
        project: projectFacetRows.map((row) => ({
          id: row.projectId,
          doc_count: row._count,
        })),
      },
    }
  }
}
