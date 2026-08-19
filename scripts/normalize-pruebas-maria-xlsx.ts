#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { getDb } from '@/lib/db-lazy'
import { SearchService, type FindingDocument } from '@/lib/services/search-service'
import { StorageService } from '@/lib/services/storage-service'
import { PrivateFileStore } from '@/lib/storage/private-file-store'
import {
  auditWorkbook,
  deterministicEvidenceFilename,
  evidenceMarker,
  fingerprintForRow,
  normalizeText,
  reconcileIdentity,
  sessionDefinition,
  shouldPromoteToValidated,
  type NormalizedXlsxRow,
  type WorkbookAudit,
} from './lib/pruebas-maria-xlsx'

type ActionKind = 'CREATE' | 'UPDATE' | 'NOOP' | 'CONFLICT' | 'SKIP'

interface CliOptions {
  file: string
  apply: boolean
  report: string
  onlySheet?: string
}

interface SessionPlan {
  worksheet: string
  name: string
  date: string
  originStartDate: string
  originEndDate: string
  originPeriod: string
  isRange: boolean
  action: 'CREATE' | 'REUSE' | 'CONFLICT'
  id?: string
  reason?: string
}

interface FindingPlan {
  row: NormalizedXlsxRow
  fingerprint: string
  session: SessionPlan
  action: ActionKind
  findingId?: string
  strategy?: string
  changes: Record<string, unknown>
  supportLinks: string[]
  comment?: string
  evidence: Array<{
    action: 'CREATE' | 'SKIP_DUPLICATE'
    imageIndex: number
    originalFilename: string
    marker: string
    duplicateEvidenceId?: string
    duplicateEvidenceUrl?: string | null
    duplicateStorageKey?: string
  }>
  legacyCandidates: string[]
  statusPromotion: boolean
  reason?: string
}

interface NormalizationReport {
  generatedAt: string
  mode: 'DRY_RUN' | 'APPLY'
  xlsx: Omit<WorkbookAudit, 'rows' | 'unmappedImages'> & {
    validFindings: number
    unmappedImages: Array<Omit<WorkbookAudit['unmappedImages'][number], 'buffer'>>
  }
  database: Record<string, unknown>
  sessions: SessionPlan[]
  temporalMappings: Array<{
    worksheet: string
    originDate: string
    originPeriod: string
    testSession: { action: SessionPlan['action']; id?: string; name: string; date: string }
    findings: number
    sourceRows: { min: number; max: number }
    perRowDateMetadataFound: boolean
  }>
  temporalValidation: {
    schemaSupportsSingleDateOnly: boolean
    rangePolicy: string
    crossMonthAssociationsDetected: number
    crossMonthAssociationsAfterPlan: number
  }
  imageMetrics: {
    xlsxMediaUnique: number
    xlsxDrawingAnchors: number
    xlsxImageFindingAssociations: number
    findingsWithImages: number
    findingsWithoutImages: number
  }
  correctedImageAssociations: Array<{
    worksheet: string
    mediaFilename: string
    mediaSha256: string
    anchorRowOriginal: number
    targetSourceRow: number
    findingId: string | null
    action: 'CREATE' | 'SKIP_DUPLICATE' | 'CONFLICT'
  }>
  evidenceActions: {
    evidenceAlreadyConfirmed: number
    evidenceAlreadyLegacy: number
    evidenceCreate: number
    evidenceSkipExactDuplicate: number
    evidenceReuse: number
    evidencePending: number
    evidenceUnmapped: number
    evidenceConflict: number
    accountedAssociations: number
  }
  search: {
    elasticsearchEnabled: boolean
    elasticsearchConfigured: boolean
    elasticsearchOptional: boolean
    postgresFallbackVerified: boolean
    source: string
    blocking: boolean
  }
  findings: FindingPlan[]
  summary: Record<string, number>
  risks: string[]
  applied?: Record<string, number>
  backup?: Record<string, string>
}

