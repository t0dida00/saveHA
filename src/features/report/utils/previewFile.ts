import { headerColumns, isoDay, loadWorkbook, normalize, plainValue } from './excel'

export type FilePreview = {
  /** Sheet name, or null for a CSV */
  sheet: string | null
  /** Row number the titles are on (Volume reports have a title block above them) */
  headerRow: number
  titles: string[]
  rows: string[][]
  /** Data rows under the titles, of which `rows` are the first */
  totalRows: number
}

export const PREVIEW_ROWS = 50
const HEADER_SEARCH_ROWS = 30

// Shown the way Excel shows them, dd/mm/yyyy, without a time
const cellText = (value: unknown) => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    const [year, month, day] = isoDay(value).split('-')
    return `${day}/${month}/${year}`
  }
  return String(value)
}

// Quoted fields may hold commas, doubled quotes and line breaks
function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (field !== '' || row.length > 0) rows.push([...row, field])
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

/** The titles and first PREVIEW_ROWS rows of a CSV or the first sheet of an .xlsx */
export async function readPreview(file: File): Promise<FilePreview> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    const [titles = [], ...rows] = parseCsv((await file.text()).replace(/^﻿/, ''))
    return { sheet: null, headerRow: 1, titles, rows: rows.slice(0, PREVIEW_ROWS), totalRows: rows.length }
  }

  const sheet = (await loadWorkbook(file)).worksheets[0]
  // Titles are on the first row with a File No. title, else row 1
  let headerRow = 1
  for (let r = 1; r <= Math.min(sheet.rowCount, HEADER_SEARCH_ROWS); r++) {
    if (headerColumns(sheet, r).has(normalize('File No.'))) {
      headerRow = r
      break
    }
  }
  const columnCount = Math.max(0, ...headerColumns(sheet, headerRow).values())
  const read = (r: number) =>
    Array.from({ length: columnCount }, (_, i) => cellText(plainValue(sheet.getRow(r).getCell(i + 1).value)))

  const rows: string[][] = []
  let totalRows = 0
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    if (!sheet.getRow(r).hasValues) continue
    totalRows++
    if (rows.length < PREVIEW_ROWS) rows.push(read(r))
  }
  return { sheet: sheet.name, headerRow, titles: read(headerRow), rows, totalRows }
}
