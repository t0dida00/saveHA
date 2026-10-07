import { findService, SERVICES, toWebsiteCode } from '../data/services'
import { cmaSearchHash, type CmaRoute } from '../utils/cmaBookmarklet'
import type { ScheduleFile, ScheduleSelection } from '../types'
import { readCachedLatest, storeCachedLatest } from './latestScheduleCache'

export class ScheduleApiNotConfiguredError extends Error {
  constructor() {
    super("Schedule API isn't connected yet. Set HOST_URL in .env and restart the dev server.")
    this.name = 'ScheduleApiNotConfiguredError'
  }
}

export class MissingWebsiteCodeError extends Error {
  constructor(service: string, port: string) {
    super(`${service}: ${port} has no website code. Add it in Settings.`)
    this.name = 'MissingWebsiteCodeError'
  }
}

type WeeklyScheduleRequest = {
  /** YYYY-MM-DD */
  date: string
  /** Weeks ahead of date */
  next: number
  /** "all": every service on its default route. Otherwise one route per service, by website code. */
  services_routes: 'all' | Record<string, { from: string; to: string }>
}

// Each service is searched on its first selected origin and first selected destination
export function toScheduleRequest(selection: ScheduleSelection): WeeklyScheduleRequest {
  const allServices = selection.services.length === SERVICES.one.length
  const services_routes = allServices
    ? 'all'
    : Object.fromEntries(
        selection.services.map((route) => {
          const [origin, destination] = [route.origins[0], route.destinations[0]]
          const from = toWebsiteCode(origin)
          const to = toWebsiteCode(destination)
          if (!from || !to) throw new MissingWebsiteCodeError(route.code, from ? destination : origin)
          return [route.code, { from, to }]
        }),
      )
  return { date: selection.startDate, next: selection.weeks, services_routes }
}

// e.g. attachment; filename="ONE-06102026.csv"
function fileNameFrom(disposition: string | null) {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  return match ? decodeURIComponent(match[1]) : undefined
}

function newFileId(createdAt: Date) {
  return `${createdAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`
}

// The API answers with a CSV file (text/csv, named by Content-Disposition)
export async function getSchedule(selection: ScheduleSelection): Promise<ScheduleFile> {
  if (!__HOST_URL__) throw new ScheduleApiNotConfiguredError()

  const request = toScheduleRequest(selection)
  const response = await fetch(`${__HOST_URL__}/schedules/one/weekly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(`Schedule API returned ${response.status} ${response.statusText}`)

  const createdAt = new Date()
  return {
    id: newFileId(createdAt),
    name: fileNameFrom(response.headers.get('Content-Disposition')) ?? `ONE-${request.date}.csv`,
    createdAt: createdAt.toISOString(),
    date: request.date,
    weeks: request.next,
    services: request.services_routes === 'all' ? 'all' : Object.keys(request.services_routes),
    content: await response.text(),
  }
}

/** A carrier's schedule search for one POL → POD, and the services that use it */
export type SearchLink = {
  /** POL-POD website codes, e.g. VNVUT-USNYC: one link per pair */
  key: string
  codes: string[]
  /** Ports as the card names them, e.g. HPL_VUT and NYC */
  origin: string
  destination: string
  /** Their website codes, e.g. VNVUT and USNYC: what a pasted result names */
  from: string
  to: string
  url: string
}

type LinkCarrier = 'hpl' | 'cma'

/** A service's code as cma-cgm.com writes it, e.g. PEARLAS1 for PEARL */
export const cmaSiteCode = (code: string) => findService('cma', code)?.siteCode ?? code

/**
 * CMA CGM's routing finder with routes for the Fill CMA search bookmark to search, one after another.
 * The routes name their services by CMA's own codes, the ones its Routing solutions filter shows.
 */
export const cmaSearchUrl = (routes: CmaRoute[], date: string) =>
  `https://www.cma-cgm.com/ebusiness/schedules${cmaSearchHash(
    routes.map((route) => ({ ...route, codes: route.codes.map(cmaSiteCode) })),
    date,
  )}`

// Each carrier's search page for a POL → POD from a date
const SEARCH_URLS: Record<LinkCarrier, (from: string, to: string, date: string, weeks: number) => string> = {
  hpl: (from, to, date) =>
    'https://www.hapag-lloyd.com/solutions/schedule/#/?' +
    `sl=${from}&el=${to}&exportHaulage=MH&importHaulage=MH&containerType=45GP` +
    `&departureDate=${date}&usFlag=false&dg=false&reefer`,
  // The routing finder searches by form, not URL: the hash carries the route for the Fill CMA search bookmark
  cma: (from, to, date) => cmaSearchUrl([{ from, to, codes: [] }], date),
}

/**
 * Hapag-Lloyd's and CMA CGM's sites block automated browsers, so their schedules aren't fetched: each
 * service gets a link to the carrier's search for its first origin → first destination, from the start
 * date. Services with the same POL and POD share one link, in the order the card lists them.
 */
export function searchLinks(carrier: LinkCarrier, selection: ScheduleSelection): SearchLink[] {
  const links = new Map<string, SearchLink>()
  for (const route of selection.services) {
    const [origin, destination] = [route.origins[0], route.destinations[0]]
    const from = toWebsiteCode(origin)
    const to = toWebsiteCode(destination)
    if (!from || !to) throw new MissingWebsiteCodeError(route.code, from ? destination : origin)
    const key = `${from}-${to}`
    const link = links.get(key)
    if (link) link.codes.push(route.code)
    else {
      const url = SEARCH_URLS[carrier](from, to, selection.startDate, selection.weeks)
      links.set(key, { key, codes: [route.code], origin, destination, from, to, url })
    }
  }
  // CMA CGM's link names its services, so the fill bookmark can say which search it's on
  if (carrier === 'cma') for (const link of links.values()) link.url = cmaSearchUrl([link], selection.startDate)
  return [...links.values()]
}

export class NoLatestScheduleError extends Error {
  constructor() {
    super("The scheduled job hasn't made a file yet.")
    this.name = 'NoLatestScheduleError'
  }
}

/**
 * The newest CSV made by the API's scheduled job. Every fetch refreshes the 1-day cache;
 * `cached: true` answers from that cache when it's fresh instead of asking the API.
 */
export async function getLatestSchedule({ cached = false } = {}): Promise<ScheduleFile> {
  const fromCache = cached ? readCachedLatest() : undefined
  if (fromCache) return fromCache

  if (!__HOST_URL__) throw new ScheduleApiNotConfiguredError()

  const response = await fetch(`${__HOST_URL__}/schedules/one/weekly/latest`)
  if (response.status === 404) throw new NoLatestScheduleError()
  if (!response.ok) throw new Error(`Schedule API returned ${response.status} ${response.statusText}`)

  const createdAt = new Date()
  const file: ScheduleFile = {
    id: newFileId(createdAt),
    name: fileNameFrom(response.headers.get('Content-Disposition')) ?? 'ONE-latest.csv',
    createdAt: createdAt.toISOString(),
    scheduled: true,
    content: await response.text(),
  }
  storeCachedLatest(file)
  return file
}
