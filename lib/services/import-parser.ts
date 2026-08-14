import ExcelJS from 'exceljs'
import Papa from 'papaparse'

export type RawImportRow = Record<string, string | undefined>

export interface ParsedImportSheet {
  name: string
  headers: string[]
  rows: Array<{
    sourceRow: number
    data: RawImportRow
  }>
  embeddedImageCount: number
}

export interface ParsedImportFile {
  fileName: string
  fileType: 'csv' | 'xlsx'
  sheets: ParsedImportSheet[]
  warnings: string[]
}

function cleanHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim()
}

function cellToString(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const rich = value as { text?: string; result?: unknown; formula?: string; hyperlink?: string }
    if (rich.text != null) return String(rich.text).trim()
    if (rich.result != null) return cellToString(rich.result)
    if (rich.hyperlink != null) return String(rich.hyperlink).trim()
    if (rich.formula != null) return String(rich.formula).trim()
  }
  return String(value).trim()
}

function rowIsEmpty(row: RawImportRow): boolean {
  return Object.values(row).every((value) => !value?.trim())
}

async function parseCsv(file: File): Promise<ParsedImportFile> {
  const text = await file.text()

  const parsed = await new Promise<Papa.ParseResult<RawImportRow>>((resolve, reject) => {
    Papa.parse<RawImportRow>(text, {
      header: true,
      skipEmptyLines: false,
      transformHeader: cleanHeader,
      error: reject,
      complete: resolve,
    })
  })

  const headers = (parsed.meta.fields ?? []).map(cleanHeader).filter(Boolean)
  const rows = parsed.data
    .map((data, index) => ({
      sourceRow: index + 2,
      data,
    }))
    .filter((row) => !rowIsEmpty(row.data))

  return {
    fileName: file.name,
    fileType: 'csv',
    sheets: [
      {
        name: file.name.replace(/\.[^.]+$/, '') || 'CSV',
        headers,
        rows,
        embeddedImageCount: 0,
      },
    ],
    warnings: parsed.errors.map((error) => `CSV row ${error.row ?? '?'}: ${error.message}`),
  }
}

async function parseXlsx(file: File): Promise<ParsedImportFile> {
  const workbook = new ExcelJS.Workbook()
  const buffer = Buffer.from(await file.arrayBuffer())

  // Optimize for large files: disable unused features
  await workbook.xlsx.load(buffer as any, {
    entries: 'emit',
    hyperlinks: 'ignore',
  } as any)

  const sheets: ParsedImportSheet[] = []

  workbook.worksheets.forEach((worksheet) => {
    let headerRowNumber = 0
    let headers: string[] = []

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (headerRowNumber) return

      const values = Array.isArray(row.values) ? row.values.slice(1) : []
      const candidateHeaders = values.map(cellToString)
      if (candidateHeaders.some(Boolean)) {
        headerRowNumber = rowNumber
        headers = candidateHeaders.map(cleanHeader)
      }
    })

    if (!headerRowNumber || headers.length === 0) {
      sheets.push({
        name: worksheet.name,
        headers: [],
        rows: [],
        embeddedImageCount: worksheet.getImages().length,
      })
      return
    }

    const rows: ParsedImportSheet['rows'] = []
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return

      const values = Array.isArray(row.values) ? row.values.slice(1) : []
      const data: RawImportRow = {}

      headers.forEach((header, index) => {
        if (!header) return
        const value = cellToString(values[index])
        if (value) data[header] = value
      })

      if (!rowIsEmpty(data)) {
        rows.push({ sourceRow: rowNumber, data })
      }
    })

    sheets.push({
      name: worksheet.name,
      headers: headers.filter(Boolean),
      rows,
      embeddedImageCount: worksheet.getImages().length,
    })
  })

  return {
    fileName: file.name,
    fileType: 'xlsx',
    sheets,
    warnings: sheets
      .filter((sheet) => sheet.embeddedImageCount > 0)
      .map(
        (sheet) =>
          `${sheet.name}: ${sheet.embeddedImageCount} embedded image(s) detected; row mapping requires a real workbook validation pass.`,
      ),
  }
}

export async function parseImportFile(file: File): Promise<ParsedImportFile> {
  const lowerName = file.name.toLowerCase()

  if (
    file.type === 'text/csv' ||
    file.type === 'application/vnd.ms-excel' ||
    lowerName.endsWith('.csv')
  ) {
    return parseCsv(file)
  }

  if (
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    lowerName.endsWith('.xlsx')
  ) {
    return parseXlsx(file)
  }

  throw new Error('UNSUPPORTED_IMPORT_FILE_TYPE')
}
