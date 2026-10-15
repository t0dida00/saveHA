import { useCallback, useEffect, useState } from 'react'
import { runDb } from '../utils/reportDb'

export type SavedReport = {
  id: string
  name: string
  /** ISO time it was created */
  createdAt: string
  rowCount: number
  /** The From–To range it covers, as yyyy-mm-dd */
  from: string
  to: string
  data: Blob
}

/** Reports kept in this browser; creating one more drops the oldest */
export const MAX_SAVED_REPORTS = 3

const newestFirst = (reports: SavedReport[]) => [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

/** The last MAX_SAVED_REPORTS reports created, newest first */
export function useSavedReports() {
  const [reports, setReports] = useState<SavedReport[]>([])

  const reload = useCallback(
    () =>
      runDb<SavedReport[]>('reports', 'readonly', (store) => store.getAll())
        .then((stored) => setReports(newestFirst(stored)))
        // No storage (private window, blocked site data): reports are only downloaded, not kept
        .catch(() => {}),
    [],
  )

  useEffect(() => {
    reload()
  }, [reload])

  const add = async (report: SavedReport) => {
    try {
      await runDb('reports', 'readwrite', (store) => store.put(report))
      const stored = newestFirst(await runDb<SavedReport[]>('reports', 'readonly', (store) => store.getAll()))
      for (const old of stored.slice(MAX_SAVED_REPORTS)) {
        await runDb('reports', 'readwrite', (store) => store.delete(old.id))
      }
    } catch {
      // Kept for this visit only
      setReports((current) => newestFirst([report, ...current]).slice(0, MAX_SAVED_REPORTS))
      return
    }
    await reload()
  }

  const remove = async (id: string) => {
    setReports((current) => current.filter((report) => report.id !== id))
    await runDb('reports', 'readwrite', (store) => store.delete(id)).catch(() => {})
  }

  return { reports, add, remove }
}
