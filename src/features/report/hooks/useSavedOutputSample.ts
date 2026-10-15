import { useEffect, useState } from 'react'
import { runDb } from '../utils/reportDb'

const KEY = 'outputSample'

/** The output sample, kept in this browser once added so it is there on the next visit; removing it forgets it */
export function useSavedOutputSample() {
  const [files, setFiles] = useState<File[]>([])

  useEffect(() => {
    let cancelled = false
    runDb<unknown>('files', 'readonly', (store) => store.get(KEY))
      .then((saved) => {
        if (!cancelled && saved instanceof File) setFiles((current) => (current.length > 0 ? current : [saved]))
      })
      // No storage (private window, blocked site data): the sample just has to be added each time
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const change = (next: File[]) => {
    setFiles(next)
    const saved = next[0]
    runDb<unknown>('files', 'readwrite', (store) => (saved ? store.put(saved, KEY) : store.delete(KEY))).catch(() => {})
  }

  return [files, change] as const
}
