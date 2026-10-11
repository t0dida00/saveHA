import type { Row } from 'exceljs'
import {
  cellDate,
  headerColumns,
  highlightGaps,
  isoDay,
  loadWorkbook,
  normalize,
  plainValue,
  rewriteDuplicateHighlights,
} from './excel'
import { teusFromVolume } from './teus'
import { tradeFromPod } from './trade'
import { readVolume, type VolumeInfo } from './volume'

/** Inclusive date range as yyyy-mm-dd; an empty end is open */
export type DateRange = { from: string; to: string }

/** `source` can list several titles when exports name the same column differently; the first one found is used */
type ColumnPair = { output: string; source: string | string[] }

export type InputKind = {
  name: string
  /** Export files are filtered by ETD, import files by ETA */
  direction: 'export' | 'import'
  /** Output sample title → this input's title, both matched in each sheet's first row */
  columns: ColumnPair[]
  /** Output sample title → a value written on every row of this input */
  fixed?: { output: string; value: string | number }[]
}

export const SEA_EXPORT: InputKind = {
  name: 'Sea Export',
  direction: 'export',
  columns: [
    { output: 'Office', source: 'Office' },
    { output: 'MBL#', source: 'MB/L No.' },
    { output: 'Booking#', source: 'Carrier Bkg. No.' },
    { output: 'ETD', source: 'ETD' },
    { output: 'ETA', source: 'ETA' },
    { output: 'POL', source: 'Port of Loading' },
    { output: 'POD', source: 'Port of Discharge' },
    { output: 'Destination', source: 'Place of Delivery' },
    { output: 'Carrier', source: 'Carrier' },
    { output: 'Volume', source: 'Container/Qty' },
    { output: 'SOC', source: 'Ship Mode' },
    { output: 'S/C', source: 'Carrier Contract No.' },
    { output: 'MV', source: 'Vessel' },
    { output: 'Vouye', source: 'Voyage' },
    { output: 'Cont#', source: 'Container No.' },
    { output: 'OP', source: 'OP' },
    { output: 'File No.', source: 'File No.' },
  ],
}

// MBL# written on bookings that were cancelled; those rows are left out of the report
const CANCELLED_MBL = 'BKCANCELLATION'

export const SEA_IMPORT: InputKind = {
  name: 'Sea Import',
  direction: 'import',
  columns: [
    { output: 'Office', source: 'Office' },
    { output: 'MBL#', source: 'MB/L No.' },
    { output: 'Booking#', source: 'MB/L No.' },
    { output: 'ETD', source: 'ETD' },
    { output: 'ETA', source: 'ETA' },
    { output: 'POL', source: 'Port of Loading' },
    { output: 'POD', source: 'Place of Delivery' },
    { output: 'Destination', source: 'Final Destination' },
    { output: 'Carrier', source: 'Carrier' },
    { output: 'Volume', source: 'Container/Qty' },
    { output: 'SOC', source: 'Ship Mode' },
    { output: 'S/C', source: 'Carrier Contract No.' },
    { output: 'MV', source: 'Vessel' },
    { output: 'Vouye', source: 'Voyage' },
    { output: 'Cont#', source: 'Container No.' },
    { output: 'OP', source: 'OP' },
    { output: 'File No.', source: 'File No.' },
  ],
}

// Air Export lists name the MAWB column "MB/L No."
const AIR_COLUMNS: ColumnPair[] = [
  { output: 'Office', source: 'Office' },
  { output: 'MBL#', source: ['MAWB No.', 'MB/L No.'] },
  { output: 'Booking#', source: ['MAWB No.', 'MB/L No.'] },
  { output: 'ETD', source: 'ETD' },
  { output: 'ETA', source: 'ETA' },
  { output: 'POL', source: 'Departure' },
  { output: 'POD', source: 'Destination' },
  { output: 'Destination', source: 'Destination' },
  { output: 'Carrier', source: 'Carrier' },
  { output: 'MV', source: 'Flight No.' },
  { output: 'Vouye', source: 'Flight No.' },
  { output: 'OP', source: 'OP' },
  { output: 'File No.', source: 'File No.' },
]

// Air has no containers or contracts: Volume is always XX, Teus 0 and S/C N/A; SOC and Cont# are left empty
const AIR_FIXED: InputKind['fixed'] = [
  { output: 'Volume', value: 'XX' },
  { output: 'Teus', value: 0 },
  { output: 'S/C', value: 'N/A' },
]

