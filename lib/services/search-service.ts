import { getEsClient } from '@/lib/es-lazy'
import { FINDINGS_INDEX, ensureIndexExists } from '@/lib/elasticsearch/findings-index'
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
  createdAt: string
}

export interface SearchFacet {
  [key: string]: number
}

export interface SearchResponse {
  total: number
  items: SearchFindingItem[]
  took_ms: number
  facets: {
    status?: Record<string, number>
    priority?: Record<string, number>
    severity?: Record<string, number>
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
  createdAt: Date
  updatedAt: Date
}

export class SearchService {
  /**
   * Index a single finding in Elasticsearch
   */
  static async indexFinding(finding: FindingDocument): Promise<void> {
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

    if (query.assigneeId) {
      filters.push({ term: { assigneeId: query.assigneeId } })
    }

    if (query.projectId) {
      filters.push({ term: { projectId: query.projectId } })
    }

    if (query.createdAfter || query.createdBefore) {
      const rangeFilter: any = {}
      if (query.createdAfter) {
        rangeFilter.gte = new Date(query.createdAfter).toISOString()
      }
      if (query.createdBefore) {
        rangeFilter.lte = new Date(query.createdBefore).toISOString()
      }
      filters.push({ range: { createdAt: rangeFilter } })
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
      createdAt: hit._source.createdAt,
    }))

    const facets: SearchResponse['facets'] = {}

    if (result.aggregations?.status) {
      facets.status = {}
      for (const bucket of result.aggregations.status.buckets ?? []) {
        facets.status[bucket.key] = bucket.doc_count
      }
    }

    if (result.aggregations?.priority) {
      facets.priority = {}
      for (const bucket of result.aggregations.priority.buckets ?? []) {
        facets.priority[bucket.key] = bucket.doc_count
      }
    }

    if (result.aggregations?.severity) {
      facets.severity = {}
      for (const bucket of result.aggregations.severity.buckets ?? []) {
        facets.severity[bucket.key] = bucket.doc_count
      }
    }

    return {
      total,
      items,
      took_ms,
      facets,
    }
  }
}
