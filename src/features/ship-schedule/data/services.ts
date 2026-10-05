import { getPortCodes, type PortCode } from './portCodesStore'

export type Service = {
  code: string
  origins: string[]
  destinations: string[]
}

export const SERVICES: Service[] = [
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

export const SERVICES_BY_CODE = new Map(SERVICES.map((service) => [service.code, service]))

// Works for a catalogue service or a user's route; a side with no ports shows as "—"
export function formatRoute({ origins, destinations }: Pick<Service, 'origins' | 'destinations'>) {
  return `${origins.join('/') || '—'} → ${destinations.join('/') || '—'}`
}

// True when the route has exactly the service's own ports, in any order
export function isDefaultRoute(route: Pick<Service, 'code' | 'origins' | 'destinations'>) {
  const service = SERVICES_BY_CODE.get(route.code)
  if (!service) return true
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((port) => b.includes(port))
  return same(route.origins, service.origins) && same(route.destinations, service.destinations)
}

// Every port the services use by default, for Settings to flag ports that have no website code
export const ALL_PORTS = [...new Set(SERVICES.flatMap((service) => [...service.origins, ...service.destinations]))]

// Ports a card offers on one row, in Settings order: codes ticked "Origin" go on the Origin row, all others on
// the Destination row. Ports the route already has stay listed even if Settings moved or removed them.
export function portChoices(side: 'origins' | 'destinations', selected: string[] = [], codes = getPortCodes()) {
  const onSide = codes.filter((entry) => (side === 'origins' ? entry.isOrigin : !entry.isOrigin))
  return [...new Set([...onSide.map((entry) => entry.code), ...selected])]
}

// Website code of a port, e.g. VUT → VNCMP. The codes are edited in Settings.
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
