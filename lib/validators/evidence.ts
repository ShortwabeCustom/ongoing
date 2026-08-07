import { z } from 'zod'

export const uploadEvidenceSchema = z.object({
  findingId: z.string().min(1, 'Finding ID is required'),
  caption: z.string().max(500, 'Caption must not exceed 500 characters').optional(),
})

export type UploadEvidenceInput = z.infer<typeof uploadEvidenceSchema>

export const updateEvidenceSchema = z.object({
  caption: z.string().max(500, 'Caption must not exceed 500 characters').optional(),
})

export type UpdateEvidenceInput = z.infer<typeof updateEvidenceSchema>
