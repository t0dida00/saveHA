import { DEFAULT_CRON_SCHEDULE, type CronSchedule } from '../data/cronSchedule'

// TODO: call the API once it can change its cron. Planned contract:
//   GET {HOST_URL}/schedules/one/weekly/cron-schedule → { "cron": "0 1 * * 6" }
//   PUT {HOST_URL}/schedules/one/weekly/cron-schedule   { "cron": "0 1 * * 6" } → the same

export class CronScheduleApiNotReadyError extends Error {
  constructor() {
    super("Can't save yet: the schedule API doesn't support changing the run time.")
    this.name = 'CronScheduleApiNotReadyError'
  }
}

/** When the scheduled job runs. Until the API supports it, the schedule the API is deployed with. */
export async function getCronSchedule(): Promise<CronSchedule> {
  return DEFAULT_CRON_SCHEDULE
}

/** Changes when the scheduled job runs. Rejects until the API supports it. */
export async function saveCronSchedule(_schedule: CronSchedule): Promise<CronSchedule> {
  throw new CronScheduleApiNotReadyError()
}
