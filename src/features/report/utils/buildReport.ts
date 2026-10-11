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
import {
  CALCULATED,
  COLUMN_IDS,
  type ColumnId,
  INPUT_INFO,
  type InputId,
  type ReportMapping,
  type Rule,
  VOLUME_FIELD_COLUMN,
  type VolumeField,
} from './mapping'
import { createRenamer, DEFAULT_SHORT_NAMES, type ShortNames } from './shortNames'
import { teusFromVolume } from './teus'
import { createTradeLookup, DEFAULT_TRADE_PORTS, type Trade } from './trade'
import { readVolume, type VolumeInfo } from './volume'

/** Inclusive date range as yyyy-mm-dd; an empty end is open */
export type DateRange = { from: string; to: string }

export type ReportInput = { id: InputId; file: File }

// MBL# written on bookings that were cancelled; those rows are left out of the report
const CANCELLED_MBL = 'BKCANCELLATION'

const inRange = (date: Date | null, { from, to }: DateRange) => {
  if (!from && !to) return true
  if (!date) return false
  const day = isoDay(date)
  return (!from || day >= from) && (!to || day <= to)
}

/** What each Volume field writes into its report column */
const VOLUME_VALUES: Record<Exclude<VolumeField, 'fileNo'>, (info: VolumeInfo) => string | null> = {
  shippingType: (info) => info.shippingType,
  customer: (info) => info.customer,
  salesType: (info) => info.salesType,
  salesPerson: (info) => info.salesPerson,
  coLoader: (info) => (info.coload ? 'Coload' : 'Own'),
}

/** Rule notes shown in Report settings */
export const VOLUME_NOTES: Partial<Record<VolumeField, string>> = {
  fileNo: 'Lookup key',
  coLoader: 'Coload if filled, else Own',
}

const titlesOf = (rule: Rule | undefined) => (rule && 'titles' in rule ? rule.titles : null)

export type BuiltReport = {
  buffer: ArrayBuffer
  rowCount: number
  /** Rows left out because their MBL# is BKCANCELLATION */
  cancelledCount: number
  /** Rows added and cancelled bookings left out, per input in the order they were given */
  byInput: { name: string; rowCount: number; cancelledCount: number }[]
  /** File Nos with no row in the Volume report, so their Volume columns were left empty */
  unmatchedFileNos: string[]
  /** Titles that were not found, so their columns were left empty, e.g. `"ETA" in Sea Export` */
  missing: string[]
}

type Picked = {
  row: Row
  pairs: { from: number; to: number }[]
  fixed: { to: number; value: string | number }[]
  /** Calculated columns this input does not map itself */
  calculate: Set<ColumnId>
}

