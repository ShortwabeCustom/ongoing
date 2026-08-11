import { Client } from '@elastic/elasticsearch'

const globalForElasticsearch = global as unknown as { elasticsearchClient: Client }

let client: Client | null = null

export function getEsClient(): Client {
  if (client) return client

  if (!globalForElasticsearch.elasticsearchClient) {
    const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200'

    globalForElasticsearch.elasticsearchClient = new Client({
      node: elasticsearchUrl,
      maxRetries: Number(process.env.ELASTICSEARCH_MAX_RETRIES ?? 0),
      requestTimeout: Number(process.env.ELASTICSEARCH_REQUEST_TIMEOUT_MS ?? 1500),
      // Disable SSL verification for development
      tls: {
        rejectUnauthorized: false,
      },
    })
  }

  client = globalForElasticsearch.elasticsearchClient
  return client
}
