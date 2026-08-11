/**
 * FASE 7: Seed test users with different roles
 * Run with: npx ts-node scripts/seed-users.ts
 */

import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'

const TEST_PASSWORD = 'TestPassword123'

const testUsers = [
  {
    email: 'owner@test.local',
    name: 'Owner User',
    role: 'OWNER' as const,
  },
  {
    email: 'qa-lead@test.local',
    name: 'QA Lead',
    role: 'QA_LEAD' as const,
  },
  {
    email: 'designer@test.local',
    name: 'Designer',
    role: 'DESIGNER' as const,
  },
  {
    email: 'developer@test.local',
    name: 'Developer',
    role: 'DEVELOPER' as const,
  },
  {
    email: 'business@test.local',
    name: 'Business Reviewer',
    role: 'BUSINESS_REVIEWER' as const,
  },
  {
    email: 'viewer@test.local',
    name: 'Viewer',
    role: 'VIEWER' as const,
  },
  {
    email: 'ilse.garcia@test.local',
    name: 'Ilse García (Elektra)',
    role: 'QA_LEAD' as const,
  },
  {
    email: 'jonathan.ramos@test.local',
    name: 'Jonathan Ramos (Elektra)',
    role: 'DEVELOPER' as const,
  },
]

async function main() {
  const db = prisma()
  console.log('🌱 Seeding test users...')

  for (const user of testUsers) {
    try {
      const passwordHash = await hashPassword(TEST_PASSWORD)

      const created = await db.user.upsert({
        where: { email: user.email },
        update: { passwordHash, role: user.role },
        create: {
          email: user.email,
          name: user.name,
          role: user.role,
          passwordHash,
        },
      })

      console.log(`✅ ${user.role}: ${user.email}`)
    } catch (error) {
      console.error(`❌ Failed to seed ${user.email}:`, error)
    }
  }

  console.log(`\n✨ Test users created! Password: ${TEST_PASSWORD}`)
  console.log('\nLogin examples:')
  testUsers.forEach((user) => {
    console.log(`  curl -X POST http://localhost:3000/api/auth/login \\
    -H "Content-Type: application/json" \\
    -d '{"email":"${user.email}","password":"${TEST_PASSWORD}"}'`)
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    const db = prisma()
    await db.$disconnect()
  })
