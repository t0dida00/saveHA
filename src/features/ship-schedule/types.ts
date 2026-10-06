export type PortSide = 'origins' | 'destinations'

export type ServiceRoute = {
  code: string
  origins: string[]
  destinations: string[]
}

export type ScheduleSelection = {
  /** YYYY-MM-DD */
  startDate: string
  /** How many weeks ahead of startDate to look */
  weeks: number
  services: ServiceRoute[]
}

/** A CSV file returned by the schedule API, kept in the "ONE's files" list */
export type ScheduleFile = {
  id: string
  /** Filename from the server, e.g. ONE-06102026.csv */
  name: string
  /** ISO timestamp of when the file was received */
  createdAt: string
  /** True for the latest file made by the API's scheduled job; its query isn't known here */
  scheduled?: boolean
  /** The query that produced it (missing on scheduled files) */
  date?: string
  weeks?: number
  /** "all" or the service codes that were requested */
  services?: 'all' | string[]
  content: string
}
