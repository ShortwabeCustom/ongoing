import { getEsClient } from '@/lib/es-lazy'

export const FINDINGS_INDEX = process.env.ELASTICSEARCH_FINDINGS_INDEX ?? 'findings-v1'

const INDEX_MAPPING = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        spanish: {
          type: 'standard',
          stopwords: '_spanish_',
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      observation: { type: 'text', analyzer: 'spanish' },
      evidenceDescriptions: { type: 'text', analyzer: 'spanish' },
      status: { type: 'keyword' },
      priority: { type: 'keyword' },
      severity: { type: 'keyword' },
      assigneeId: { type: 'keyword' },
      projectId: { type: 'keyword' },
      evidenceCount: { type: 'integer' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
} as const

export async function ensureIndexExists(): Promise<void> {
  const client = getEsClient()

  try {
    const exists = await client.indices.exists({ index: FINDINGS_INDEX })

    if (!exists) {
      await client.indices.create({
        index: FINDINGS_INDEX,
        body: INDEX_MAPPING,
      })
    }
  } catch (error) {
    console.error(`[Elasticsearch] Failed to ensure index exists: ${error}`)
    throw error
  }
}
