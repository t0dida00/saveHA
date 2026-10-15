// Binary files (the output sample, created reports) live in IndexedDB rather than localStorage
const DB_NAME = 'saveha.report'
// Version 2 added the reports store; files (the output sample) is kept from version 1
const DB_VERSION = 2

export type StoreName = 'files' | 'reports'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files')
      if (!db.objectStoreNames.contains('reports')) db.createObjectStore('reports', { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Runs one request on a store and resolves with its result */
export async function runDb<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(store, mode).objectStore(store))
      request.onsuccess = () => resolve(request.result as T)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}
