import type { Cell, CellValue, ConditionalFormattingOptions, Style, Workbook, Worksheet } from 'exceljs'

// exceljs is large, so it is only loaded when a report is built
export async function loadWorkbook(file: File): Promise<Workbook> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error(`${file.name} is not an .xlsx file. Open it in Excel and save it as .xlsx first.`)
  }
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  if (workbook.worksheets.length === 0) throw new Error(`${file.name} has no sheets.`)
  return workbook
}

// The plain value behind formulas, links and rich text
export function plainValue(value: CellValue): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date || typeof value !== 'object') return value
  if ('result' in value)
    return value.result instanceof Date || typeof value.result !== 'object' ? (value.result ?? null) : null
  if ('richText' in value) return value.richText.map((part) => part.text).join('')
  if ('text' in value) return typeof value.text === 'string' ? value.text : plainValue(value.text)
  return null
}

// Titles compared without case or extra spaces (some wrap onto two lines)
export const normalize = (title: string) => title.replace(/\s+/g, ' ').trim().toLowerCase()

// Title → column number from the header row; the first column wins when a title repeats
export function headerColumns(sheet: Worksheet, headerRow = 1) {
  const columns = new Map<string, number>()
  sheet.getRow(headerRow).eachCell((cell, column) => {
    const title = plainValue(cell.value)
    if (title === null) return
    const key = normalize(String(title))
    if (!columns.has(key)) columns.set(key, column)
  })
  return columns
}

// Excel dates come back as UTC midnight of the shown day, so the UTC date is the day the sheet shows
export function isoDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function cellDate(cell: Cell): Date | null {
  const value = plainValue(cell.value)
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null
}

export function downloadWorkbookFile(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

// Not in exceljs' typings, but it is where a loaded sheet keeps its conditional formatting
type SheetWithFormatting = Worksheet & { conditionalFormattings: ConditionalFormattingOptions[] }

/**
 * exceljs reads Excel's "Duplicate values" highlight but cannot write it: it leaves an empty
 * <conditionalFormatting>, and Excel then calls the file corrupt. Each one is swapped for a COUNTIF
 * rule with the same look, covering its columns from row 2 down to lastRow.
 */
export function rewriteDuplicateHighlights(sheet: Worksheet, lastRow: number) {
  const formattingSheet = sheet as SheetWithFormatting
  const duplicates = new Map<string, Partial<Style> | undefined>()

  formattingSheet.conditionalFormattings = formattingSheet.conditionalFormattings.flatMap((formatting) => {
    const rules = formatting.rules.filter((rule) => {
      if ((rule.type as string) !== 'duplicateValues') return true
      for (const part of formatting.ref.split(/\s+/)) {
        const column = /^\$?([A-Z]+)/.exec(part)?.[1]
        if (column && !duplicates.has(column)) duplicates.set(column, rule.style)
      }
      return false
    })
    return rules.length > 0 ? [{ ...formatting, rules }] : []
  })

  for (const [column, style] of duplicates) {
    const range = `$${column}$2:$${column}$${lastRow}`
    sheet.addConditionalFormatting({
      ref: `${column}2:${column}${lastRow}`,
      rules: [
        { type: 'expression', priority: 3, formulae: [`AND(${column}2<>"",COUNTIF(${range},${column}2)>1)`], style },
      ],
    })
  }
}

// Values that stand in for missing data; matched without case or surrounding spaces
const PLACEHOLDERS = ['N/A', 'NA', '#N/A', 'NONE', 'NULL', 'NIL', '-', '--', 'TBA', 'TBC', 'TBD']

const fill = (argb: string): Partial<Style> => ({ fill: { type: 'pattern', pattern: 'solid', bgColor: { argb } } })

/** Marks every titled column from row 2 to lastRow: empty cells red, placeholders like N/A or None yellow */
export function highlightGaps(sheet: Worksheet, lastRow: number) {
  // Up to the last column with a title, so untitled note columns beside the table stay plain
  const lastTitled = Math.max(0, ...headerColumns(sheet).values())
  if (lastRow < 2 || lastTitled === 0) return
  const lastColumn = sheet.getColumn(lastTitled).letter
  const isPlaceholder = `OR(${PLACEHOLDERS.map((value) => `UPPER(TRIM(A2))="${value}"`).join(',')})`
  sheet.addConditionalFormatting({
    ref: `A2:${lastColumn}${lastRow}`,
    rules: [
      { type: 'expression', priority: 1, formulae: ['LEN(TRIM(A2))=0'], style: fill('FFFF0000') },
      { type: 'expression', priority: 2, formulae: [isPlaceholder], style: fill('FFFFFF00') },
    ],
  })
}
