#!/usr/bin/env node

/**
 * One-time script to index all existing findings into Elasticsearch
 * Usage: npx ts-node scripts/migrate-findings-to-es.ts
 */

import path from 'path'
import { Client } from '@elastic/elasticsearch'
import { getDb } from '@/lib/db-lazy'

const db = getDb()

async function main() {
  console.log('🚀 Starting Elasticsearch migration for findings...\n')

  const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
  const findingsIndex = process.env.ELASTICSEARCH_FINDINGS_INDEX || 'findings-v1'

  const client = new Client({
    node: elasticsearchUrl,
    tls: {
      rejectUnauthorized: false,
    },
  })

  try {
    // Test connection
    console.log(`📡 Connecting to Elasticsearch at ${elasticsearchUrl}...`)
    const healthCheck = await client.cluster.health()
    console.log(`✅ Connected to Elasticsearch (status: ${healthCheck.status})\n`)

    // Check if index exists
    const indexExists = await client.indices.exists({ index: findingsIndex })
    if (!indexExists) {
      console.log(`📝 Creating index '${findingsIndex}'...`)
      await client.indices.create({
        index: findingsIndex,
        body: {
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
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        },
      })
      console.log(`✅ Index created\n`)
    } else {
      console.log(`✅ Index '${findingsIndex}' already exists\n`)
    }

    // Fetch all non-deleted findings with evidence
    console.log('📚 Fetching findings from database...')
    const findings = await db.finding.findMany({
      where: { deletedAt: null },
      include: {
        evidence: {
          select: {
            caption: true,
            originalFilename: true,
          },
        },
      },
    })

    console.log(`✅ Found ${findings.length} findings to index\n`)

    if (findings.length === 0) {
      console.log('ℹ️  No findings to migrate.')
      await client.close()
      await db.$disconnect()
      process.exit(0)
    }

    // Prepare bulk indexing payload
    console.log('🔄 Preparing bulk index request...')
    const body: any[] = []

    for (const finding of findings) {
      const evidenceDescriptions = (finding.evidence ?? [])
        .map((e) => [e.caption, e.originalFilename].filter(Boolean).join(' '))
        .join(' ')

      body.push({ index: { _index: findingsIndex, _id: finding.id } })
      body.push({
        id: finding.id,
        observation: finding.observation,
        evidenceDescriptions,
        status: finding.status,
        priority: finding.priority,
        severity: finding.severity,
        assigneeId: finding.assigneeId || null,
        projectId: finding.projectId,
        createdAt: finding.createdAt.toISOString(),
        updatedAt: finding.updatedAt.toISOString(),
      })
    }

    // Perform bulk indexing
    console.log(`📤 Indexing ${findings.length} findings...`)
    const startTime = Date.now()
    const result = await client.bulk({ body })
    const elapsedTime = Date.now() - startTime

    if (result.errors) {
      const errorItems = result.items?.filter((item: any) => item.index?.error) || []
      console.error(`\n❌ Bulk indexing had ${errorItems.length} errors:`)
      errorItems.slice(0, 5).forEach((item: any) => {
        console.error(`  - ${item.index._id}: ${item.index.error.reason}`)
      })
      if (errorItems.length > 5) {
        console.error(`  ... and ${errorItems.length - 5} more`)
      }
    } else {
      console.log(`✅ Successfully indexed ${findings.length} findings in ${elapsedTime}ms\n`)
    }

    // Show summary
    console.log('📊 Summary:')
    console.log(`  • Findings indexed: ${findings.length}`)
    console.log(`  • Time taken: ${(elapsedTime / 1000).toFixed(2)}s`)
    console.log(`  • Index: ${findingsIndex}`)
    console.log(`  • Elasticsearch: ${elasticsearchUrl}`)
    console.log('\n✨ Migration complete!')

    await client.close()
  } catch (error: any) {
    console.error('\n❌ Migration failed:')
    console.error(error.message)
    if (error.code === 'ECONNREFUSED') {
      console.error('\nℹ️  Make sure Elasticsearch is running:')
      console.error('   docker-compose up -d elasticsearch')
    }
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

main()
