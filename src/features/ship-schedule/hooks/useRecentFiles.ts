import { useCallback, useState } from 'react'
import type { ScheduleFile } from '../types'

const STORAGE_KEY = 'saveha.shipSchedule.files'
export const MAX_FILES = 10

function newestFirst(files: ScheduleFile[]) {
  return [...files].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function loadFiles(): ScheduleFile[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(stored) ? newestFirst(stored).slice(0, MAX_FILES) : []
  } catch {
    return []
  }
}

// If storage is full, drop the oldest files until the rest fit
function storeFiles(files: ScheduleFile[]) {
  for (let count = files.length; count >= 0; count--) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(files.slice(0, count)))
      return
    } catch {
      // Try again with one file fewer
    }
  }
}

/** The last MAX_FILES CSV files returned by the schedule API, newest first, kept in this browser */
export function useRecentFiles() {
  const [files, setFiles] = useState(loadFiles)

  const addFile = useCallback((file: ScheduleFile) => {
    setFiles((current) => {
      const next = newestFirst([file, ...current]).slice(0, MAX_FILES)
      storeFiles(next)
      return next
    })
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles((current) => {
      const next = current.filter((file) => file.id !== id)
      storeFiles(next)
      return next
    })
  }, [])

  return { files, addFile, removeFile }
}