export const AIR_EXPORT: InputKind = { name: 'Air Export', direction: 'export', columns: AIR_COLUMNS, fixed: AIR_FIXED }
export const AIR_IMPORT: InputKind = { name: 'Air Import', direction: 'import', columns: AIR_COLUMNS, fixed: AIR_FIXED }

export const dateTitle = (kind: InputKind) => (kind.direction === 'export' ? 'ETD' : 'ETA')

const inRange = (date: Date | null, { from, to }: DateRange) => {
  if (!from && !to) return true
  if (!date) return false
  const day = isoDay(date)
  return (!from || day >= from) && (!to || day <= to)
}

export type ReportInput = { kind: InputKind; file: File }

// Volume values the report names differently (keys in capitals); anything else is copied as it is
const CUSTOMER_TYPE_NAMES: Record<string, string> = { 'FREE CARGO': 'BCO' }
const SALESMAN_NAMES: Record<string, string> = { 'JOHNSON WANG': 'CIMC' }

const rename = (names: Record<string, string>, value: string | null) =>
  value === null ? null : (names[value.replace(/\s+/g, ' ').trim().toUpperCase()] ?? value)

// Output sample title → what it takes from the Volume report, looked up by the row's File No.
const VOLUME_COLUMNS: { output: string; value: (info: VolumeInfo) => string | null }[] = [
  { output: 'Shipment Type', value: (info) => info.shippingType },
  { output: 'Account name', value: (info) => info.customer },
  { output: 'Customer type', value: (info) => rename(CUSTOMER_TYPE_NAMES, info.salesType) },
  { output: 'Salesman', value: (info) => rename(SALESMAN_NAMES, info.salesPerson) },
  { output: 'Own or Coload', value: (info) => (info.coload ? 'Coload' : 'Own') },
]

export type BuiltReport = {
  buffer: ArrayBuffer
  rowCount: number
  /** Rows left out because their MBL# is BKCANCELLATION */
  cancelledCount: number
  /** Rows added and cancelled bookings left out, per input kind in the order they were given */
  byInput: { name: string; rowCount: number; cancelledCount: number }[]
  /** File Nos with no row in the Volume report, so their Volume columns were left empty */
  unmatchedFileNos: string[]
  /** Titles that were not found, so their columns were left empty, e.g. `"ETA" in Sea Export` */
  missing: string[]
}

