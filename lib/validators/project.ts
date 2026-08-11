import { z } from 'zod'

export const ProjectCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
})

export const ProjectUpdateSchema = ProjectCreateSchema.partial()

export const TestSessionCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  date: z.coerce.date(),
  environment: z.string().trim().max(80).optional().nullable(),
  version: z.string().trim().min(1).max(80).default('unversioned'),
})

export const ProjectMemberCreateSchema = z.object({
  userId: z.string().min(5),
  role: z.enum(['OWNER', 'QA_LEAD', 'DESIGNER', 'DEVELOPER', 'BUSINESS_REVIEWER', 'VIEWER']),
})

export const ProjectMemberUpdateSchema = z.object({
  role: z.enum(['OWNER', 'QA_LEAD', 'DESIGNER', 'DEVELOPER', 'BUSINESS_REVIEWER', 'VIEWER']),
})

export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateSchema>
export type TestSessionCreateInput = z.infer<typeof TestSessionCreateSchema>
export type ProjectMemberCreateInput = z.infer<typeof ProjectMemberCreateSchema>
export type ProjectMemberUpdateInput = z.infer<typeof ProjectMemberUpdateSchema>
