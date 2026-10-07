import { useSyncExternalStore } from 'react'
import type { ScheduleFile } from '../types'
import { fileCarrier } from '../utils/fileCarrier'

const STORAGE_KEY = 'saveha.shipSchedule.files'
/** Kept per carrier, so one carrier's files never push out the other's */
export const MAX_FILES = 10

// Newest first, at most MAX_FILES of each carrier
function newestFirst(files: ScheduleFile[]) {
  const counts = { one: 0, hpl: 0, cma: 0 }
  return [...files]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((file) => ++counts[fileCarrier(file)] <= MAX_FILES)
}

function loadFiles(): ScheduleFile[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(stored) ? newestFirst(stored) : []
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

// One list shared by every page (Results, the Dashboard), so a change shows everywhere at once
let current = loadFiles()
const listeners = new Set<() => void>()

function setFiles(next: ScheduleFile[]) {
  current = next
  storeFiles(next)
  listeners.forEach((listener) => listener())
}

const getFiles = () => current

// Other tabs and the installed app window write the same key; follow their changes too
function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY && event.key !== null) return
  current = loadFiles()
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

function addFile(file: ScheduleFile) {
  setFiles(newestFirst([file, ...current]))
}

function removeFile(id: string) {
  setFiles(current.filter((file) => file.id !== id))
}

/** The last MAX_FILES schedule CSVs of each carrier, newest first, kept in this browser */
export function useRecentFiles() {
  const files = useSyncExternalStore(subscribe, getFiles)
  return { files, addFile, removeFile }
}
