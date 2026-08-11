import { NextResponse } from 'next/server'
import { Client } from '@elastic/elasticsearch'
import prisma from '@/lib/db'

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'healthy', latency: 'ok' }
  } catch (error) {
    return { status: 'unhealthy', error: String(error) }
  }
}

async function checkElasticsearch() {
  if (process.env.ELASTICSEARCH_ENABLED !== 'true' || !process.env.ELASTICSEARCH_URL) {
    return { status: 'disabled', optional: true }
  }

  try {
    const client = new Client({
      node: process.env.ELASTICSEARCH_URL!,
      maxRetries: Number(process.env.ELASTICSEARCH_MAX_RETRIES ?? 0),
      requestTimeout: Number(process.env.ELASTICSEARCH_REQUEST_TIMEOUT_MS ?? 1500),
    })
    const health = await Promise.race([
      client.cluster.health(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Elasticsearch health timeout')), 1500)
      ),
    ])
    return { status: health.status, nodes: health.number_of_nodes, optional: true }
  } catch (error) {
    return { status: 'unhealthy', optional: true, error: String(error) }
  }
}

export async function GET() {
  const startTime = Date.now()

  const [db, es] = await Promise.all([checkDatabase(), checkElasticsearch()])

  const latency = Date.now() - startTime
  const isHealthy = db.status === 'healthy'

  return NextResponse.json(
    {
      status: isHealthy && es.status === 'unhealthy' ? 'healthy_with_warnings' : isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      latency: `${latency}ms`,
      components: {
        database: db,
        elasticsearch: es,
      },
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  )
}