// Fills the output sample's first sheet from row 2 down with each input's rows in turn, keeping its formatting
export async function buildReport(
  sample: File,
  inputs: ReportInput[],
  volumeFile: File,
  range: DateRange,
): Promise<BuiltReport> {
  const [output, volume, ...books] = await Promise.all([
    loadWorkbook(sample),
    readVolume(volumeFile),
    ...inputs.map(({ file }) => loadWorkbook(file)),
  ])
  const target = output.worksheets[0]
  const targetColumns = headerColumns(target)
  const filtered = Boolean(range.from || range.to)
  const missing = new Set<string>(volume.missing)
  let cancelledCount = 0
  const byInput = new Map<string, { name: string; rowCount: number; cancelledCount: number }>()
  const picked: { row: Row; pairs: { from: number; to: number }[]; fixed: { to: number; value: string | number }[] }[] =
    []

  inputs.forEach(({ kind, file }, index) => {
    const counts = byInput.get(kind.name) ?? { name: kind.name, rowCount: 0, cancelledCount: 0 }
    byInput.set(kind.name, counts)
    const source = books[index].worksheets[0]
    const sourceColumns = headerColumns(source)

    const dateColumn = sourceColumns.get(normalize(dateTitle(kind)))
    if (dateColumn === undefined && filtered) {
      throw new Error(
        `${file.name} has no "${dateTitle(kind)}" column in its first row, so it cannot be filtered by date.`,
      )
    }

    const sourceColumn = (titles: string | string[]) =>
      [titles]
        .flat()
        .map((title) => sourceColumns.get(normalize(title)))
        .find((column) => column !== undefined)

    const pairs: { from: number; to: number }[] = []
    for (const { output: title, source: sourceTitles } of kind.columns) {
      const to = targetColumns.get(normalize(title))
      const from = sourceColumn(sourceTitles)
      if (to === undefined) missing.add(`"${title}" in the output sample`)
      if (from === undefined) missing.add(`"${[sourceTitles].flat().join('" or "')}" in ${kind.name}`)
      if (to !== undefined && from !== undefined) pairs.push({ from, to })
    }
    const fixed = (kind.fixed ?? []).flatMap(({ output: title, value }) => {
      const to = targetColumns.get(normalize(title))
      if (to === undefined) missing.add(`"${title}" in the output sample`)
      return to === undefined ? [] : [{ to, value }]
    })

    const mblTitles = kind.columns.find(({ output: title }) => title === 'MBL#')?.source
    const mblColumn = mblTitles === undefined ? undefined : sourceColumn(mblTitles)

    // Rows under the header with a date in range; blank rows and cancelled bookings are skipped
    for (let r = 2; r <= source.rowCount; r++) {
      const row = source.getRow(r)
      if (!row.hasValues || pairs.every(({ from }) => plainValue(row.getCell(from).value) === null)) continue
      if (!inRange(dateColumn === undefined ? null : cellDate(row.getCell(dateColumn)), range)) continue
      const mbl = mblColumn === undefined ? null : plainValue(row.getCell(mblColumn).value)
      if (typeof mbl === 'string' && mbl.trim().toUpperCase() === CANCELLED_MBL) {
        cancelledCount++
        counts.cancelledCount++
        continue
      }
      picked.push({ row, pairs, fixed })
      counts.rowCount++
    }
  })

  const styleRow = target.getRow(2)
  const formattedRows = target.rowCount
  // Anything under the sample's header (example rows, notes) is cleared; its formatting stays
  for (let r = 2; r <= formattedRows; r++) {
    target.getRow(r).eachCell((cell) => {
      cell.value = null
    })
  }
  // Teus and Trade are worked out from Volume and POD rather than copied
  const volumeColumn = targetColumns.get(normalize('Volume'))
  const teusColumn = targetColumns.get(normalize('Teus'))
  const podColumn = targetColumns.get(normalize('POD'))
  const tradeColumn = targetColumns.get(normalize('Trade'))
  const fileNoColumn = targetColumns.get(normalize('File No.'))
  if (fileNoColumn === undefined) missing.add('"File No." in the output sample')
  const volumeTargets = VOLUME_COLUMNS.flatMap(({ output: title, value }) => {
    const column = targetColumns.get(normalize(title))
    if (column === undefined) missing.add(`"${title}" in the output sample`)
    return column === undefined ? [] : [{ column, value }]
  })
  const unmatchedFileNos = new Set<string>()

  picked.forEach(({ row: sourceRow, pairs, fixed }, index) => {
    const rowNumber = index + 2
    const row = target.getRow(rowNumber)
    // Rows past the sample's formatted ones take row 2's look
    if (rowNumber > formattedRows) {
      for (let column = 1; column <= target.columnCount; column++) {
        row.getCell(column).style = { ...styleRow.getCell(column).style }
      }
    }
    for (const { from, to } of pairs) {
      row.getCell(to).value = plainValue(sourceRow.getCell(from).value)
    }
    if (volumeColumn !== undefined && teusColumn !== undefined) {
      row.getCell(teusColumn).value = teusFromVolume(plainValue(row.getCell(volumeColumn).value))
    }
    if (podColumn !== undefined && tradeColumn !== undefined) {
      row.getCell(tradeColumn).value = tradeFromPod(plainValue(row.getCell(podColumn).value))
    }
    // Last, so a fixed Teus is not replaced by the one worked out from Volume
    for (const { to, value } of fixed) row.getCell(to).value = value
    const fileNo = fileNoColumn === undefined ? null : plainValue(row.getCell(fileNoColumn).value)
    if (fileNo !== null && String(fileNo).trim() !== '') {
      const info = volume.byFileNo.get(String(fileNo).trim())
      if (info) for (const { column, value } of volumeTargets) row.getCell(column).value = value(info)
      else unmatchedFileNos.add(String(fileNo).trim())
    }
  })

  rewriteDuplicateHighlights(target, Math.max(formattedRows, picked.length + 1))
  highlightGaps(target, picked.length + 1)

  return {
    buffer: (await output.xlsx.writeBuffer()) as ArrayBuffer,
    rowCount: picked.length,
    cancelledCount,
    byInput: [...byInput.values()],
    unmatchedFileNos: [...unmatchedFileNos],
    missing: [...missing],
  }
}
