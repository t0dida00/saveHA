import type { ScheduleFile } from '../types'

/** Saves the CSV with its server filename */
export function downloadFile(file: ScheduleFile) {
  const url = URL.createObjectURL(new Blob([file.content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
}
