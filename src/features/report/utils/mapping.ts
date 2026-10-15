// The column mapping the report is read and written with. Report settings edits it and it is kept in this browser.
// Every column is found by its title, so the titles here are what gets matched in the files.

/** The report's columns, in the output sample's order. Each id is also the column's default title */
export const COLUMN_IDS = [
  'Shipment Type',
  'Account name',
  'Customer type',
  'Salesman',
  'Office',
  'MBL#',
  'Booking#',
  'ETD',
  'ETA',
  'POL',
  'POD',
  'Destination',
  'Carrier',
  'Volume',
  'Teus',
  'SOC',
  'S/C',
  'Trade',
  'MV',
  'Vouye',
  'Cont#',
  'Own or Coload',
  'OP',
  'File No.',
] as const

export type ColumnId = (typeof COLUMN_IDS)[number]

export const INPUT_IDS = ['seaExport', 'seaImport', 'airExport', 'airImport'] as const

export type InputId = (typeof INPUT_IDS)[number]

/** Export files are filtered by their ETD column, import files by their ETA column */
export const INPUT_INFO: Record<InputId, { name: string; dateColumn: ColumnId }> = {
  seaExport: { name: 'Sea Export', dateColumn: 'ETD' },
  seaImport: { name: 'Sea Import', dateColumn: 'ETA' },
  airExport: { name: 'Air Export', dateColumn: 'ETD' },
  airImport: { name: 'Air Import', dateColumn: 'ETA' },
}

/** Copy from the first of these titles the file has, or write the same value on every row */
export type Rule = { titles: string[] } | { value: string | number }

export type VolumeField = 'fileNo' | 'shippingType' | 'customer' | 'salesType' | 'salesPerson' | 'coLoader'

/** The report column each Volume field fills; File No. is the key the lookup matches on */
export const VOLUME_FIELD_COLUMN: Record<VolumeField, ColumnId> = {
  fileNo: 'File No.',
  shippingType: 'Shipment Type',
  customer: 'Account name',
  salesType: 'Customer type',
  salesPerson: 'Salesman',
  coLoader: 'Own or Coload',
}

/** Columns the Volume lookup fills, so the Sea and Air inputs leave them alone */
export const LOOKUP_COLUMNS = (Object.keys(VOLUME_FIELD_COLUMN) as VolumeField[])
  .filter((field) => field !== 'fileNo')
  .map((field) => VOLUME_FIELD_COLUMN[field])

/** Columns worked out from another report column when an input does not map them itself */
export const CALCULATED: Partial<Record<ColumnId, { from: ColumnId; note: string }>> = {
  Teus: { from: 'Volume', note: '20xx = 1, 40xx and 45xx = 2' },
  Trade: { from: 'POD', note: 'TP, EU, Asia or Other' },
}

export type ReportMapping = {
  /** The title each report column has in the output sample */
  outputTitles: Record<ColumnId, string>
  /** What each input fills each report column with; a column with no rule is left empty */
  inputs: Record<InputId, Partial<Record<ColumnId, Rule>>>
  /** The Volume report title each field is read from */
  volume: Record<VolumeField, string>
}

const copy = (...titles: string[]): Rule => ({ titles })

const SEA_COMMON: Partial<Record<ColumnId, Rule>> = {
  Office: copy('Office'),
  'MBL#': copy('MB/L No.'),
  ETD: copy('ETD'),
  ETA: copy('ETA'),
  POL: copy('Port of Loading'),
  Carrier: copy('Carrier'),
  Volume: copy('Container/Qty'),
  SOC: copy('Ship Mode'),
  'S/C': copy('Carrier Contract No.'),
  MV: copy('Vessel'),
  Vouye: copy('Voyage'),
  'Cont#': copy('Container No.'),
  OP: copy('OP'),
  'File No.': copy('File No.'),
}

