import { DEFAULT_MAPPING, normalizeMapping } from '../utils/mapping'
import { createLocalStore } from './createLocalStore'

const useStore = createLocalStore('saveha.report.mapping', DEFAULT_MAPPING, normalizeMapping)

/** The column mapping the report is built with, kept in this browser */
export function useReportMapping() {
  const { value, set } = useStore()
  return { mapping: value, setMapping: set }
}
