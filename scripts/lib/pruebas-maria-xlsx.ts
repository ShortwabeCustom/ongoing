import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import ExcelJS from 'exceljs'
import { generateFingerprint, stableHash } from '@/lib/utils/fingerprint'

export type IncidenceType = 'DESIGN' | 'FUNCTIONALITY' | 'BUSINESS_RULE' | 'COPY'
export type ExperienceTag = 'UI' | 'UX' | 'COPY' | 'DEV'

export interface XlsxImage {
  worksheet: string
  drawing: string
  anchorType: 'oneCellAnchor' | 'twoCellAnchor'
  relationshipId: string
  internalFilename: string
  mimeType: string
  bytes: number
  sha256: string
  row: number
  column: number
  toRow?: number
  toColumn?: number
  width?: number
  height?: number
  buffer: Buffer
}

export interface NormalizedXlsxRow {
  worksheet: string
  sourceRow: number
  completed: boolean
  observation: string
  previousScreen?: string
  modification?: string
  comment?: string
  incidenceTypes: IncidenceType[]
  experienceTags: ExperienceTag[]
  urls: string[]
  figmaUrls: string[]
  images: XlsxImage[]
}

export interface WorksheetAudit {
  name: string
  totalRows: number
  validRows: number
  emptyRows: number
  completedRows: number
  imagePlacements: number
  imagesOnEmptyRows: number
  urls: number
  figmaUrls: number
  headers: string[]
}

export interface WorkbookAudit {
  file: { path: string; filename: string; sha256: string; fileSize: number; modifiedAt: string }
  worksheets: WorksheetAudit[]
  rows: NormalizedXlsxRow[]
  invalidRows: Array<{ worksheet: string; sourceRow: number; reason: string }>
  unmappedImages: XlsxImage[]
  physicalMediaFiles: number
  imagePlacements: number
}

const URL_RE = /https?:\/\/[^\s)\]}>,]+/gi

export function normalizeText(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-MX')
}

export function extractUrls(...values: Array<string | undefined>): string[] {
  const urls = values.flatMap((value) => value?.match(URL_RE) ?? []).map((url) => url.replace(/[.;]+$/, ''))
  return [...new Set(urls)]
}

export function parseCompleted(value: unknown): boolean {
  if (value === true || value === 1) return true
  return /^(true|sí|si|x|✓|✔|completad[oa])$/i.test(String(value ?? '').trim())
}

export function parseIncidenceTypes(value: string): IncidenceType[] {
  const text = normalizeText(value)
  const values = new Set<IncidenceType>()
  if (/diseñ|design/.test(text)) values.add('DESIGN')
  if (/funcional|dev|desarrollo|backend|front/.test(text)) values.add('FUNCTIONALITY')
  if (/negocio|regla/.test(text)) values.add('BUSINESS_RULE')
  if (/copy|texto|redacci/.test(text)) values.add('COPY')
  return [...values]
}

export function experienceTagsFor(types: IncidenceType[]): ExperienceTag[] {
  const tags = new Set<ExperienceTag>()
  if (types.includes('DESIGN')) tags.add('UI')
  if (types.includes('FUNCTIONALITY')) tags.add('DEV')
  if (types.includes('BUSINESS_RULE')) tags.add('UX')
  if (types.includes('COPY')) tags.add('COPY')
  return [...tags]
}

