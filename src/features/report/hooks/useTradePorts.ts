import { DEFAULT_TRADE_PORTS, normalizeTradePorts } from '../utils/trade'
import { createLocalStore } from './createLocalStore'

const useStore = createLocalStore('saveha.report.tradePorts', DEFAULT_TRADE_PORTS, normalizeTradePorts)

/** The TP, EU, Asia and Other port lists the Trade column is worked out with, kept in this browser */
export function useTradePorts() {
  const { value, set } = useStore()
  return { ports: value, setPorts: set }
}
