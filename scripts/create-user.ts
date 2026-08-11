import { hash } from '@node-rs/argon2'
import { getDb } from '../lib/db-lazy'

const USER_ROLES = [
  'OWNER',
  'QA_LEAD',
  'DESIGNER',
  'DEVELOPER',
  'BUSINESS_REVIEWER',
  'VIEWER',
] as const

type UserRole = (typeof USER_ROLES)[number]

function readRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(`${name} environment variable is required`)
  }
  return value.trim()
}

function readRole(): UserRole {
  const value = process.env.ADMIN_ROLE ?? 'OWNER'
  if (!USER_ROLES.includes(value as UserRole)) {
    throw new Error(`ADMIN_ROLE must be one of: ${USER_ROLES.join(', ')}`)
  }
  return value as UserRole
}

async function createUser() {
  const prisma = getDb()
  const email = readRequiredEnv('ADMIN_EMAIL').toLowerCase()
  const password = readRequiredEnv('ADMIN_PASSWORD')
  const name = process.env.ADMIN_NAME?.trim() || 'Admin'
  const role = readRole()

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  })

  if (existing) {
    console.log(`User already exists: ${existing.email} (${existing.id})`)
    return
  }

  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role,
    },
  })

  console.log(`User created: ${user.email} (${user.id})`)
  console.log(`Role: ${user.role}`)
}

createUser()
  .catch((error) => {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await getDb().$disconnect()
  })