function parseArgs(argv: string[]): CliOptions {
  const value = (name: string) => argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1)
  const file = value('--file')
  if (!file) throw new Error('Uso: --file="/ruta/archivo.xlsx" [--apply] [--report="/ruta/report.json"] [--only-sheet="Hoja"]')
  const date = new Date().toISOString().slice(0, 10)
  return {
    file: path.resolve(file),
    apply: argv.includes('--apply'),
    report: path.resolve(value('--report') ?? `artifacts/xlsx-normalization-report-${date}.json`),
    onlySheet: value('--only-sheet'),
  }
}

function withoutBuffers<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (key, item) => key === 'buffer' ? undefined : item)) as T
}

function statusRank(status: string): number {
  return ({ OPEN: 0, TRIAGED: 1, IN_PROGRESS: 2, BLOCKED: 2, REOPENED: 2, READY_FOR_VALIDATION: 3, VALIDATED: 4, CLOSED: 5 } as Record<string, number>)[status] ?? 0
}

function commentWithoutBareUrl(comment: string | undefined): string | undefined {
  if (!comment) return undefined
  return /^https?:\/\/\S+$/i.test(comment.trim()) ? undefined : comment.trim()
}

async function buildPlan(options: CliOptions): Promise<{ report: NormalizationReport; audit: WorkbookAudit; plans: FindingPlan[] }> {
  const prisma = getDb()
  const audit = await auditWorkbook(options.file)
  if (options.onlySheet && !audit.worksheets.some((sheet) => sheet.name === options.onlySheet)) {
    throw new Error(`La hoja solicitada no existe: ${options.onlySheet}`)
  }
  const selectedRows = options.onlySheet ? audit.rows.filter((row) => row.worksheet === options.onlySheet) : audit.rows
  const selectedWorksheets = [...new Set(selectedRows.map((row) => row.worksheet))]

  const projects = await prisma.project.findMany({ where: { deletedAt: null }, include: { versions: true } })
  const projectCandidates = projects.filter((project) => normalizeText(project.name) === normalizeText('Pruebas María 2.0'))
  if (projectCandidates.length !== 1) throw new Error(`Project mapping ambiguo: ${projectCandidates.length} candidatos`)
  const project = projectCandidates[0]
  const versionCandidates = project.versions.filter((version) => version.version === '1.0')
  if (versionCandidates.length !== 1) throw new Error(`ProductVersion mapping ambiguo: ${versionCandidates.length} candidatos para 1.0`)
  const version = versionCandidates[0]
  const users = await prisma.user.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } })
  const ownerCandidates = users.filter((user) => user.role === 'OWNER')
  if (ownerCandidates.length !== 1) throw new Error(`Usuario importador ambiguo: ${ownerCandidates.length} OWNER activos`)
  const importer = ownerCandidates[0]
  const existingSessions = await prisma.testSession.findMany({ where: { projectId: project.id } })
  const existingFindings = await prisma.finding.findMany({
    where: { projectId: project.id, deletedAt: null },
    include: { evidence: true, supportLinks: true, comments: true, incidenceTypes: true, experienceTags: true },
  })
  const importBatches = await prisma.importBatch.findMany({ where: { projectId: project.id } })
  const activePendingEvidence = await prisma.evidence.count({ where: { url: null, deletedAt: null } })
  const sessions: SessionPlan[] = selectedWorksheets.map((worksheet) => {
    const definition = sessionDefinition(worksheet)
    if (!definition) return { worksheet, name: worksheet, date: '', originStartDate: '', originEndDate: '', originPeriod: '', isRange: false, action: 'CONFLICT', reason: 'No se pudo derivar una fecha inequívoca' }
    const matches = existingSessions.filter((session) =>
      normalizeText(session.name) === normalizeText(definition.name)
      && session.date.toISOString().slice(0, 10) === definition.date
      && session.versionId === version.id,
    )
    if (matches.length === 1) return { worksheet, ...definition, action: 'REUSE', id: matches[0].id }
    if (matches.length > 1) return { worksheet, ...definition, action: 'CONFLICT', reason: `${matches.length} TestSessions equivalentes` }
    return { worksheet, ...definition, action: 'CREATE', id: `proposed:${worksheet}` }
  })

  const plans: FindingPlan[] = selectedRows.map((row) => {
    const session = sessions.find((candidate) => candidate.worksheet === row.worksheet)!
    if (session.action === 'CONFLICT' || !session.id) {
      return { row, fingerprint: '', session, action: 'CONFLICT', changes: {}, supportLinks: row.urls, evidence: [], legacyCandidates: [], statusPromotion: false, reason: session.reason }
    }
    const fingerprint = fingerprintForRow(project.id, session.id, row)
    const identity = reconcileIdentity({ projectId: project.id, sessionId: session.id, row, fingerprint, findings: existingFindings })
    if (identity.kind === 'AMBIGUOUS') {
      return { row, fingerprint, session, action: 'CONFLICT', changes: {}, supportLinks: row.urls, evidence: [], legacyCandidates: [], statusPromotion: false, strategy: identity.strategy, reason: `Identidad ambigua: ${identity.candidates?.join(', ')}` }
    }
    const existing = identity.finding ? existingFindings.find((finding) => finding.id === identity.finding!.id)! : undefined
    const changes: Record<string, unknown> = {}
    if (existing) {
      if (existing.observation !== row.observation) changes.observation = row.observation
      if (existing.previousScreen !== (row.previousScreen ?? null)) changes.previousScreen = row.previousScreen ?? null
      if (existing.sourceSheet !== row.worksheet) changes.sourceSheet = row.worksheet
      if (existing.sourceRow !== row.sourceRow) changes.sourceRow = row.sourceRow
      if (existing.sourceFingerprint !== fingerprint) changes.sourceFingerprint = fingerprint
      if (existing.testSessionId !== session.id) changes.testSessionId = session.id
    }
    const links = row.urls.filter((url) => !existing?.supportLinks.some((link) => link.url === url))
    const comment = commentWithoutBareUrl(row.comment)
    const newComment = comment && !existing?.comments.some((item) => normalizeText(item.text) === normalizeText(comment)) ? comment : undefined
    const currentTypes = new Set(existing?.incidenceTypes.map((item) => item.incidenceType) ?? [])
    const currentTags = new Set(existing?.experienceTags.map((item) => item.experienceTag) ?? [])
    const missingTypes = row.incidenceTypes.filter((item) => !currentTypes.has(item))
    const missingTags = row.experienceTags.filter((item) => !currentTags.has(item))
    if (missingTypes.length) changes.incidenceTypes = missingTypes
    if (missingTags.length) changes.experienceTags = missingTags
    const evidence = row.images.map((image, imageIndex) => {
      const extension = path.extname(image.internalFilename).slice(1)
      const originalFilename = deterministicEvidenceFilename(row.worksheet, row.sourceRow, image.sha256, extension)
      const marker = evidenceMarker(row.worksheet, row.sourceRow, image.sha256)
      const duplicate = existing?.evidence.find((item) => !item.deletedAt && (item.originalFilename === originalFilename || item.caption?.includes(marker)))
      return { action: duplicate ? 'SKIP_DUPLICATE' as const : 'CREATE' as const, imageIndex, originalFilename, marker, duplicateEvidenceId: duplicate?.id, duplicateEvidenceUrl: duplicate?.url, duplicateStorageKey: duplicate?.storageKey }
    })
    const legacyCandidates = existing?.evidence.filter((item) =>
      !item.deletedAt && item.storageKey.startsWith('legacy/')
      && evidence.some((candidate) => item.originalFilename === candidate.originalFilename || item.caption?.includes(candidate.marker)),
    ).map((item) => item.id) ?? []
    const statusPromotion = existing ? shouldPromoteToValidated(existing.status, row.completed) : row.completed
    if (existing && row.completed && statusRank(existing.status) > statusRank('VALIDATED')) changes.statusConflict = `Preservar ${existing.status}`
    const hasSideEffects = Object.keys(changes).length > 0 || links.length > 0 || Boolean(newComment) || evidence.some((item) => item.action === 'CREATE') || statusPromotion
    return {
      row,
      fingerprint,
      session,
      action: existing ? (hasSideEffects ? 'UPDATE' : 'NOOP') : 'CREATE',
      findingId: existing?.id,
      strategy: identity.strategy,
      changes,
      supportLinks: links,
      comment: newComment,
      evidence,
      legacyCandidates,
      statusPromotion,
    }
  })

  const risks: string[] = []
  const conflicts = plans.filter((plan) => plan.action === 'CONFLICT')
  if (conflicts.length) risks.push(`${conflicts.length} mappings ambiguos o sesiones no resolubles; APPLY abortará`)
  if (audit.unmappedImages.length) risks.push(`${audit.unmappedImages.length} imágenes no se pudieron asociar a un Finding; APPLY abortará`)
  if (existingFindings.some((finding) => finding.evidence.some((evidence) => !evidence.deletedAt && !evidence.url && !evidence.storageKey.startsWith('legacy/')))) risks.push('Existe Evidence runtime PENDING en la BD antes de la importación')
  const elasticsearchEnabled = process.env.ELASTICSEARCH_ENABLED === 'true' && Boolean(process.env.ELASTICSEARCH_URL)
  const searchProbe = await SearchService.search({ q: '', page: 1, pageSize: 1 })
  const postgresFallbackVerified = !elasticsearchEnabled && searchProbe.source === 'postgresql'
  const summary = {
    findingsXlsx: plans.length,
    matchedExisting: plans.filter((plan) => Boolean(plan.findingId)).length,
    create: plans.filter((plan) => plan.action === 'CREATE').length,
    update: plans.filter((plan) => plan.action === 'UPDATE').length,
    noop: plans.filter((plan) => plan.action === 'NOOP').length,
    conflicts: conflicts.length,
    evidenceMappings: plans.reduce((sum, plan) => sum + plan.evidence.length, 0),
    evidenceCreate: plans.reduce((sum, plan) => sum + plan.evidence.filter((item) => item.action === 'CREATE').length, 0),
    evidenceDuplicate: plans.reduce((sum, plan) => sum + plan.evidence.filter((item) => item.action === 'SKIP_DUPLICATE').length, 0),
    legacyReplacements: plans.reduce((sum, plan) => sum + plan.legacyCandidates.length, 0),
    statusPromotions: plans.filter((plan) => plan.statusPromotion).length,
    supportLinksCreate: plans.reduce((sum, plan) => sum + plan.supportLinks.length, 0),
    commentsCreate: plans.filter((plan) => plan.comment).length,
    sessionsCreate: sessions.filter((session) => session.action === 'CREATE').length,
    sessionsReuse: sessions.filter((session) => session.action === 'REUSE').length,
  }
  const monthOf = (date: Date | string) => (date instanceof Date ? date.toISOString() : date).slice(0, 7)
  const existingSessionById = new Map(existingSessions.map((session) => [session.id, session]))
  const crossMonthAssociationsDetected = existingFindings.filter((finding) => {
    if (!finding.sourceSheet || !finding.testSessionId) return false
    const expected = sessionDefinition(finding.sourceSheet)
    const actual = existingSessionById.get(finding.testSessionId)
    return Boolean(expected && actual && monthOf(expected.originStartDate) !== monthOf(actual.date))
  }).length
  const temporalMappings = sessions.map((session) => {
    const sessionRows = selectedRows.filter((row) => row.worksheet === session.worksheet)
    const sourceRows = sessionRows.map((row) => row.sourceRow)
    const worksheetAudit = audit.worksheets.find((worksheet) => worksheet.name === session.worksheet)
    return {
      worksheet: session.worksheet,
      originDate: session.originStartDate,
      originPeriod: session.originPeriod,
      testSession: { action: session.action, id: session.action === 'REUSE' ? session.id : undefined, name: session.name, date: session.date },
      findings: sessionRows.length,
      sourceRows: { min: Math.min(...sourceRows), max: Math.max(...sourceRows) },
      perRowDateMetadataFound: Boolean(worksheetAudit?.dateMetadata.perRowDateCells),
    }
  })
  const findingsWithImages = selectedRows.filter((row) => row.images.length > 0).length
  const evidenceAlreadyConfirmed = plans.reduce((sum, plan) => sum + plan.evidence.filter((item) => item.action === 'SKIP_DUPLICATE' && Boolean(item.duplicateEvidenceUrl) && !item.duplicateStorageKey?.startsWith('legacy/')).length, 0)
  const evidenceAlreadyLegacy = plans.reduce((sum, plan) => sum + plan.evidence.filter((item) => item.action === 'SKIP_DUPLICATE' && item.duplicateStorageKey?.startsWith('legacy/')).length, 0)
  const evidenceCreate = plans.reduce((sum, plan) => sum + plan.evidence.filter((item) => item.action === 'CREATE').length, 0)
  const evidenceSkipExactDuplicate = plans.reduce((sum, plan) => sum + plan.evidence.filter((item) => item.action === 'SKIP_DUPLICATE').length, 0)
  const evidenceUnmapped = audit.unmappedImages.length
  const evidenceConflict = plans.filter((plan) => plan.action === 'CONFLICT').reduce((sum, plan) => sum + plan.row.images.length, 0)
  const correctedImageAssociations = audit.imageCorrections.map((correction) => {
    const plan = plans.find((candidate) => candidate.row.worksheet === correction.worksheet && candidate.row.sourceRow === correction.targetSourceRow)
    const imageIndex = plan?.row.images.findIndex((image) => image.sha256 === correction.sha256 && image.row === correction.anchorRowOriginal) ?? -1
    const evidence = imageIndex >= 0 ? plan?.evidence.find((candidate) => candidate.imageIndex === imageIndex) : undefined
    return {
      worksheet: correction.worksheet,
      mediaFilename: correction.internalFilename,
      mediaSha256: correction.sha256,
      anchorRowOriginal: correction.anchorRowOriginal,
      targetSourceRow: correction.targetSourceRow,
      findingId: plan?.findingId ?? null,
      action: plan?.action === 'CONFLICT' ? 'CONFLICT' as const : evidence?.action ?? 'CONFLICT' as const,
    }
  })
  const report: NormalizationReport = {
    generatedAt: new Date().toISOString(),
    mode: options.apply ? 'APPLY' : 'DRY_RUN',
    xlsx: {
      file: audit.file,
      worksheets: audit.worksheets,
      invalidRows: audit.invalidRows,
      physicalMediaFiles: audit.physicalMediaFiles,
      imagePlacements: audit.imagePlacements,
      validFindings: selectedRows.length,
      unmappedImages: withoutBuffers(audit.unmappedImages),
    },
    database: {
      project: { id: project.id, name: project.name },
      productVersion: { id: version.id, version: version.version },
      importer: { id: importer.id, role: importer.role },
      projects: projects.length,
      productVersions: project.versions.length,
      testSessions: existingSessions.length,
      activeFindings: existingFindings.length,
      activeEvidence: existingFindings.reduce((sum, finding) => sum + finding.evidence.filter((item) => !item.deletedAt).length, 0),
      importBatches: importBatches.length,
    },
    sessions,
    temporalMappings,
    temporalValidation: {
      schemaSupportsSingleDateOnly: true,
      rangePolicy: 'TestSession.date = first day; TestSession.name preserves the exact worksheet range. No per-row date exists in this workbook.',
      crossMonthAssociationsDetected,
      crossMonthAssociationsAfterPlan: 0,
    },
    imageMetrics: {
      xlsxMediaUnique: audit.physicalMediaFiles,
      xlsxDrawingAnchors: audit.imagePlacements,
      xlsxImageFindingAssociations: audit.imagePlacements - audit.unmappedImages.length,
      findingsWithImages,
      findingsWithoutImages: selectedRows.length - findingsWithImages,
    },
    correctedImageAssociations,
    evidenceActions: {
      evidenceAlreadyConfirmed,
      evidenceAlreadyLegacy,
      evidenceCreate,
      evidenceSkipExactDuplicate,
      evidenceReuse: 0,
      evidencePending: activePendingEvidence,
      evidenceUnmapped,
      evidenceConflict,
      accountedAssociations: evidenceCreate + evidenceSkipExactDuplicate + evidenceUnmapped + evidenceConflict,
    },
    search: {
      elasticsearchEnabled,
      elasticsearchConfigured: Boolean(process.env.ELASTICSEARCH_URL),
      elasticsearchOptional: true,
      postgresFallbackVerified,
      source: searchProbe.source ?? 'unknown',
      blocking: elasticsearchEnabled ? false : !postgresFallbackVerified,
    },
    findings: withoutBuffers(plans),
    summary,
    risks,
  }
  return { report, audit, plans }
}

