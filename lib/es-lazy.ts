import { Client } from '@elastic/elasticsearch'

const globalForElasticsearch = global as unknown as { elasticsearchClient: Client }

let client: Client | null = null

export function getEsClient(): Client {
  if (client) return client

  if (!globalForElasticsearch.elasticsearchClient) {
    const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200'

    globalForElasticsearch.elasticsearchClient = new Client({
      node: elasticsearchUrl,
      // Disable SSL verification for development
      tls: {
        rejectUnauthorized: false,
      },
    })
  }

  client = globalForElasticsearch.elasticsearchClient
  return client
}