export function sessionDefinition(sheet: string, year = 2026): { name: string; date: string } | null {
  const normalized = normalizeText(sheet)
  const month = normalized.includes('jul') ? 7 : normalized.includes('agosto') ? 8 : null
  const dayMatch = normalized.match(/(?:pruebas|mod(?:ificación)?)\s+(\d{1,2})/)
  if (!month || !dayMatch) return null
  const day = Number(dayMatch[1])
  if (day < 1 || day > 31) return null
  const name = /^mod\s/i.test(sheet.trim()) ? sheet.trim().replace(/^mod\s/i, 'Modificación ') : sheet.trim()
  return { name, date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
}

export function deterministicEvidenceFilename(sheet: string, row: number, hash: string, extension: string): string {
  const slug = sheet.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `xlsx-${slug}-row-${row}-${hash.slice(0, 12)}.${extension.toLowerCase()}`
}

export function evidenceMarker(sheet: string, row: number, hash: string): string {
  return `xlsx-normalization:${stableHash([sheet, row, hash]).slice(0, 24)}:${hash}`
}

export function fingerprintForRow(projectId: string, testSessionId: string, row: NormalizedXlsxRow): string {
  return generateFingerprint(projectId, row.sourceRow, row.observation, {
    testSessionId,
    sourceSheet: row.worksheet,
  })
}

function xmlAttr(xml: string, tag: string, attr: string): string | undefined {
  return xml.match(new RegExp(`<${tag}[^>]*\\b${attr}="([^"]+)"`, 'i'))?.[1]
}

function relationshipMap(xml: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi)) {
    const id = match[1].match(/\bId="([^"]+)"/i)?.[1]
    const target = match[1].match(/\bTarget="([^"]+)"/i)?.[1]
    if (id && target) result.set(id, target)
  }
  return result
}

function zipText(zip: AdmZip, name: string): string | undefined {
  const entry = zip.getEntry(name)
  return entry?.getData().toString('utf8')
}

function resolveZipTarget(base: string, target: string): string {
  if (target.startsWith('/')) return target.replace(/^\/+/, '')
  return path.posix.normalize(path.posix.join(path.posix.dirname(base), target)).replace(/^\//, '')
}

function mimeFromBytes(buffer: Buffer, extension: string): string {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  if (extension.toLowerCase() === 'gif') return 'image/gif'
  return 'application/octet-stream'
}

function parseAnchorNumber(xml: string, section: 'from' | 'to', field: 'row' | 'col'): number | undefined {
  const block = xml.match(new RegExp(`<xdr:${section}>[\\s\\S]*?<\\/xdr:${section}>`, 'i'))?.[0]
  const raw = block?.match(new RegExp(`<xdr:${field}>(\\d+)<\\/xdr:${field}>`, 'i'))?.[1]
  return raw === undefined ? undefined : Number(raw) + 1
}

export function extractImages(zip: AdmZip): XlsxImage[] {
  const workbookXml = zipText(zip, 'xl/workbook.xml') ?? ''
  const workbookRels = relationshipMap(zipText(zip, 'xl/_rels/workbook.xml.rels') ?? '')
  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)].map((match) => ({
    name: match[1].match(/\bname="([^"]+)"/i)?.[1],
    relationshipId: match[1].match(/\br:id="([^"]+)"/i)?.[1],
  })).filter((sheet): sheet is { name: string; relationshipId: string } => Boolean(sheet.name && sheet.relationshipId))
  const images: XlsxImage[] = []

  for (const sheet of sheets) {
    const worksheet = sheet.name
    const sheetTarget = workbookRels.get(sheet.relationshipId)
    if (!sheetTarget) continue
    const sheetPath = resolveZipTarget('xl/workbook.xml', sheetTarget)
    const sheetRelsPath = `${path.posix.dirname(sheetPath)}/_rels/${path.posix.basename(sheetPath)}.rels`
    const sheetRels = relationshipMap(zipText(zip, sheetRelsPath) ?? '')
    const sheetXml = zipText(zip, sheetPath) ?? ''
    const drawingRid = xmlAttr(sheetXml, 'drawing', 'r:id')
    const drawingTarget = drawingRid ? sheetRels.get(drawingRid) : undefined
    if (!drawingTarget) continue
    const drawingPath = resolveZipTarget(sheetPath, drawingTarget)
    const drawingXml = zipText(zip, drawingPath) ?? ''
    const drawingRelsPath = `${path.posix.dirname(drawingPath)}/_rels/${path.posix.basename(drawingPath)}.rels`
    const drawingRels = relationshipMap(zipText(zip, drawingRelsPath) ?? '')

    for (const anchor of drawingXml.matchAll(/<xdr:(oneCellAnchor|twoCellAnchor)\b[^>]*>([\s\S]*?)<\/xdr:\1>/gi)) {
      const anchorXml = anchor[2]
      const relationshipId = anchorXml.match(/<a:blip\b[^>]*\br:embed="([^"]+)"/i)?.[1]
      const mediaTarget = relationshipId ? drawingRels.get(relationshipId) : undefined
      const row = parseAnchorNumber(anchorXml, 'from', 'row')
      const column = parseAnchorNumber(anchorXml, 'from', 'col')
      if (!relationshipId || !mediaTarget || row === undefined || column === undefined) continue
      const mediaPath = resolveZipTarget(drawingPath, mediaTarget)
      const media = zip.getEntry(mediaPath)?.getData()
      if (!media) continue
      const extension = path.extname(mediaPath).slice(1)
      const extent = anchorXml.match(/<xdr:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/i)
      images.push({
        worksheet,
        drawing: drawingPath,
        anchorType: anchor[1] as XlsxImage['anchorType'],
        relationshipId,
        internalFilename: mediaPath,
        mimeType: mimeFromBytes(media, extension),
        bytes: media.length,
        sha256: crypto.createHash('sha256').update(media).digest('hex'),
        row,
        column,
        toRow: parseAnchorNumber(anchorXml, 'to', 'row'),
        toColumn: parseAnchorNumber(anchorXml, 'to', 'col'),
        width: extent ? Number(extent[1]) : undefined,
        height: extent ? Number(extent[2]) : undefined,
        buffer: media,
      })
    }
  }
  return images
}

