// CSV and Excel are the only file types the Report inputs take
export const SPREADSHEET_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const

export const SPREADSHEET_ACCEPT = [
  ...SPREADSHEET_EXTENSIONS,
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',')

// Checked by extension: browsers report CSV with different (or empty) MIME types
export function isSpreadsheetFile(file: File) {
  const name = file.name.toLowerCase()
  return SPREADSHEET_EXTENSIONS.some((extension) => name.endsWith(extension))
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
