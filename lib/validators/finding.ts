import { z } from 'zod'

const idSchema = z.string().min(5, 'Invalid identifier')
const optionalText = z.string().trim().max(500).optional().nullable()

// Definiciones compartidas por CREATE y UPDATE. Se declaran SIN `.default()`
// para que cada contrato aplique sus propias reglas: CREATE añade los defaults,
// UPDATE nunca los hereda (C-05).
const statusEnum = z.enum(['OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION', 'VALIDATED', 'CLOSED', 'BLOCKED', 'REOPENED'])
const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const severityEnum = z.enum(['COSMETIC', 'MINOR', 'MAJOR', 'BLOCKER'])
const effortEnum = z.enum(['S', 'M', 'L', 'XL'])
const incidenceTypeEnum = z.enum(['DESIGN', 'FUNCTIONALITY', 'BUSINESS_RULE', 'COPY'])
const experienceTagEnum = z.enum(['UI', 'UX', 'COPY', 'DEV'])

const folioField = z.string().trim().max(100)
const observationField = z.string().min(5, 'Min 5 characters').max(2000, 'Max 2000 characters')
const incidenceTypesField = z.array(incidenceTypeEnum).min(1, 'Select at least one type')

export const SupportLinkSchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  url: z.string().url('URL inválida').max(2000),
})

export const FindingCreateSchema = z.object({
  createdDate: z.string().datetime().optional(),
  testSessionId: idSchema.optional().nullable(),
  folio: folioField.optional().nullable(),
  observation: observationField,
  status: statusEnum.optional(),
  priority: priorityEnum.default('MEDIUM'),
  severity: severityEnum.default('MINOR'),
  effort: effortEnum.default('M'),
  assigneeId: idSchema.optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  incidenceTypes: incidenceTypesField,
  experienceTags: z.array(experienceTagEnum).optional(),
  supportLinks: z.array(SupportLinkSchema).optional(),
  previousScreen: optionalText,
  currentScreen: optionalText,
  flowStep: optionalText,
})

/**
 * C-05 — Contrato de UPDATE independiente, NO derivado de CREATE.
 *
 * Antes se construía como `FindingCreateSchema.omit(...).extend(...).partial()`.
 * En Zod, `.partial()` hace el campo opcional pero **no elimina el `.default()`**:
 * `priority`/`severity`/`effort` se rellenaban con los defaults de CREATE en
 * cualquier PATCH que los omitiera, corrompiendo silenciosamente la fila.
 *
 * Invariante de este esquema:
 *   clave ausente en la petición ⇒ clave ausente en el resultado validado
 *   ⇒ clave ausente en el `data` de Prisma ⇒ la BD conserva su valor anterior.
 *
 * Semántica por campo:
 *   - omitida            → no se toca (la clave no aparece en la salida)
 *   - `null` explícito   → sólo en campos nullable; limpia el valor en BD
 *   - presente con valor → debe ser válida, o el PATCH entero es 400
 *
 * `testSessionId` no es reasignable por PATCH y `createdDate` no es aplicable a
 * UPDATE (el servicio nunca la ha leído): ambas se descartan como claves
 * desconocidas, igual que antes se aceptaban y se ignoraban.
 *
 * `version` se declara opcional aquí a propósito: la ruta la exige explícitamente
 * y emite su propio 400 (`Version is required for optimistic locking`), contrato
 * que este cambio deja intacto.
 */
export const FindingUpdateSchema = z.object({
  version: z.number().int().positive('Optimistic locking version required').optional(),
  folio: folioField.optional().nullable(),
  observation: observationField.optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  severity: severityEnum.optional(),
  effort: effortEnum.optional(),
  assigneeId: idSchema.optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  incidenceTypes: incidenceTypesField.optional(),
  experienceTags: z.array(experienceTagEnum).optional(),
  supportLinks: z.array(SupportLinkSchema).optional(),
  previousScreen: optionalText,
  currentScreen: optionalText,
  flowStep: optionalText,
})

export const FindingStatusTransitionSchema = z.object({
  toStatus: z.enum(['OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION', 'VALIDATED', 'CLOSED', 'BLOCKED', 'REOPENED']),
  reason: z.string().optional(),
  version: z.number().int().positive(),
})

export const FindingFilterSchema = z.object({
  status: z.enum(['OPEN', 'TRIAGED', 'IN_PROGRESS', 'READY_FOR_VALIDATION', 'VALIDATED', 'CLOSED', 'BLOCKED', 'REOPENED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  severity: z.enum(['COSMETIC', 'MINOR', 'MAJOR', 'BLOCKER']).optional(),
  incidenceType: z.enum(['DESIGN', 'FUNCTIONALITY', 'BUSINESS_RULE', 'COPY']).optional(),
  experienceTag: z.enum(['UI', 'UX', 'COPY', 'DEV']).optional(),
  assigneeId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

export type SupportLink = z.infer<typeof SupportLinkSchema>
export type FindingCreate = z.infer<typeof FindingCreateSchema>
export type FindingUpdate = z.infer<typeof FindingUpdateSchema>
export type FindingStatusTransition = z.infer<typeof FindingStatusTransitionSchema>
export type FindingFilter = z.infer<typeof FindingFilterSchema>
