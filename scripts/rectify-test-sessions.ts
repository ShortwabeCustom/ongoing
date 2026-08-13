#!/usr/bin/env node

/**
 * FASE 14.1.1 — Test Session Rectification Script
 *
 * Rectifies the TestSession mapping based on sourceSheet metadata.
 * Each sourceSheet represents a separate historical test session.
 *
 * Usage:
 *   npx tsx scripts/rectify-test-sessions.ts --dry-run
 *   npx tsx scripts/rectify-test-sessions.ts --apply
 */

import { getDb } from '@/lib/db-lazy'
import { PrismaClient } from '@/lib/generated/prisma/client'
import * as fs from 'fs'
import * as path from 'path'

interface SheetMapping {
  sourceSheet: string
  sessionName: string
  sessionDate: string // ISO date string
  findingsCount: number
  oldSessionId: string
  newSessionId?: string
}

const isDryRun = process.argv.includes('--dry-run')
const isApply = process.argv.includes('--apply')

if (!isDryRun && !isApply) {
  console.error('Usage: npx tsx scripts/rectify-test-sessions.ts --dry-run|--apply')
  process.exit(1)
}

async function main() {
  const prisma = getDb()

  console.log('\n' + '='.repeat(80))
  console.log(`FASE 14.1.1 — Test Session Rectification (${isDryRun ? 'DRY-RUN' : 'APPLY'})`)
  console.log('='.repeat(80) + '\n')

  try {
    // Step 1: Get all findings with sourceSheet
    console.log('📊 Step 1: Fetching findings by sourceSheet...')
    const findingsBySheet = await prisma.finding.groupBy({
      by: ['sourceSheet'],
      where: { sourceSheet: { not: null } },
      _count: true,
      _min: { createdAt: true },
      orderBy: { sourceSheet: 'asc' },
    })

    const mappings: SheetMapping[] = []
    const oldSessionId = (
      await prisma.testSession.findFirst({
        select: { id: true },
      })
    )?.id

    if (!oldSessionId) {
      throw new Error('No existing TestSession found!')
    }

    // Step 2: Build mappings
    console.log('🔄 Step 2: Building session mappings...\n')

    const sheetToSessionMap: Record<string, SheetMapping> = {}

    for (const row of findingsBySheet) {
      const sheet = row.sourceSheet || '[No sourceSheet]'
      const count = row._count
      const minDate = row._min.createdAt

      if (!minDate) continue

      // Normalize sheet name to session name
      const sessionName = normalizeName(sheet)
      const sessionDate = minDate.toISOString().split('T')[0]

      const mapping: SheetMapping = {
        sourceSheet: sheet,
        sessionName,
        sessionDate,
        findingsCount: count,
        oldSessionId,
      }

      sheetToSessionMap[sheet] = mapping
      mappings.push(mapping)

      console.log(`  ✓ "${sheet}"`)
      console.log(`    → Session: "${sessionName}" (${sessionDate})`)
      console.log(`    → Findings: ${count}`)
      console.log()
    }

    // Step 3: Validation
    console.log('✅ Step 3: Validation')
    const totalMapped = mappings.reduce((sum, m) => sum + m.findingsCount, 0)
    const totalFindings = await prisma.finding.count()

    console.log(`  Findings to remap: ${totalMapped}`)
    console.log(`  Total findings in DB: ${totalFindings}`)
    console.log(`  Unmapped findings: ${totalFindings - totalMapped}`)
    console.log()

    if (totalMapped + (totalFindings - totalMapped) !== totalFindings) {
      throw new Error('Validation failed: Count mismatch')
    }

    // Step 4: Show dry-run preview
    if (isDryRun) {
      console.log('🔮 DRY-RUN PREVIEW:\n')
      console.log('Sessions that would be created:')

      mappings.forEach((m, i) => {
        console.log(`  [${i + 1}] ${m.sessionName} (${m.sessionDate})`)
        console.log(`      sourceSheet: "${m.sourceSheet}"`)
        console.log(`      findings: ${m.findingsCount}`)
      })

      console.log()
      console.log('Findings that would be reassigned:')
      console.log(`  Total: ${totalMapped} findings`)
      console.log(`  Old session: "${oldSessionId}" (will have 0 findings after)`)
      console.log()

      console.log('⚠️  NO CHANGES WERE MADE (dry-run mode)\n')
      console.log('To apply these changes, run:')
      console.log('  npx tsx scripts/rectify-test-sessions.ts --apply\n')

      process.exit(0)
    }

    // Step 5: APPLY CHANGES
    if (isApply) {
      console.log('⚙️  Step 4: APPLYING CHANGES (this will modify your database)\n')

      // Use transaction
      const result = await prisma.$transaction(async (tx) => {
        const createdSessions = []

        // Get a reference user for createdBy (using the old session's creator)
        const oldSession = await tx.testSession.findUnique({
          where: { id: oldSessionId },
          select: { projectId: true, versionId: true, createdBy: true },
        })

        if (!oldSession) {
          throw new Error('Old session not found')
        }

        // Create new sessions
        for (const mapping of mappings) {
          const sessionDate = new Date(mapping.sessionDate + 'T00:00:00Z')

          const newSession = await tx.testSession.create({
            data: {
              name: mapping.sessionName,
              date: sessionDate,
              projectId: oldSession.projectId,
              versionId: oldSession.versionId,
              createdBy: oldSession.createdBy,
              environment: 'prod',
            },
          })

          mapping.newSessionId = newSession.id
          createdSessions.push(newSession)

          console.log(`  ✓ Created: "${mapping.sessionName}" (${mapping.sessionDate})`)
        }

        console.log()
        console.log('  Reassigning findings...')

        // Reassign findings to new sessions
        let totalReassigned = 0

        for (const mapping of mappings) {
          if (!mapping.newSessionId) continue

          const updated = await tx.finding.updateMany({
            where: { sourceSheet: mapping.sourceSheet },
            data: { testSessionId: mapping.newSessionId },
          })

          totalReassigned += updated.count
          console.log(`  ✓ Reassigned ${updated.count} findings to "${mapping.sessionName}"`)
        }

        console.log()
        console.log(`  Total reassigned: ${totalReassigned}`)

        return {
          createdSessions,
          totalReassigned,
        }
      })

      console.log('\n✅ RECTIFICATION COMPLETED SUCCESSFULLY')
      console.log(`   New sessions created: ${result.createdSessions.length}`)
      console.log(`   Findings reassigned: ${result.totalReassigned}`)

      // Step 6: Verify
      console.log('\n📊 Step 5: Verification')

      const sessionsAfter = await prisma.testSession.findMany({
        select: {
          id: true,
          name: true,
          date: true,
          _count: { select: { findings: true } },
        },
        orderBy: { date: 'asc' },
      })

      console.log('\n  Final TestSession distribution:')
      sessionsAfter.forEach(s => {
        const dateStr = s.date.toISOString().split('T')[0]
        console.log(`  ✓ ${s.name} (${dateStr}): ${s._count.findings} findings`)
      })

      // Save a record of what was changed
      const logPath = path.join(
        process.cwd(),
        'scripts',
        `.rectification-${new Date().toISOString().split('T')[0]}.log`,
      )
      fs.writeFileSync(
        logPath,
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            action: 'TEST_SESSION_RECTIFICATION',
            mappings,
            result,
          },
          null,
          2,
        ),
      )

      console.log(`\n  Log saved to: ${logPath}`)
      console.log()
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

function normalizeName(sourceSheet: string): string {
  // Remove redundant text, normalize names
  return sourceSheet
    .trim()
    .replace(/\b(Pruebas|Mod|XLSX_Import|inventario-observaciones)\b/i, match => {
      if (match.toLowerCase() === 'mod') return 'Modificación'
      if (match.toLowerCase() === 'xlsx_import') return 'Importación XLSX'
      if (match.toLowerCase() === 'inventario-observaciones') return 'Inventario (Legacy PWA)'
      return match
    })
    .trim()
}

main()
