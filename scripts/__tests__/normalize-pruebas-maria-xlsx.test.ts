// @vitest-environment node

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it } from 'vitest'
import { isLegacyStorageKey } from '@/lib/storage/storage-key'
import {
  auditWorkbook,
  deterministicEvidenceFilename,
  evidenceMarker,
  extractUrls,
  fingerprintForRow,
  parseCompleted,
  parseIncidenceTypes,
  reconcileIdentity,
  sessionDefinition,
  shouldPromoteToValidated,
  type NormalizedXlsxRow,
} from '../lib/pruebas-maria-xlsx'

const tempDirs: string[] = []
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

function row(overrides: Partial<NormalizedXlsxRow> = {}): NormalizedXlsxRow {
  return {
    worksheet: 'Pruebas 18 de agosto',
    sourceRow: 2,
    completed: false,
    observation: 'Hallazgo único',
    incidenceTypes: [],
    experienceTags: [],
    urls: [],
    figmaUrls: [],
    images: [],
    ...overrides,
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

async function fixtureWorkbook(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-normalizer-test-'))
  tempDirs.push(dir)
  const file = path.join(dir, 'fixture.xlsx')
  const workbook = new ExcelJS.Workbook()
  const image1 = workbook.addImage({ buffer: pixel, extension: 'png' })
  const image2 = workbook.addImage({ buffer: Buffer.concat([pixel, Buffer.from('second')]), extension: 'png' })
  const first = workbook.addWorksheet('Pruebas 17 de agosto')
  first.addRow(['', 'Observación', 'Evidencia', 'Tipo de incidencia', 'Comentarios'])
  first.addRow([true, 'Con dos imágenes https://example.com/spec', '', 'Diseño y funcionalidad', 'https://www.figma.com/design/demo'])
  first.addRow([false, 'Sin imagen', '', 'Copy', 'Comentario real'])
  first.addRow([false, '', '', '', ''])
  first.addImage(image1, { tl: { col: 2, row: 1 }, ext: { width: 10, height: 10 } })
  first.addImage(image2, { tl: { col: 2, row: 1 }, ext: { width: 10, height: 10 } })
  first.addImage(image1, { tl: { col: 2, row: 3 }, ext: { width: 10, height: 10 } })
  const second = workbook.addWorksheet('Pruebas 18 de agosto')
  second.addRow(['', 'Observación', 'Evidencia', 'Tipo de incidencia'])
  second.addRow([false, 'Misma sourceRow, otra hoja', '', 'Definición de negocio'])
  await workbook.xlsx.writeFile(file)
  return file
}

describe('XLSX inventory and normalization', () => {
  it('processes multiple worksheets and repeated sourceRow per sheet', async () => {
    const audit = await auditWorkbook(await fixtureWorkbook())
    expect(audit.worksheets).toHaveLength(2)
    expect(audit.rows.filter((item) => item.sourceRow === 2)).toHaveLength(2)
  })

  it('maps two images to one finding and accepts findings without images', async () => {
    const audit = await auditWorkbook(await fixtureWorkbook())
    expect(audit.rows.find((item) => item.observation.startsWith('Con dos'))?.images).toHaveLength(2)
    expect(audit.rows.find((item) => item.observation === 'Sin imagen')?.images).toHaveLength(0)
  })

  it('reports an image anchored to an empty row as invalid and unmapped', async () => {
    const audit = await auditWorkbook(await fixtureWorkbook())
    expect(audit.invalidRows.some((item) => item.sourceRow === 4)).toBe(true)
    expect(audit.unmappedImages.some((item) => item.row === 4)).toBe(true)
  })

  it('applies the documented row 67 to 68 image correction without losing anchor provenance', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-row-correction-test-'))
    tempDirs.push(dir)
    const file = path.join(dir, 'correction.xlsx')
    const workbook = new ExcelJS.Workbook()
    const image = workbook.addImage({ buffer: pixel, extension: 'png' })
    const sheet = workbook.addWorksheet('Pruebas 30 de julio')
    sheet.addRow(['', 'Observación', 'Evidencia'])
    for (let sourceRow = 2; sourceRow <= 68; sourceRow++) sheet.addRow([false, sourceRow === 68 ? 'Finding target' : '', ''])
    sheet.addImage(image, { tl: { col: 2, row: 66 }, ext: { width: 10, height: 10 } })
    await workbook.xlsx.writeFile(file)
    const audit = await auditWorkbook(file)
    const finding = audit.rows.find((item) => item.sourceRow === 68)
    expect(finding?.images).toHaveLength(1)
    expect(finding?.images[0]).toMatchObject({ row: 67, targetSourceRow: 68 })
    expect(audit.unmappedImages).toHaveLength(0)
    expect(audit.imageCorrections).toHaveLength(1)
  })

  it('extracts support and Figma URLs', () => {
    const urls = extractUrls('Referencia https://example.com/a.', 'https://www.figma.com/design/demo')
    expect(urls).toEqual(['https://example.com/a', 'https://www.figma.com/design/demo'])
  })

  it('maps incidence types without inventing unknown values', () => {
    expect(parseIncidenceTypes('Definición de negocio y Diseño')).toEqual(['DESIGN', 'BUSINESS_RULE'])
    expect(parseIncidenceTypes('Sin clasificar')).toEqual([])
  })

  it('parses only affirmative completion values', () => {
    expect(parseCompleted(true)).toBe(true)
    expect(parseCompleted('✓')).toBe(true)
    expect(parseCompleted(false)).toBe(false)
  })

  it('derives deterministic origin dates while preserving exact range names', () => {
    expect(sessionDefinition('Pruebas 30 de julio')).toMatchObject({
      name: 'Pruebas 30 de julio',
      date: '2026-07-30',
      originPeriod: '2026-07-30',
      isRange: false,
    })
    expect(sessionDefinition('Mod 31 Jul')).toMatchObject({ name: 'Mod 31 Jul', date: '2026-07-31' })
    expect(sessionDefinition('Pruebas 4 - 5 agosto')).toEqual({
      name: 'Pruebas 4 - 5 agosto',
      date: '2026-08-04',
      originStartDate: '2026-08-04',
      originEndDate: '2026-08-05',
      originPeriod: '2026-08-04/2026-08-05',
      isRange: true,
    })
    expect(sessionDefinition('Pruebas 6 - 7 de agosto')).toMatchObject({
      date: '2026-08-06',
      originPeriod: '2026-08-06/2026-08-07',
    })
  })

  it('does not treat persistence timestamps as worksheet row dates', async () => {
    const audit = await auditWorkbook(await fixtureWorkbook())
    expect(audit.worksheets.every((sheet) => sheet.dateMetadata.perRowDateCells === 0)).toBe(true)
  })
})

describe('idempotent reconciliation', () => {
  const projectId = 'project'
  const sessionId = 'session'

  it('matches an exact sourceFingerprint first', () => {
    const source = row()
    const fingerprint = fingerprintForRow(projectId, sessionId, source)
    const result = reconcileIdentity({ projectId, sessionId, row: source, fingerprint, findings: [{ id: 'f1', projectId, testSessionId: null, sourceSheet: null, sourceRow: null, sourceFingerprint: fingerprint, observation: 'different' }] })
    expect(result).toMatchObject({ kind: 'MATCH', strategy: 'sourceFingerprint', finding: { id: 'f1' } })
  })

  it('matches project + sourceSheet + sourceRow', () => {
    const source = row()
    const result = reconcileIdentity({ projectId, sessionId, row: source, fingerprint: 'new', findings: [{ id: 'f1', projectId, testSessionId: null, sourceSheet: source.worksheet, sourceRow: source.sourceRow, sourceFingerprint: null, observation: 'old' }] })
    expect(result.strategy).toBe('project+sourceSheet+sourceRow')
  })

  it('uses a unique normalized observation only inside the session', () => {
    const source = row({ observation: '  Hallazgo   ÚNICO ' })
    const result = reconcileIdentity({ projectId, sessionId, row: source, fingerprint: 'new', findings: [{ id: 'f1', projectId, testSessionId: sessionId, sourceSheet: null, sourceRow: null, sourceFingerprint: null, observation: 'hallazgo único' }] })
    expect(result.strategy).toBe('unique-observation-in-session')
  })

  it('marks duplicate observation candidates as ambiguous', () => {
    const source = row()
    const base = { projectId, testSessionId: sessionId, sourceSheet: null, sourceRow: null, sourceFingerprint: null, observation: source.observation }
    const result = reconcileIdentity({ projectId, sessionId, row: source, fingerprint: 'new', findings: [{ id: 'f1', ...base }, { id: 'f2', ...base }] })
    expect(result).toMatchObject({ kind: 'AMBIGUOUS', strategy: 'unique-observation-in-session' })
  })

  it('does not cross-match the same sourceRow in another sheet', () => {
    const source = row()
    const result = reconcileIdentity({ projectId, sessionId, row: source, fingerprint: 'new', findings: [{ id: 'f1', projectId, testSessionId: sessionId, sourceSheet: 'Otra hoja', sourceRow: source.sourceRow, sourceFingerprint: null, observation: 'otra' }] })
    expect(result.kind).toBe('NEW')
  })

  it('produces deterministic evidence identity for duplicate detection and reruns', () => {
    expect(deterministicEvidenceFilename('Pruebas 18 de agosto', 2, 'abcdef1234567890', 'PNG')).toBe('xlsx-pruebas-18-de-agosto-row-2-abcdef123456.png')
    expect(evidenceMarker('sheet', 2, 'hash')).toBe(evidenceMarker('sheet', 2, 'hash'))
  })

  it('distinguishes legacy from runtime evidence keys', () => {
    expect(isLegacyStorageKey('legacy/image.png')).toBe(true)
    expect(isLegacyStorageKey('findings/f1/e1/image.png')).toBe(false)
  })
})

describe('status safety', () => {
  it('promotes OPEN and TRIAGED when Excel is TRUE', () => {
    expect(shouldPromoteToValidated('OPEN', true)).toBe(true)
    expect(shouldPromoteToValidated('TRIAGED', true)).toBe(true)
  })

  it('never degrades VALIDATED or CLOSED when Excel is FALSE', () => {
    expect(shouldPromoteToValidated('VALIDATED', false)).toBe(false)
    expect(shouldPromoteToValidated('CLOSED', false)).toBe(false)
  })

  it('does not overwrite advanced workflow states', () => {
    expect(shouldPromoteToValidated('IN_PROGRESS', true)).toBe(false)
    expect(shouldPromoteToValidated('READY_FOR_VALIDATION', true)).toBe(false)
    expect(shouldPromoteToValidated('CLOSED', true)).toBe(false)
  })
})
