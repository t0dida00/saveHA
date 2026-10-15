import { useSyncExternalStore } from 'react'

/**
 * A value kept in localStorage and shared by every component that reads it, so an edit in Report settings applies
 * to the Report page at once. Other tabs and the installed app window write the same key, and are followed too.
 * Without storage (private window, blocked site data) an edit lasts until the page is reloaded.
 */
export function createLocalStore<T>(key: string, fallback: T, normalize: (stored: unknown) => T) {
  const load = (): T => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? fallback : normalize(JSON.parse(stored))
    } catch {
      return fallback
    }
  }

  let current = load()
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())

  const set = (next: T) => {
    current = next
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Kept in memory only
    }
    notify()
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== key && event.key !== null) return
    current = load()
    notify()
  }

  const subscribe = (listener: () => void) => {
    if (listeners.size === 0) window.addEventListener('storage', onStorage)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) window.removeEventListener('storage', onStorage)
    }
  }

  return function useLocalStore() {
    const value = useSyncExternalStore(subscribe, () => current)
    return { value, set }
  }
}
