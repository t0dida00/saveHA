import { headerColumns, loadWorkbook, normalize, plainValue } from './excel'
import type { VolumeField } from './mapping'

export type VolumeInfo = {
  shippingType: string | null
  customer: string | null
  salesType: string | null
  salesPerson: string | null
  /** Any of the file's rows names a co-loader */
  coload: boolean
}

// The Volume report has a title block above its table, so the header is the first row with the File No. title
const HEADER_SEARCH_ROWS = 30

const text = (value: unknown) =>
  value === null || value === undefined || String(value).trim() === '' ? null : String(value).trim()

/**
 * File No. → the Volume report's details for it. A File No. can have one row per HB/L: like VLOOKUP, its first
 * row gives the details, and it is a co-load when any of its rows has a co-loader.
 */
export async function readVolume(file: File, titles: Record<VolumeField, string>) {
  const sheet = (await loadWorkbook(file)).worksheets[0]

  let headerRow = 0
  for (let r = 1; r <= Math.min(sheet.rowCount, HEADER_SEARCH_ROWS) && !headerRow; r++) {
    if (headerColumns(sheet, r).has(normalize(titles.fileNo))) headerRow = r
  }
  if (!headerRow)
    throw new Error(`${file.name} has no "${titles.fileNo}" column, so it cannot be matched to the report.`)

  const columns = headerColumns(sheet, headerRow)
  const column = (title: string) => columns.get(normalize(title))
  const missing = Object.values(titles)
    .filter((title) => column(title) === undefined)
    .map((title) => `"${title}" in Volume`)

  const byFileNo = new Map<string, VolumeInfo>()
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const get = (title: string) => {
      const index = column(title)
      return index === undefined ? null : text(plainValue(row.getCell(index).value))
    }
    const fileNo = get(titles.fileNo)
    if (!fileNo) continue
    const coload = get(titles.coLoader) !== null
    const known = byFileNo.get(fileNo)
    if (known) {
      known.coload ||= coload
      continue
    }
    byFileNo.set(fileNo, {
      shippingType: get(titles.shippingType),
      customer: get(titles.customer),
      salesType: get(titles.salesType),
      salesPerson: get(titles.salesPerson),
      coload,
    })
  }

  return { byFileNo, missing }
}
