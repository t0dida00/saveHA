import { COLUMN_IDS, type ColumnId } from './mapping'

/** A value written shorter in the report, e.g. FREE CARGO → BCO */
export type ShortName = { from: string; to: string }

/** Per report column, the values it renames; Report settings edits them */
export type ShortNames = Partial<Record<ColumnId, ShortName[]>>

export const DEFAULT_SHORT_NAMES: ShortNames = {
  'Customer type': [{ from: 'FREE CARGO', to: 'BCO' }],
  Salesman: [{ from: 'Johnson Wang', to: 'CIMC' }],
}

// Values match without case or extra spaces
export const matchKey = (value: string) => value.replace(/\s+/g, ' ').trim().toUpperCase()

/** Replaces a value with its short name for that column; anything else comes back as it is */
export function createRenamer(shortNames: ShortNames) {
  const byColumn = new Map<ColumnId, Map<string, string>>()
  for (const columnId of COLUMN_IDS) {
    const rules = shortNames[columnId]
    if (rules?.length) byColumn.set(columnId, new Map(rules.map(({ from, to }) => [matchKey(from), to])))
  }
  return {
    columns: [...byColumn.keys()],
    rename: (columnId: ColumnId, value: unknown) =>
      typeof value === 'string' ? (byColumn.get(columnId)?.get(matchKey(value)) ?? value) : value,
  }
}

// "Free cargo - BCO", "FREE CARGO → BCO", "Free cargo = BCO" or two cells pasted from Excel (a tab between)
const SEPARATOR = /\t|\s*(?:→|->|=>|=)\s*|\s+-\s+/

/** Reads pasted lines, one "full name - short name" each; lines without both halves are returned as skipped */
export function parseShortNames(text: string) {
  const rules: ShortName[] = []
  const skipped: string[] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const match = SEPARATOR.exec(line)
    const from = match ? line.slice(0, match.index).trim() : ''
    const to = match ? line.slice(match.index + match[0].length).trim() : ''
    if (from && to) rules.push({ from, to })
    else skipped.push(line.trim())
  }
  return { rules, skipped }
}

/** Adds rules to a column's list; a value already there takes the new short name */
export function addShortNames(list: ShortName[], added: ShortName[]) {
  const next = [...list]
  for (const rule of added) {
    const index = next.findIndex(({ from }) => matchKey(from) === matchKey(rule.from))
    if (index === -1) next.push(rule)
    else next[index] = rule
  }
  return next
}

/** Saved short names checked for shape; anything malformed is dropped */
export function normalizeShortNames(stored: unknown): ShortNames {
  if (typeof stored !== 'object' || stored === null) return DEFAULT_SHORT_NAMES
  const lists = stored as Record<string, unknown>
  const result: ShortNames = {}
  for (const columnId of COLUMN_IDS) {
    const list = lists[columnId]
    if (!Array.isArray(list)) continue
    const rules = list.filter(
      (rule): rule is ShortName =>
        typeof rule === 'object' &&
        rule !== null &&
        typeof rule.from === 'string' &&
        typeof rule.to === 'string' &&
        rule.from.trim() !== '' &&
        rule.to.trim() !== '',
    )
    if (rules.length > 0) result[columnId] = rules
  }
  return result
}
