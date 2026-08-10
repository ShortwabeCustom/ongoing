import { getDb } from '@/lib/db-lazy'

// Create a proxy that allows using prisma as both a function and an object
const prismaProxy = new Proxy(getDb, {
  get: (target, prop) => {
    const db = target()
    return (db as any)[prop]
  },
  apply: (target) => {
    return target()
  },
}) as any

export { prismaProxy as prisma }
