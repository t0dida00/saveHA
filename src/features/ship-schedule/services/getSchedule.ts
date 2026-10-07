import { SERVICES, toWebsiteCode, type Carrier } from '../data/services'
import type { ScheduleFile, ScheduleSelection } from '../types'
import { mergeHplSchedules, type HplRouteSchedule } from '../utils/mergeHplSchedules'
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
export function getSchedule(carrier: Carrier, selection: ScheduleSelection): Promise<ScheduleFile> {
  return carrier === 'hpl' ? getHplSchedule(selection) : getOneSchedule(selection)
}

async function getOneSchedule(selection: ScheduleSelection): Promise<ScheduleFile> {
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

/** POST /schedules/hpl/weekly body: one port pair, by UN/LOCODE */
type HplScheduleRequest = { date: string; next: number; from: string; to: string }

async function fetchHplRoute(request: HplScheduleRequest) {
  const response = await fetch(`${__HOST_URL__}/schedules/hpl/weekly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (response.status === 503) throw new Error("Hapag-Lloyd isn't set up on the schedule API yet (its HLAG_* settings).")
  if (!response.ok) throw new Error(`Schedule API returned ${response.status} ${response.statusText}`)
  return { fileName: fileNameFrom(response.headers.get('Content-Disposition')), csv: await response.text() }
}

/**
 * Hapag-Lloyd's API answers per port pair with every service on it, so each distinct route
 * (first origin → first destination) is asked once and the answers are merged into one file
 * with only the chosen services, in the order the card lists them.
 */
async function getHplSchedule(selection: ScheduleSelection): Promise<ScheduleFile> {
  if (!__HOST_URL__) throw new ScheduleApiNotConfiguredError()

  const routes = selection.services.map((route) => {
    const [origin, destination] = [route.origins[0], route.destinations[0]]
    const from = toWebsiteCode(origin)
    const to = toWebsiteCode(destination)
    if (!from || !to) throw new MissingWebsiteCodeError(route.code, from ? destination : origin)
    return { code: route.code, origin, destination, from, to }
  })

  const pairs = [...new Set(routes.map(({ from, to }) => `${from}-${to}`))]
  const answers = new Map(
    await Promise.all(
      pairs.map(async (pair) => {
        const [from, to] = pair.split('-')
        const answer = await fetchHplRoute({ date: selection.startDate, next: selection.weeks, from, to })
        return [pair, answer] as const
      }),
    ),
  )

  const schedules: HplRouteSchedule[] = routes.map((route) => ({
    ...route,
    csv: answers.get(`${route.from}-${route.to}`)?.csv ?? '',
  }))
  const createdAt = new Date()
  return {
    id: newFileId(createdAt),
    name: answers.values().next().value?.fileName ?? `HPL-${selection.startDate}.csv`,
    createdAt: createdAt.toISOString(),
    date: selection.startDate,
    weeks: selection.weeks,
    services: routes.map((route) => route.code),
    content: mergeHplSchedules(schedules),
  }
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
