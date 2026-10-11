// Days as yyyy-mm-dd strings (what date inputs use), worked on as UTC dates so time zones never shift a day
const DAY_MS = 86_400_000

export const parseDay = (day: string) => {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date))
}

export const formatDay = (date: Date) => date.toISOString().slice(0, 10)

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS)

/** Monday of the week the date is in (weeks run Monday to Sunday) */
export const mondayOf = (date: Date) => addDays(date, -((date.getUTCDay() + 6) % 7))

/** ISO 8601 week: the week with the year's first Thursday is week 1, so its year can differ from the date's */
export function isoWeek(date: Date) {
  const thursday = addDays(mondayOf(date), 3)
  const year = thursday.getUTCFullYear()
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1
  return { year, week }
}

/** The Monday of From when From–To is exactly one Monday-to-Sunday week, otherwise null */
export function weekOfRange(from: string, to: string) {
  if (!from || !to) return null
  const monday = parseDay(from)
  return monday.getUTCDay() === 1 && formatDay(addDays(monday, 6)) === to ? monday : null
}
