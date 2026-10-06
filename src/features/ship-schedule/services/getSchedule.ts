import { SERVICES, toWebsiteCode } from '../data/services'
import type { ScheduleFile, ScheduleSelection } from '../types'

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
  const allServices = selection.services.length === SERVICES.length
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

export class NoLatestScheduleError extends Error {
  constructor() {
    super("The scheduled job hasn't made a file yet.")
    this.name = 'NoLatestScheduleError'
  }
}

// The newest CSV made by the API's scheduled job
export async function getLatestSchedule(): Promise<ScheduleFile> {
  if (!__HOST_URL__) throw new ScheduleApiNotConfiguredError()

  const response = await fetch(`${__HOST_URL__}/schedules/one/weekly/latest`)
  if (response.status === 404) throw new NoLatestScheduleError()
  if (!response.ok) throw new Error(`Schedule API returned ${response.status} ${response.statusText}`)

  const createdAt = new Date()
  return {
    id: newFileId(createdAt),
    name: fileNameFrom(response.headers.get('Content-Disposition')) ?? 'ONE-latest.csv',
    createdAt: createdAt.toISOString(),
    scheduled: true,
    content: await response.text(),
  }
}
