const DAY_MS = 24 * 60 * 60 * 1000

type Cached<T> = {
  /** ISO timestamp of when the value was stored */
  storedAt: string
  value: T
}

/** A value stored under `key` within the last day, or undefined */
export function readDayCache<T>(key: string, now = Date.now()): T | undefined {
  try {
    const cached: Cached<T> | null = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!cached || cached.value == null) return undefined
    return now - Date.parse(cached.storedAt) < DAY_MS ? cached.value : undefined
  } catch {
    return undefined
  }
}

export function storeDayCache<T>(key: string, value: T) {
  try {
    const cached: Cached<T> = { storedAt: new Date().toISOString(), value }
    localStorage.setItem(key, JSON.stringify(cached))
  } catch {
    // Storage full or blocked: the next visit fetches again
  }
}
