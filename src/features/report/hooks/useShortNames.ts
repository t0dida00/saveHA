import { DEFAULT_SHORT_NAMES, normalizeShortNames } from '../utils/shortNames'
import { createLocalStore } from './createLocalStore'

const useStore = createLocalStore('saveha.report.shortNames', DEFAULT_SHORT_NAMES, normalizeShortNames)

/** Per report column, the values written shorter (e.g. FREE CARGO → BCO), kept in this browser */
export function useShortNames() {
  const { value, set } = useStore()
  return { shortNames: value, setShortNames: set }
}
