import { getPortCodes, type PortCode } from './portCodesStore'

export type Carrier = 'one' | 'hpl'

export type Service = {
  code: string
  origins: string[]
  destinations: string[]
}

const ONE_SERVICES: Service[] = [
  { code: 'PS7', origins: ['HPH', 'VUT'], destinations: ['LAX', 'LGB', 'OAK'] },
  { code: 'MS2', origins: ['VUT'], destinations: ['LGB', 'OAK'] },
  { code: 'PS3', origins: ['VUT', 'HPH'], destinations: ['LAX', 'LGB', 'OAK'] },
  { code: 'AP1', origins: ['HPH', 'VUT'], destinations: ['LAX', 'OAK'] },
  { code: 'PN2', origins: ['VUT'], destinations: ['TIW', 'VAN'] },
  { code: 'VSE', origins: ['VUT', 'HPH'], destinations: ['LAX', 'LGB'] },
  { code: 'FP2', origins: ['VUT', 'HPH'], destinations: ['VAN', 'TIW'] },
  { code: 'PN3', origins: ['HPH'], destinations: ['VAN', 'TIW'] },
  { code: 'EC5', origins: ['VUT'], destinations: ['HAF', 'NYC', 'SAV', 'JAK', 'ORF', 'CHS'] },
  { code: 'EC3', origins: ['VUT'], destinations: ['ORF', 'CHS', 'SAV', 'NYC', 'JAX'] },
  { code: 'EC2', origins: ['VUT'], destinations: ['ORF', 'CHS', 'SAV', 'NYC', 'HAL'] },
  { code: 'EC4', origins: ['VUT'], destinations: ['HOU', 'MOB'] },
]

// HPL_VUT: Hapag-Lloyd's own code for VUT (see Settings); the other ports share ONE's codes
const HPL_SERVICES: Service[] = [
  { code: 'AA7', origins: ['HPL_VUT'], destinations: ['NYC', 'ORF', 'CHS', 'SAV'] },
  { code: 'US4', origins: ['HPL_VUT'], destinations: ['NYC', 'ORF', 'CHS', 'SAV'] },
  { code: 'WC1', origins: ['HPL_VUT'], destinations: ['LAX', 'LGB'] },
]

export const SERVICES: Record<Carrier, Service[]> = { one: ONE_SERVICES, hpl: HPL_SERVICES }

const SERVICES_BY_CODE: Record<Carrier, Map<string, Service>> = {
  one: new Map(ONE_SERVICES.map((service) => [service.code, service])),
  hpl: new Map(HPL_SERVICES.map((service) => [service.code, service])),
}

export function findService(carrier: Carrier, code: string | undefined) {
  return code ? SERVICES_BY_CODE[carrier].get(code) : undefined
}

// Works for a catalogue service or a user's route; a side with no ports shows as "—"
export function formatRoute({ origins, destinations }: Pick<Service, 'origins' | 'destinations'>) {
  return `${origins.join('/') || '—'} → ${destinations.join('/') || '—'}`
}

// True when the route has exactly the service's own ports, in any order
export function isDefaultRoute(carrier: Carrier, route: Pick<Service, 'code' | 'origins' | 'destinations'>) {
  const service = findService(carrier, route.code)
  if (!service) return true
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((port) => b.includes(port))
  return same(route.origins, service.origins) && same(route.destinations, service.destinations)
}

// Every port any carrier's services use by default, for Settings to flag ports that have no website code
export const ALL_PORTS = [
  ...new Set(Object.values(SERVICES).flatMap((list) => list.flatMap((service) => [...service.origins, ...service.destinations]))),
]

/** VUT for HPL_VUT: the plain port, as written in a file's column headers */
export const plainPort = (port: string) => port.replace(/^[A-Z]+_/, '')

// Ports a card offers on one row, in Settings order: codes ticked "Origin" go on the Origin row, all others on
// the Destination row. Every card lists every port, carrier rows like HPL_VUT included.
// Ports the route already has stay listed even if Settings moved or removed them.
export function portChoices(side: 'origins' | 'destinations', selected: string[] = [], codes = getPortCodes()) {
  const onSide = codes.filter((entry) => (side === 'origins' ? entry.isOrigin : !entry.isOrigin))
  return [...new Set([...onSide.map((entry) => entry.code), ...selected])]
}

// Website code of a port, e.g. VUT → VNCMP, HPL_VUT → VNVUT. The codes are edited in Settings.
export function toWebsiteCode(port?: string, codes: PortCode[] = getPortCodes()): string | undefined {
  return port ? codes.find((entry) => entry.code === port)?.websiteCode || undefined : undefined
}

// Website codes of the first origin and first destination, e.g. "VNCMP - USNYC"
export function formatWebsiteCodes(
  { origins, destinations }: Pick<Service, 'origins' | 'destinations'>,
  codes = getPortCodes(),
) {
  return `${toWebsiteCode(origins[0], codes) ?? '—'} - ${toWebsiteCode(destinations[0], codes) ?? '—'}`
}
