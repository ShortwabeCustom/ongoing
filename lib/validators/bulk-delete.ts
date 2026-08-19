import { z } from 'zod'

export const BulkDeleteSchema = z.object({
  ids: z.array(z.string().min(5)).min(1).max(100).transform((ids) => [...new Set(ids)]),
})
