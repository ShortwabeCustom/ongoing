import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

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
  const buffer = Buffer.from(await file.arrayBuffer())

  // Use lightweight XLSX parser for better performance on large files
  const workbook = XLSX.read(buffer, {
    cellFormula: false,
    cellStyles: false,
  } as XLSX.ParsingOptions)

  const sheets: ParsedImportSheet[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) continue

    // Convert to array of arrays for easier processing
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    const rows: Array<Array<string>> = []

    for (let row = range.s.r; row <= range.e.r; row++) {
      const rowData: Array<string> = []
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddr = XLSX.utils.encode_cell({ r: row, c: col })
        const cell = worksheet[cellAddr]
        const value = cell?.v ?? ''
        rowData.push(cellToString(value))
      }
      rows.push(rowData)
    }

    // Find header row
    let headerRowIndex = 0
    let headers: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const candidateHeaders = rows[i].map(cleanHeader)
      if (candidateHeaders.some(Boolean)) {
        headers = candidateHeaders
        headerRowIndex = i
        break
      }
    }

    if (headers.length === 0) {
      sheets.push({
        name: sheetName,
        headers: [],
        rows: [],
        embeddedImageCount: 0,
      })
      continue
    }

    // Extract data rows
    const dataRows: ParsedImportSheet['rows'] = []
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const rowData = rows[i]
      const data: RawImportRow = {}

      headers.forEach((header, index) => {
        if (header && rowData[index]) {
          data[header] = rowData[index]
        }
      })

      if (!rowIsEmpty(data)) {
        dataRows.push({ sourceRow: i + 1, data })
      }
    }

    sheets.push({
      name: sheetName,
      headers: headers.filter(Boolean),
      rows: dataRows,
      embeddedImageCount: 0, // XLSX doesn't have image metadata easily accessible
    })
  }

  return {
    fileName: file.name,
    fileType: 'xlsx',
    sheets,
    warnings: [],
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
