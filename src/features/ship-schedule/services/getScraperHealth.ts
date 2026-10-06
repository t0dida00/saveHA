import { readDayCache, storeDayCache } from '../utils/dayCache'
import { ScheduleApiNotConfiguredError } from './getSchedule'

const STORAGE_KEY = 'saveha.shipSchedule.scraperHealth'

export type ScraperHealth = {
  alive: boolean
  /** ISO timestamp of when the server's health check ran */
  checkedAt: string
}

/** The last answer from the API, if fetched within the last day. The check itself only runs every 3 days. */
export const readCachedScraperHealth = () => readDayCache<ScraperHealth>(STORAGE_KEY)

// The verdict of the API's last scheduled health check; reading it never starts a scrape.
// A fresh cached answer is used instead of asking the API; errors are never cached.
export async function getScraperHealth(): Promise<ScraperHealth> {
  const cached = readCachedScraperHealth()
  if (cached) return cached
  if (!__HOST_URL__) throw new ScheduleApiNotConfiguredError()

  const response = await fetch(`${__HOST_URL__}/schedules/one/healthCheck/latest`)
  if (response.status === 404) throw new Error("The scraper hasn't been checked yet.")
  if (!response.ok) throw new Error(`Schedule API returned ${response.status} ${response.statusText}`)
  const health: ScraperHealth = await response.json()
  storeDayCache(STORAGE_KEY, health)
  return health
}