function writeReport(reportPath: string, report: NormalizationReport): void {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
}

function runOrThrow(command: string, args: string[], options: { env?: NodeJS.ProcessEnv } = {}): void {
  const result = spawnSync(command, args, { stdio: 'inherit', env: options.env ?? process.env })
  if (result.status !== 0) throw new Error(`${command} falló con código ${result.status ?? 'desconocido'}`)
}

function backupBeforeApply(options: CliOptions, report: NormalizationReport): Record<string, string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.resolve('backups', `xlsx-normalization-${stamp}`)
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 })
  const databaseUrl = process.env.DATABASE_URL
  const storageDir = process.env.EVIDENCE_STORAGE_DIR
  if (!databaseUrl || !storageDir) throw new Error('DATABASE_URL o EVIDENCE_STORAGE_DIR ausente')
  const pgDump = path.join(backupDir, 'postgres.dump')
  runOrThrow('pg_dump', ['--format=custom', '--file', pgDump, databaseUrl.replace(/\?.*$/, '')])
  const storageArchive = path.join(backupDir, 'evidence-storage.tar.gz')
  runOrThrow('tar', ['-C', path.dirname(storageDir), '-czf', storageArchive, path.basename(storageDir)])
  const dryRunReport = path.join(backupDir, 'dry-run-report.json')
  fs.copyFileSync(options.report, dryRunReport)
  const manifest = path.join(backupDir, 'manifest.json')
  fs.writeFileSync(manifest, `${JSON.stringify({ createdAt: new Date().toISOString(), xlsx: report.xlsx.file, counts: report.database, files: { pgDump, storageArchive, dryRunReport } }, null, 2)}\n`, { mode: 0o600 })
  return { backupDir, pgDump, storageArchive, dryRunReport, manifest }
}

