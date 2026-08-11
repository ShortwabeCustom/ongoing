import { NextRequest, NextResponse } from 'next/server'
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
  try {
    const client = new Client({ node: process.env.ELASTICSEARCH_URL! })
    const health = await client.cluster.health()
    return { status: health.status, nodes: health.number_of_nodes }
  } catch (error) {
    return { status: 'unhealthy', error: String(error) }
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  const [db, es] = await Promise.all([checkDatabase(), checkElasticsearch()])

  const latency = Date.now() - startTime
  const isHealthy = db.status === 'healthy' && es.status !== 'unhealthy'

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
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
