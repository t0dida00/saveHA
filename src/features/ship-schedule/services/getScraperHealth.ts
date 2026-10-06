import { ScheduleApiNotConfiguredError } from './getSchedule'

export type ScraperHealth = {
  alive: boolean
  /** ISO timestamp of when the server's health check ran */
  checkedAt: string
}

// The verdict of the API's last scheduled health check; reading it never starts a scrape
export async function getScraperHealth(): Promise<ScraperHealth> {
  if (!__HOST_URL__) throw new ScheduleApiNotConfiguredError()

  const response = await fetch(`${__HOST_URL__}/schedules/one/healthCheck/latest`)
  if (response.status === 404) throw new Error("The scraper hasn't been checked yet.")
  if (!response.ok) throw new Error(`Schedule API returned ${response.status} ${response.statusText}`)
  return response.json()
}
