export type Frequency = 'daily' | 'weekly' | 'monthly'

/** When the API's scheduled job runs, in UTC like the cron itself */
export type CronSchedule = {
  frequency: Frequency
  hour: number
  minute: number
  /** Weekly only: 0 = Sunday … 6 = Saturday */
  weekday: number
  /** Monthly only: 1–28, so every month has it */
  day: number
}

// What the API runs today (vercel.json in the API repo: "0 1 * * 6"), 08:00 on Saturdays in Vietnam
export const DEFAULT_CRON_SCHEDULE: CronSchedule = { frequency: 'weekly', hour: 1, minute: 0, weekday: 6, day: 1 }

export const MAX_MONTH_DAY = 28

/** e.g. "0 1 * * 6" */
export function toCronExpression({ frequency, hour, minute, weekday, day }: CronSchedule) {
  if (frequency === 'daily') return `${minute} ${hour} * * *`
  if (frequency === 'weekly') return `${minute} ${hour} * * ${weekday}`
  return `${minute} ${hour} ${day} * *`
}

/** The next time the job runs after `now` */
export function nextRun({ frequency, hour, minute, weekday, day }: CronSchedule, now = new Date()) {
  const run = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute))
  if (frequency === 'daily') {
    if (run <= now) run.setUTCDate(run.getUTCDate() + 1)
  } else if (frequency === 'weekly') {
    run.setUTCDate(run.getUTCDate() + ((weekday - now.getUTCDay() + 7) % 7))
    if (run <= now) run.setUTCDate(run.getUTCDate() + 7)
  } else {
    run.setUTCDate(day)
    if (run <= now) run.setUTCMonth(run.getUTCMonth() + 1)
  }
  return run
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

/** In the viewer's time zone, e.g. "Weekly, every Saturday at 8:00 AM" */
export function describeSchedule(schedule: CronSchedule) {
  const run = nextRun(schedule)
  const time = timeFormat.format(run)
  if (schedule.frequency === 'daily') return `Daily at ${time}`
  if (schedule.frequency === 'weekly') return `Weekly, every ${WEEKDAYS[run.getDay()]} at ${time}`
  return `Monthly, on day ${run.getDate()} at ${time}`
}

/** What the viewer edits: the schedule in their own time zone, with "HH:MM" for a time input */
export type LocalSchedule = { frequency: Frequency; weekday: number; day: number; time: string }

const pad = (n: number) => String(n).padStart(2, '0')

export function toLocal(schedule: CronSchedule): LocalSchedule {
  const run = nextRun(schedule)
  return {
    frequency: schedule.frequency,
    weekday: run.getDay(),
    day: Math.min(run.getDate(), MAX_MONTH_DAY),
    time: `${pad(run.getHours())}:${pad(run.getMinutes())}`,
  }
}

/**
 * The UTC schedule for what the viewer picked. Monthly can't always convert: day 1 at 6:30 AM in Vietnam is
 * the last day of the previous month in UTC, which a cron day-of-month can't express.
 */
export function fromLocal({ frequency, weekday, day, time }: LocalSchedule): { schedule: CronSchedule } | { error: string } {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  const date = new Date()
  if (frequency === 'weekly') date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7))
  // Monthly: this month, so the time-zone offset (daylight saving) is today's
  if (frequency === 'monthly') date.setDate(day)
  date.setHours(hours, minutes, 0, 0)

  const utcDay = date.getUTCDate()
  if (frequency === 'monthly' && (date.getUTCMonth() !== date.getMonth() || utcDay > MAX_MONTH_DAY)) {
    return { error: 'In UTC that falls on a day not every month has. Pick a later day or time.' }
  }
  return {
    schedule: {
      frequency,
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      weekday: date.getUTCDay(),
      day: frequency === 'monthly' ? utcDay : DEFAULT_CRON_SCHEDULE.day,
    },
  }
}