async function applyPlan(options: CliOptions, report: NormalizationReport, audit: WorkbookAudit, plans: FindingPlan[]): Promise<Record<string, number>> {
  if (report.summary.conflicts > 0) throw new Error('APPLY abortado: existen conflictos de identidad')
  if (report.evidenceActions.evidenceUnmapped > 0 || report.evidenceActions.evidenceConflict > 0) throw new Error('APPLY abortado: existen imágenes sin contabilizar')
  if (report.evidenceActions.evidencePending > 0) throw new Error('APPLY abortado: existe Evidence runtime PENDING activa')
  if (report.search.blocking) throw new Error('APPLY abortado: ni Elasticsearch ni el fallback PostgreSQL están sanos')
  await PrivateFileStore.preflight()
  writeReport(options.report, { ...report, mode: 'DRY_RUN' })
  report.backup = backupBeforeApply(options, report)
  const prisma = getDb()
  const projectId = String((report.database.project as { id: string }).id)
  const versionId = String((report.database.productVersion as { id: string }).id)
  const importerId = String((report.database.importer as { id: string }).id)
  const sessionIds = new Map<string, string>()

  for (const session of report.sessions) {
    if (session.action === 'REUSE' && session.id) sessionIds.set(session.worksheet, session.id)
    if (session.action === 'CREATE') {
      const created = await prisma.testSession.create({ data: { projectId, versionId, name: session.name, date: new Date(`${session.date}T00:00:00.000Z`), environment: 'prod', createdBy: importerId } })
      session.id = created.id
      sessionIds.set(session.worksheet, created.id)
    }
  }

  const batches = new Map<string, string>()
  for (const worksheet of [...new Set(plans.map((plan) => plan.row.worksheet))]) {
    const sheetPlans = plans.filter((plan) => plan.row.worksheet === worksheet)
    const batch = await prisma.importBatch.create({ data: {
      projectId,
      testSessionId: sessionIds.get(worksheet)!,
      originalFilename: audit.file.filename,
      fileSize: audit.file.fileSize,
      totalRows: audit.worksheets.find((sheet) => sheet.name === worksheet)?.totalRows ?? sheetPlans.length,
      validRows: sheetPlans.length,
      skippedRows: audit.worksheets.find((sheet) => sheet.name === worksheet)?.emptyRows ?? 0,
      status: 'PROCESSING',
      importedBy: importerId,
    } })
    batches.set(worksheet, batch.id)
  }

  const affected = new Set<string>()
  let createdFindings = 0
  let updatedFindings = 0
  let evidenceCreated = 0
  let evidenceSkipped = 0
  let legacySoftDeleted = 0

  for (const plan of plans) {
    const sessionId = sessionIds.get(plan.row.worksheet)!
    const fingerprint = fingerprintForRow(projectId, sessionId, plan.row)
    let findingId = plan.findingId
    if (plan.action === 'CREATE') {
      const created = await prisma.$transaction(async (tx) => {
        const finding = await tx.finding.create({ data: {
          projectId,
          testSessionId: sessionId,
          observation: plan.row.observation,
          previousScreen: plan.row.previousScreen,
          sourceSheet: plan.row.worksheet,
          sourceRow: plan.row.sourceRow,
          sourceFingerprint: fingerprint,
          importBatchId: batches.get(plan.row.worksheet),
          createdBy: importerId,
          updatedBy: importerId,
          status: plan.row.completed ? 'VALIDATED' : 'OPEN',
          incidenceTypes: { create: plan.row.incidenceTypes.map((incidenceType) => ({ incidenceType })) },
          experienceTags: { create: plan.row.experienceTags.map((experienceTag) => ({ experienceTag })) },
          supportLinks: { create: plan.supportLinks.map((url) => ({ url, title: /figma\.com/i.test(url) ? 'Figma' : 'Enlace de soporte', createdBy: importerId })) },
          comments: plan.comment ? { create: { text: plan.comment, createdBy: importerId } } : undefined,
        } })
        if (plan.row.completed) await tx.findingStatusHistory.create({ data: { findingId: finding.id, fromStatus: 'OPEN', toStatus: 'VALIDATED', reason: `Marca de completado en ${plan.row.worksheet} fila ${plan.row.sourceRow}`, changedBy: importerId } })
        await tx.auditLog.create({ data: { entityType: 'Finding', entityId: finding.id, action: 'IMPORT', actorId: importerId, after: { source: 'XLSX_NORMALIZATION', sourceSheet: plan.row.worksheet, sourceRow: plan.row.sourceRow, sourceFingerprint: fingerprint, xlsxSha256: audit.file.sha256 } } })
        return finding
      })
      findingId = created.id
      createdFindings++
    } else if (plan.action === 'UPDATE' && findingId) {
      await prisma.$transaction(async (tx) => {
        const before = await tx.finding.findUniqueOrThrow({ where: { id: findingId } })
        const updateData = {
          observation: plan.row.observation,
          previousScreen: plan.row.previousScreen ?? null,
          sourceSheet: plan.row.worksheet,
          sourceRow: plan.row.sourceRow,
          sourceFingerprint: fingerprint,
          testSessionId: sessionId,
          updatedBy: importerId,
          ...(plan.statusPromotion ? { status: 'VALIDATED' as const } : {}),
        }
        await tx.finding.update({ where: { id: findingId }, data: updateData })
        for (const incidenceType of (plan.changes.incidenceTypes as string[] | undefined) ?? []) await tx.findingIncidenceType.create({ data: { findingId: findingId!, incidenceType: incidenceType as never } })
        for (const experienceTag of (plan.changes.experienceTags as string[] | undefined) ?? []) await tx.findingExperienceTag.create({ data: { findingId: findingId!, experienceTag: experienceTag as never } })
        for (const url of plan.supportLinks) await tx.supportLink.create({ data: { findingId: findingId!, url, title: /figma\.com/i.test(url) ? 'Figma' : 'Enlace de soporte', createdBy: importerId } })
        if (plan.comment) await tx.comment.create({ data: { findingId: findingId!, text: plan.comment, createdBy: importerId } })
        if (plan.statusPromotion) await tx.findingStatusHistory.create({ data: { findingId: findingId!, fromStatus: before.status, toStatus: 'VALIDATED', reason: `Marca de completado en ${plan.row.worksheet} fila ${plan.row.sourceRow}`, changedBy: importerId } })
        await tx.auditLog.create({ data: { entityType: 'Finding', entityId: findingId!, action: 'UPDATE', actorId: importerId, before: { observation: before.observation, status: before.status, sourceSheet: before.sourceSheet, sourceRow: before.sourceRow }, after: { ...updateData, source: 'XLSX_NORMALIZATION', xlsxSha256: audit.file.sha256 } } })
      })
      updatedFindings++
    }
    if (!findingId) continue
    affected.add(findingId)
    const confirmedNewEvidence: string[] = []
    for (const evidencePlan of plan.evidence) {
      if (evidencePlan.action === 'SKIP_DUPLICATE') { evidenceSkipped++; continue }
      const image = plan.row.images[evidencePlan.imageIndex]
      const uploaded = await StorageService.uploadFile({ buffer: image.buffer, mimeType: image.mimeType, originalFilename: evidencePlan.originalFilename, findingId, caption: evidencePlan.marker, uploadedBy: importerId })
      if (!uploaded.url || !(await StorageService.objectExists((await prisma.evidence.findUniqueOrThrow({ where: { id: uploaded.id }, select: { storageKey: true } })).storageKey))) throw new Error(`Evidence ${uploaded.id} no quedó confirmada`)
      confirmedNewEvidence.push(uploaded.id)
      evidenceCreated++
    }
    if (confirmedNewEvidence.length > 0) {
      for (const legacyId of plan.legacyCandidates) { await StorageService.deleteEvidence(legacyId, importerId); legacySoftDeleted++ }
    }
  }

  for (const batchId of batches.values()) await prisma.importBatch.update({ where: { id: batchId }, data: { status: 'COMPLETED' } })
  const documents = await prisma.finding.findMany({ where: { id: { in: [...affected] }, deletedAt: null }, include: { evidence: { where: { deletedAt: null } } } })
  await SearchService.bulkIndexFindings(documents.map((finding): FindingDocument => ({ id: finding.id, observation: finding.observation, evidenceDescriptions: finding.evidence.map((item) => [item.caption, item.originalFilename].filter(Boolean).join(' ')).join(' '), status: finding.status, priority: finding.priority, severity: finding.severity, assigneeId: finding.assigneeId ?? undefined, projectId: finding.projectId, evidenceCount: finding.evidence.length, createdAt: finding.createdAt, updatedAt: finding.updatedAt })))
  return { createdFindings, updatedFindings, evidenceCreated, evidenceSkipped, legacySoftDeleted, indexedFindings: affected.size }
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  let options: CliOptions | undefined
  try {
    options = parseArgs(argv)
    const { report, audit, plans } = await buildPlan(options)
    writeReport(options.report, report)
    if (options.apply) {
      report.applied = await applyPlan(options, report, audit, plans)
      writeReport(options.report, report)
    }
    console.log(JSON.stringify({ mode: report.mode, report: options.report, summary: report.summary, risks: report.risks, applied: report.applied }, null, 2))
    return 0
  } catch (error) {
    console.error(`XLSX normalization failed: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  } finally {
    await getDb().$disconnect()
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined
if (invokedPath === import.meta.url) void main().then((code) => { process.exitCode = code })
