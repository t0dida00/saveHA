import { useEffect, useState } from 'react'

// The output sample is a binary file, so it lives in IndexedDB rather than localStorage
const DB_NAME = 'saveha.report'
const STORE = 'files'
const KEY = 'outputSample'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result as T)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

/** The output sample, kept in this browser once added so it is there on the next visit; removing it forgets it */
export function useSavedOutputSample() {
  const [files, setFiles] = useState<File[]>([])

  useEffect(() => {
    let cancelled = false
    run<unknown>('readonly', (store) => store.get(KEY))
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
    run<unknown>('readwrite', (store) => (saved ? store.put(saved, KEY) : store.delete(KEY))).catch(() => {})
  }

  return [files, change] as const
}