// Fills the output sample's first sheet from row 2 down with each input's rows in turn, keeping its formatting.
// Which columns are read and written comes from the mapping in Report settings
export async function buildReport(
  sample: File,
  inputs: ReportInput[],
  volumeFile: File,
  range: DateRange,
  mapping: ReportMapping,
  tradePorts: Record<Trade, string[]> = DEFAULT_TRADE_PORTS,
  shortNames: ShortNames = DEFAULT_SHORT_NAMES,
): Promise<BuiltReport> {
  const tradeFromPod = createTradeLookup(tradePorts)
  const renamer = createRenamer(shortNames)
  const [output, volume, ...books] = await Promise.all([
    loadWorkbook(sample),
    readVolume(volumeFile, mapping.volume),
    ...inputs.map(({ file }) => loadWorkbook(file)),
  ])
  const target = output.worksheets[0]
  const targetColumns = headerColumns(target)
  const outputColumn = (id: ColumnId) => targetColumns.get(normalize(mapping.outputTitles[id]))
  const filtered = Boolean(range.from || range.to)
  const missing = new Set<string>(volume.missing)
  let cancelledCount = 0
  const byInput = new Map<string, { name: string; rowCount: number; cancelledCount: number }>()
  const picked: Picked[] = []

  inputs.forEach(({ id, file }, index) => {
    const { name, dateColumn: dateId } = INPUT_INFO[id]
    const rules = mapping.inputs[id]
    const counts = byInput.get(name) ?? { name, rowCount: 0, cancelledCount: 0 }
    byInput.set(name, counts)
    const source = books[index].worksheets[0]
    const sourceColumns = headerColumns(source)
    const sourceColumn = (titles: string[]) =>
      titles.map((title) => sourceColumns.get(normalize(title))).find((column) => column !== undefined)

    // Export files are filtered by the column mapped to ETD, import files by the one mapped to ETA
    const dateTitles = titlesOf(rules[dateId])
    const dateColumn = dateTitles ? sourceColumn(dateTitles) : undefined
    if (dateColumn === undefined && filtered) {
      const what = dateTitles ? `no "${dateTitles.join('" or "')}" column` : `no column mapped to ${dateId}`
      throw new Error(`${file.name} has ${what}, so it cannot be filtered by date.`)
    }

    const pairs: { from: number; to: number }[] = []
    const fixed: { to: number; value: string | number }[] = []
    for (const columnId of COLUMN_IDS) {
      const rule = rules[columnId]
      if (!rule) continue
      const to = outputColumn(columnId)
      if (to === undefined) missing.add(`"${mapping.outputTitles[columnId]}" in the output sample`)
      if ('value' in rule) {
        if (to !== undefined) fixed.push({ to, value: rule.value })
        continue
      }
      const from = sourceColumn(rule.titles)
      if (from === undefined) missing.add(`"${rule.titles.join('" or "')}" in ${name}`)
      if (to !== undefined && from !== undefined) pairs.push({ from, to })
    }
    const calculate = new Set((Object.keys(CALCULATED) as ColumnId[]).filter((columnId) => !rules[columnId]))

    const mblTitles = titlesOf(rules['MBL#'])
    const mblColumn = mblTitles ? sourceColumn(mblTitles) : undefined

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
      picked.push({ row, pairs, fixed, calculate })
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

  // Teus and Trade are worked out from Volume and POD for inputs that do not map them
  const teus = { to: outputColumn('Teus'), from: outputColumn(CALCULATED.Teus!.from) }
  const trade = { to: outputColumn('Trade'), from: outputColumn(CALCULATED.Trade!.from) }
  const fileNoColumn = outputColumn(VOLUME_FIELD_COLUMN.fileNo)
  if (fileNoColumn === undefined) missing.add(`"${mapping.outputTitles['File No.']}" in the output sample`)
  const volumeTargets = (Object.keys(VOLUME_VALUES) as (keyof typeof VOLUME_VALUES)[]).flatMap((field) => {
    const columnId = VOLUME_FIELD_COLUMN[field]
    const column = outputColumn(columnId)
    if (column === undefined) missing.add(`"${mapping.outputTitles[columnId]}" in the output sample`)
    return column === undefined ? [] : [{ column, value: VOLUME_VALUES[field] }]
  })
  const unmatchedFileNos = new Set<string>()
  const renamed = renamer.columns.flatMap((columnId) => {
    const column = outputColumn(columnId)
    return column === undefined ? [] : [{ columnId, column }]
  })

  picked.forEach(({ row: sourceRow, pairs, fixed, calculate }, index) => {
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
    for (const { to, value } of fixed) row.getCell(to).value = value
    if (calculate.has('Teus') && teus.to !== undefined && teus.from !== undefined) {
      row.getCell(teus.to).value = teusFromVolume(plainValue(row.getCell(teus.from).value))
    }
    if (calculate.has('Trade') && trade.to !== undefined && trade.from !== undefined) {
      row.getCell(trade.to).value = tradeFromPod(plainValue(row.getCell(trade.from).value))
    }
    const fileNo = fileNoColumn === undefined ? null : plainValue(row.getCell(fileNoColumn).value)
    if (fileNo !== null && String(fileNo).trim() !== '') {
      const info = volume.byFileNo.get(String(fileNo).trim())
      if (info) for (const { column, value } of volumeTargets) row.getCell(column).value = value(info)
      else unmatchedFileNos.add(String(fileNo).trim())
    }
    // Last, so short names apply whichever input or lookup filled the column
    for (const { columnId, column } of renamed) {
      const cell = row.getCell(column)
      cell.value = renamer.rename(columnId, cell.value) as typeof cell.value
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