// Air Export lists name the MAWB column "MB/L No."; air has no containers or contracts
const AIR: Partial<Record<ColumnId, Rule>> = {
  Office: copy('Office'),
  'MBL#': copy('MAWB No.', 'MB/L No.'),
  'Booking#': copy('MAWB No.', 'MB/L No.'),
  ETD: copy('ETD'),
  ETA: copy('ETA'),
  POL: copy('Departure'),
  POD: copy('Destination'),
  Destination: copy('Destination'),
  Carrier: copy('Carrier'),
  Volume: { value: 'XX' },
  Teus: { value: 0 },
  'S/C': { value: 'N/A' },
  MV: copy('Flight No.'),
  Vouye: copy('Flight No.'),
  OP: copy('OP'),
  'File No.': copy('File No.'),
}

export const DEFAULT_MAPPING: ReportMapping = {
  outputTitles: Object.fromEntries(COLUMN_IDS.map((id) => [id, id])) as Record<ColumnId, string>,
  inputs: {
    seaExport: {
      ...SEA_COMMON,
      'Booking#': copy('Carrier Bkg. No.'),
      POD: copy('Port of Discharge'),
      Destination: copy('Place of Delivery'),
    },
    seaImport: {
      ...SEA_COMMON,
      'Booking#': copy('MB/L No.'),
      POD: copy('Place of Delivery'),
      Destination: copy('Final Destination'),
    },
    // Copies, so editing one never changes the other
    airExport: { ...AIR },
    airImport: { ...AIR },
  },
  volume: {
    fileNo: 'File No.',
    shippingType: 'Shipping Type',
    customer: 'Customer',
    salesType: 'Sales Type',
    salesPerson: 'Sales Person',
    coLoader: 'Co-Loader',
  },
}

/** How a rule is typed in a cell: titles joined by "or", a fixed value in quotes, nothing for empty */
export function ruleText(rule: Rule | undefined) {
  if (!rule) return ''
  return 'titles' in rule ? rule.titles.join(' or ') : `"${rule.value}"`
}

/** Reads what was typed in a cell; a quoted number like "0" is written as a number */
export function parseRule(text: string): Rule | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  const quoted = /^"(.*)"$/.exec(trimmed)
  if (quoted) {
    const value = quoted[1]
    return { value: /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value }
  }
  const titles = trimmed
    .split(/\s+or\s+/i)
    .map((title) => title.trim())
    .filter(Boolean)
  return { titles }
}

const isRule = (value: unknown): value is Rule => {
  if (typeof value !== 'object' || value === null) return false
  if ('titles' in value) return Array.isArray(value.titles) && value.titles.every((title) => typeof title === 'string')
  return 'value' in value && (typeof value.value === 'string' || typeof value.value === 'number')
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** A saved mapping checked against the current columns; anything missing or malformed falls back to the default */
export function normalizeMapping(stored: unknown): ReportMapping {
  if (!isRecord(stored)) return DEFAULT_MAPPING
  const titles = isRecord(stored.outputTitles) ? stored.outputTitles : {}
  const inputs = isRecord(stored.inputs) ? stored.inputs : {}
  const volume = isRecord(stored.volume) ? stored.volume : {}

  const text = (value: unknown, fallback: string) =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback

  return {
    outputTitles: Object.fromEntries(
      COLUMN_IDS.map((id) => [id, text(titles[id], DEFAULT_MAPPING.outputTitles[id])]),
    ) as Record<ColumnId, string>,
    inputs: Object.fromEntries(
      INPUT_IDS.map((id) => {
        const rules = inputs[id]
        if (!isRecord(rules)) return [id, DEFAULT_MAPPING.inputs[id]]
        return [id, Object.fromEntries(COLUMN_IDS.filter((column) => isRule(rules[column])).map((c) => [c, rules[c]]))]
      }),
    ) as ReportMapping['inputs'],
    volume: Object.fromEntries(
      (Object.keys(DEFAULT_MAPPING.volume) as VolumeField[]).map((field) => [
        field,
        text(volume[field], DEFAULT_MAPPING.volume[field]),
      ]),
    ) as Record<VolumeField, string>,
  }
}
