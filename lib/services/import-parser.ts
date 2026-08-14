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

async function parseXlsx(file: File, maxPreviewRows: number = 1000): Promise<ParsedImportFile> {
  const buffer = Buffer.from(await file.arrayBuffer())

  // Use lightweight XLSX parser with minimal options for max performance
  const workbook = XLSX.read(buffer, {
    cellFormula: false,
    cellStyles: false,
    blankCells: false,
  } as any)

  const sheets: ParsedImportSheet[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) continue

    // Get range to avoid parsing entire sheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    const maxRowToProcess = Math.min(range.e.r, maxPreviewRows + 10) // +10 for headers

    let headerRowIndex = 0
    let headers: string[] = []

    // Find headers by scanning first rows only
    for (let row = range.s.r; row <= Math.min(range.e.r, 50); row++) {
      const rowData: Array<string> = []
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddr = XLSX.utils.encode_cell({ r: row, c: col })
        const cell = worksheet[cellAddr]
        const value = cell?.v ?? ''
        rowData.push(cellToString(value))
      }

      const candidateHeaders = rowData.map(cleanHeader)
      if (candidateHeaders.some(Boolean)) {
        headers = candidateHeaders
        headerRowIndex = row
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

    // Extract data rows - LIMITED to preview size for performance
    const dataRows: ParsedImportSheet['rows'] = []
    let rowCount = 0

    for (let row = headerRowIndex + 1; row <= maxRowToProcess && rowCount < maxPreviewRows; row++) {
      const rowData: Array<string> = []
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddr = XLSX.utils.encode_cell({ r: row, c: col })
        const cell = worksheet[cellAddr]
        const value = cell?.v ?? ''
        rowData.push(cellToString(value))
      }

      const data: RawImportRow = {}
      headers.forEach((header, index) => {
        if (header && rowData[index]) {
          data[header] = rowData[index]
        }
      })

      if (!rowIsEmpty(data)) {
        dataRows.push({ sourceRow: row + 1, data })
        rowCount++
      }
    }

    // Warn if file is larger than preview
    const totalRows = range.e.r - headerRowIndex
    const warnings = totalRows > maxPreviewRows ? [`Preview limited to ${maxPreviewRows} rows (file has ${totalRows} data rows)`] : []

    sheets.push({
      name: sheetName,
      headers: headers.filter(Boolean),
      rows: dataRows,
      embeddedImageCount: 0,
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