function cellText(row: ExcelJS.Row, column: number | undefined): string {
  return column ? row.getCell(column).text.trim() : ''
}

function headerColumns(sheet: ExcelJS.Worksheet): Map<string, number> {
  const result = new Map<string, number>()
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
    const header = normalizeText(cell.text)
    if (header) result.set(header, column)
  })
  return result
}

function findColumn(headers: Map<string, number>, names: string[]): number | undefined {
  for (const name of names) {
    const exact = headers.get(normalizeText(name))
    if (exact) return exact
  }
  return undefined
}

export async function auditWorkbook(filePath: string): Promise<WorkbookAudit> {
  const absolute = path.resolve(filePath)
  const stat = fs.statSync(absolute)
  const fileBuffer = fs.readFileSync(absolute)
  const zip = new AdmZip(fileBuffer)
  const images = extractImages(zip)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer)
  const rows: NormalizedXlsxRow[] = []
  const invalidRows: WorkbookAudit['invalidRows'] = []
  const worksheets: WorksheetAudit[] = []
  const mappedImages = new Set<XlsxImage>()

  for (const sheet of workbook.worksheets) {
    const headers = headerColumns(sheet)
    const observationColumn = findColumn(headers, ['Observación', 'Observacion']) ?? 2
    const previousColumn = findColumn(headers, ['Pantalla Anterior'])
    const modificationColumn = findColumn(headers, ['Modificación', 'Modificacion', 'Ajuste'])
    const incidenceColumn = findColumn(headers, ['Tipo de incidencia'])
    const commentColumn = findColumn(headers, ['Comentarios', 'Comentario'])
    let validRows = 0
    let emptyRows = 0
    let completedRows = 0
    let imagesOnEmptyRows = 0
    const sheetUrls = new Set<string>()
    const sheetFigma = new Set<string>()

    for (let sourceRow = 2; sourceRow <= sheet.rowCount; sourceRow++) {
      const excelRow = sheet.getRow(sourceRow)
      const observation = cellText(excelRow, observationColumn)
      const rowImages = images.filter((image) => image.worksheet === sheet.name && image.row === sourceRow)
      if (!observation) {
        emptyRows++
        if (rowImages.length) {
          imagesOnEmptyRows += rowImages.length
          invalidRows.push({ worksheet: sheet.name, sourceRow, reason: `${rowImages.length} image(s) anchored to an empty observation row` })
        }
        continue
      }
      validRows++
      const completed = parseCompleted(excelRow.getCell(1).value)
      if (completed) completedRows++
      const previousScreen = cellText(excelRow, previousColumn)
      const modification = cellText(excelRow, modificationColumn)
      const comment = cellText(excelRow, commentColumn)
      const incidenceTypes = parseIncidenceTypes(cellText(excelRow, incidenceColumn))
      const cellHyperlinks: string[] = []
      excelRow.eachCell({ includeEmpty: false }, (cell) => { if (cell.hyperlink) cellHyperlinks.push(cell.hyperlink) })
      const urls = [...new Set([...extractUrls(observation, previousScreen, modification, comment), ...cellHyperlinks])]
      urls.forEach((url) => sheetUrls.add(url))
      const figmaUrls = urls.filter((url) => /(^|\.)figma\.com\//i.test(new URL(url).hostname + '/'))
      figmaUrls.forEach((url) => sheetFigma.add(url))
      rowImages.forEach((image) => mappedImages.add(image))
      rows.push({
        worksheet: sheet.name,
        sourceRow,
        completed,
        observation,
        previousScreen: previousScreen || undefined,
        modification: modification || undefined,
        comment: comment || undefined,
        incidenceTypes,
        experienceTags: experienceTagsFor(incidenceTypes),
        urls,
        figmaUrls,
        images: rowImages,
      })
    }

    worksheets.push({
      name: sheet.name,
      totalRows: Math.max(0, sheet.rowCount - 1),
      validRows,
      emptyRows,
      completedRows,
      imagePlacements: images.filter((image) => image.worksheet === sheet.name).length,
      imagesOnEmptyRows,
      urls: sheetUrls.size,
      figmaUrls: sheetFigma.size,
      headers: sheet.getRow(1).values.slice(1).map((value) => String(value ?? '')),
    })
  }

  return {
    file: {
      path: absolute,
      filename: path.basename(absolute),
      sha256: crypto.createHash('sha256').update(fileBuffer).digest('hex'),
      fileSize: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    },
    worksheets,
    rows,
    invalidRows,
    unmappedImages: images.filter((image) => !mappedImages.has(image)),
    physicalMediaFiles: zip.getEntries().filter((entry) => /^xl\/media\//.test(entry.entryName) && !entry.isDirectory).length,
    imagePlacements: images.length,
  }
}

export interface ExistingFindingIdentity {
  id: string
  projectId: string
  testSessionId: string | null
  sourceSheet: string | null
  sourceRow: number | null
  sourceFingerprint: string | null
  observation: string
}

export function reconcileIdentity(input: {
  projectId: string
  sessionId: string
  row: NormalizedXlsxRow
  fingerprint: string
  findings: ExistingFindingIdentity[]
}): { kind: 'MATCH' | 'NEW' | 'AMBIGUOUS'; strategy?: string; finding?: ExistingFindingIdentity; candidates?: string[] } {
  const active = input.findings.filter((finding) => finding.projectId === input.projectId)
  const strategies: Array<[string, (finding: ExistingFindingIdentity) => boolean]> = [
    ['sourceFingerprint', (finding) => finding.sourceFingerprint === input.fingerprint],
    ['project+sourceSheet+sourceRow', (finding) => finding.sourceSheet === input.row.worksheet && finding.sourceRow === input.row.sourceRow],
    ['session+sourceSheet+sourceRow', (finding) => finding.testSessionId === input.sessionId && finding.sourceSheet === input.row.worksheet && finding.sourceRow === input.row.sourceRow],
    ['unique-observation-in-session', (finding) => finding.testSessionId === input.sessionId && normalizeText(finding.observation) === normalizeText(input.row.observation)],
  ]
  for (const [strategy, predicate] of strategies) {
    const matches = active.filter(predicate)
    if (matches.length === 1) return { kind: 'MATCH', strategy, finding: matches[0] }
    if (matches.length > 1) return { kind: 'AMBIGUOUS', strategy, candidates: matches.map((finding) => finding.id) }
  }
  return { kind: 'NEW' }
}

export function shouldPromoteToValidated(currentStatus: string, completed: boolean): boolean {
  if (!completed) return false
  return ['OPEN', 'TRIAGED'].includes(currentStatus)
}
