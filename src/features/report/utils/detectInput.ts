import { headerColumns, loadWorkbook, normalize, plainValue } from './excel'

export type InputSlot = 'seaImport' | 'seaExport' | 'airImport' | 'airExport' | 'volume' | 'outputSample'

// Names like AIR-EXPORT, Air_Import, SEA EXPORT, OceanImport, Volume_10-07-2026
const NAME_PATTERNS: [RegExp, InputSlot][] = [
  [/\bAIR ?EXPORT\b/, 'airExport'],
  [/\bAIR ?IMPORT\b/, 'airImport'],
  [/\b(SEA|OCEAN) ?EXPORT\b/, 'seaExport'],
  [/\b(SEA|OCEAN) ?IMPORT\b/, 'seaImport'],
  [/\bVOLUME\b/, 'volume'],
]

function slotFromName(fileName: string): InputSlot | null {
  const name = fileName
    .replace(/\.[^.]+$/, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
  return NAME_PATTERNS.find(([pattern]) => pattern.test(name))?.[1] ?? null
}

// File Nos look like SGNOE-26100158: OE sea export, OI sea import, AE air export, AI air import
const FILE_NO_KINDS: Record<string, InputSlot> = { OE: 'seaExport', OI: 'seaImport', AE: 'airExport', AI: 'airImport' }
const FILE_NO = /^[A-Z]{3}(OE|OI|AE|AI)-/

const HEADER_SEARCH_ROWS = 30

// Titles only the output sample has
const OUTPUT_SAMPLE_TITLES = ['MBL#', 'Teus', 'Own or Coload'].map(normalize)

// Reads the sheet: the output sample or a Volume report by its titles, otherwise the kind most of its File Nos have
async function slotFromContent(file: File): Promise<InputSlot | null> {
  const sheet = (await loadWorkbook(file)).worksheets[0]
  const firstRow = headerColumns(sheet)
  if (OUTPUT_SAMPLE_TITLES.every((title) => firstRow.has(title))) return 'outputSample'
  for (let r = 1; r <= Math.min(sheet.rowCount, HEADER_SEARCH_ROWS); r++) {
    const columns = headerColumns(sheet, r)
    const fileNoColumn = columns.get(normalize('File No.'))
    if (fileNoColumn === undefined) continue
    if (columns.has(normalize('Shipping Type')) && columns.has(normalize('Co-Loader'))) return 'volume'

    const counts = new Map<InputSlot, number>()
    for (let row = r + 1; row <= sheet.rowCount; row++) {
      const match = FILE_NO.exec(String(plainValue(sheet.getRow(row).getCell(fileNoColumn).value) ?? '').trim())
      if (match) counts.set(FILE_NO_KINDS[match[1]], (counts.get(FILE_NO_KINDS[match[1]]) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }
  return null
}

/** Which input a file is: by its name when that says, otherwise by what is in it; null when neither tells */
export async function detectInput(file: File): Promise<InputSlot | null> {
  const byName = slotFromName(file.name)
  if (byName) return byName
  try {
    return await slotFromContent(file)
  } catch {
    return null
  }
}
