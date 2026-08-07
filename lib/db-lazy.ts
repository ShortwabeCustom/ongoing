import { PrismaClient } from '@/lib/generated/prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

let db: PrismaClient | null = null

export function getDb(): PrismaClient {
  if (db) return db

  db =
    globalForPrisma.prisma ||
    new PrismaClient({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
    })

  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

  return db
}
