/**
 * FASE 7: Seed test users with different roles
 * Run with: npx ts-node scripts/seed-users.ts
 */

import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'

const testUsers = [
  {
    email: 'alexis.pro_sk8@hotmail.com',
    name: 'Alexis',
    password: 'UIX-Owner-Alexis-2026-9Ls3',
    role: 'OWNER' as const,
  },
  {
    email: 'ilse.garcia@elektra.com.mx',
    name: 'Ilse García (Elektra)',
    password: 'UIX-Owner-Ilse-2026-4Gx8',
    role: 'QA_LEAD' as const,
  },
  {
    email: 'jonathan.ramos@elektra.com.mx',
    name: 'Jonathan Ramos (Elektra)',
    password: 'UIX-Owner-Ramos-2026-7Qp9',
    role: 'DEVELOPER' as const,
  },
]

async function main() {
  const db = prisma()
  console.log('🌱 Seeding production users...')

  for (const user of testUsers) {
    try {
      const passwordHash = await hashPassword(user.password)

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

  console.log(`\n✨ Users created!`)
  console.log('\nLogin examples:')
  testUsers.forEach((user) => {
    console.log(`  Email: ${user.email}`)
    console.log(`  Password: ${user.password}`)
    console.log(`  Rol: ${user.role}\n`)
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
