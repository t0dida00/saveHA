import { useSyncExternalStore } from 'react'
import defaultPortCodes from './portCodes.json'

/**
 * A port (HPH), the code the ONE website uses for it (VNHPH), and which card row it appears in.
 * A carrier whose code differs has its own row, prefixed with the carrier: HPL/VUT → VNVUT.
 */
export type PortCode = {
  code: string
  websiteCode: string
  /** true: listed under Origin on the service cards. false: listed under Destination. */
  isOrigin: boolean
}

const STORAGE_KEY = 'saveha.shipSchedule.portCodes'

export const DEFAULT_PORT_CODES: PortCode[] = defaultPortCodes

const isPortCode = (value: unknown): value is PortCode =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PortCode).code === 'string' &&
  typeof (value as PortCode).websiteCode === 'string'

// Saves from before Hapag-Lloyd had no HPL/ rows; without them HPL would search with ONE's codes
function withCarrierDefaults(codes: PortCode[]): PortCode[] {
  if (codes.some((entry) => entry.code.startsWith('HPL/'))) return codes
  return [...codes, ...DEFAULT_PORT_CODES.filter((entry) => entry.code.startsWith('HPL/'))]
}

// Saved codes from Settings, or the defaults from portCodes.json.
// Older saves were a { code: websiteCode } map; their origin flags come from the defaults.
function load(): PortCode[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (Array.isArray(stored)) {
      return withCarrierDefaults(
        stored.filter(isPortCode).map((entry) => ({ ...entry, isOrigin: Boolean(entry.isOrigin) })),
      )
    }
    if (stored && typeof stored === 'object') {
      return withCarrierDefaults(
        Object.entries(stored as Record<string, string>).map(([code, websiteCode]) => ({
          code,
          websiteCode,
          isOrigin: DEFAULT_PORT_CODES.some((entry) => entry.code === code && entry.isOrigin),
        })),
      )
    }
  } catch {
    // Fall back to the defaults
  }
  return DEFAULT_PORT_CODES
}

let current = load()
const listeners = new Set<() => void>()

export function getPortCodes() {
  return current
}

/** Returns false when storage is unavailable; the codes still apply until the page reloads */
export function setPortCodes(codes: PortCode[]) {
  current = codes
  listeners.forEach((listener) => listener())
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(codes))
    return true
  } catch {
    return false
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Current port codes; re-renders when Settings saves new ones */
export function usePortCodes() {
  return useSyncExternalStore(subscribe, getPortCodes)
}
