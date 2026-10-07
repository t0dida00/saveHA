import { parseCsv } from './parseCsv'

export type CellDiff =
  | { kind: 'same'; value: string }
  | { kind: 'changed'; before: string; after: string }
  /** Only in the newer file */
  | { kind: 'added'; after: string }
  /** Only in the older file */
  | { kind: 'removed'; before: string }

export type DiffKind = 'same' | 'changed' | 'added' | 'removed'

export type RowDiff = {
  /** Week key, e.g. W41/2026 */
  week: string
  /** Full first cell, e.g. "W41/2026\n05/10-11/10" */
  label: string
  kind: DiffKind
  cells: CellDiff[]
}

export type ServiceColumn = {
  /** Service code, e.g. EC4 */
  code: string
  /** Full header cell, e.g. "EC4\n(CMP - HOU)" */
  label: string
  kind: 'same' | 'added' | 'removed'
}

export type CsvDiff = {
  services: ServiceColumn[]
  rows: RowDiff[]
  /** Cells that differ between the two files */
  changedCount: number
}

type Table = {
  services: { code: string; label: string }[]
  rows: Map<string, { label: string; values: Map<string, string> }>
}

const firstLine = (cell = '') => cell.split('\n')[0].trim()

// Header: "ONE", then one column per service. Rows: one per week, keyed by the first line of the first cell.
// The QueryString row holds links, not schedule data, so it is skipped.
function toTable(text: string): Table {
  const [header = [], ...rows] = parseCsv(text)
  const services = header.slice(1).map((label) => ({ code: firstLine(label), label: label.trim() }))
  const table: Table = { services, rows: new Map() }
  for (const row of rows) {
    const week = firstLine(row[0])
    if (!week || week.toLowerCase() === 'querystring') continue
    const values = new Map(services.map((service, index) => [service.code, (row[index + 1] ?? '').trim()]))
    table.rows.set(week, { label: (row[0] ?? '').trim(), values })
  }
  return table
}

// W41/2026 → 202641, so weeks sort in calendar order; anything else goes last
function weekOrder(week: string) {
  const match = week.match(/W(\d{1,2})\/(\d{4})/i)
  return match ? Number(match[2]) * 100 + Number(match[1]) : Number.MAX_SAFE_INTEGER
}

/** Lines up two schedule CSVs by week (rows) and service code (columns) and marks what changed */
export function compareCsv(beforeText: string, afterText: string): CsvDiff {
  const before = toTable(beforeText)
  const after = toTable(afterText)

  // Newer file's column order, then services only the older file has
  const beforeCodes = new Set(before.services.map((s) => s.code))
  const afterCodes = new Set(after.services.map((s) => s.code))
  const services: ServiceColumn[] = [
    ...after.services.map((s) => ({ ...s, kind: beforeCodes.has(s.code) ? ('same' as const) : ('added' as const) })),
    ...before.services.filter((s) => !afterCodes.has(s.code)).map((s) => ({ ...s, kind: 'removed' as const })),
  ]

  const weeks = [...new Set([...after.rows.keys(), ...before.rows.keys()])].sort(
    (a, b) => weekOrder(a) - weekOrder(b),
  )

  let changedCount = 0
  const rows = weeks.map((week): RowDiff => {
    const beforeRow = before.rows.get(week)
    const afterRow = after.rows.get(week)
    const cells = services.map((service): CellDiff => {
      const b = beforeRow?.values.get(service.code)
      const a = afterRow?.values.get(service.code)
      if (b === undefined && a === undefined) return { kind: 'same', value: '' }
      if (b === undefined) return { kind: 'added', after: a ?? '' }
      if (a === undefined) return { kind: 'removed', before: b }
      return a === b ? { kind: 'same', value: a } : { kind: 'changed', before: b, after: a }
    })
    const changes = cells.filter((cell) => cell.kind !== 'same').length
    changedCount += changes
    const kind: DiffKind = !beforeRow ? 'added' : !afterRow ? 'removed' : changes > 0 ? 'changed' : 'same'
    return { week, label: (afterRow ?? beforeRow)?.label ?? week, kind, cells }
  })

  return { services, rows, changedCount }
}
