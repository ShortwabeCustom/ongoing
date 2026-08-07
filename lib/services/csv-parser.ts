import Papa from 'papaparse'

export interface RawCSVRow {
  [key: string]: string | undefined
}

export async function parseCSV(file: File): Promise<RawCSVRow[]> {
  const text = await file.text()

  return new Promise<RawCSVRow[]>((resolve, reject) => {
    Papa.parse<RawCSVRow>(text, {
      header: true,
      skipEmptyLines: true,
      error: (err: Error) => reject(err),
      complete: (results: Papa.ParseResult<RawCSVRow>) => {
        resolve(results.data)
      },
    })
  })
}
