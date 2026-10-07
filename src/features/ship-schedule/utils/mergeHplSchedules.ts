import { plainPort } from '../data/services'
import { firstLine, weekOrder } from './compareCsv'
import { parseCsv } from './parseCsv'

/** One chosen service and the CSV the API returned for its port pair */
export type HplRouteSchedule = {
  /** Service code, e.g. AA7 */
  code: string
  /** The route's ports, e.g. [HPL_VUT] and [NYC, ORF, CHS, SAV]; only the first of each is searched */
  origins: string[]
  destinations: string[]
  csv: string
}

type ParsedSchedule = {
  /** Service code → column index */
  columns: Map<string, number>
  /** Hapag-Lloyd schedule page, from the QueryString row */
  url?: string
  /** Week key (W41/2026) → full row */
  weeks: Map<string, { label: string; cells: string[] }>
}

function parse(csv: string): ParsedSchedule {
  const [header = [], ...rows] = parseCsv(csv)
  const columns = new Map(header.map((label, index) => [firstLine(label), index] as const).slice(1))
  const parsed: ParsedSchedule = { columns, weeks: new Map() }
  for (const row of rows) {
    const week = firstLine(row[0])
    if (!week) continue
    if (week.toLowerCase() === 'querystring') parsed.url = row.slice(1).find(Boolean)
    else parsed.weeks.set(week, { label: row[0], cells: row })
  }
  return parsed
}

const csvField = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/**
 * Same layout as ONE's files: "HPL" and one column per chosen service, the QueryString row,
 * then one row per week. A week past the last sailing of a route reads OMIT; a service
 * Hapag-Lloyd doesn't run on its route reads N/A.
 */
export function mergeHplSchedules(schedules: HplRouteSchedule[]): string {
  const parsed = new Map<string, ParsedSchedule>()
  for (const { csv } of schedules) if (!parsed.has(csv)) parsed.set(csv, parse(csv))

  const weekLabels = new Map<string, string>()
  for (const { weeks } of parsed.values()) for (const [week, row] of weeks) weekLabels.set(week, row.label)
  const weeks = [...weekLabels.keys()].sort((a, b) => weekOrder(a) - weekOrder(b))

  const columns = schedules.map((schedule) => {
    const table = parsed.get(schedule.csv)!
    const index = table.columns.get(schedule.code)
    return {
      label: `${schedule.code}\n(${schedule.origins.map(plainPort).join('/')} - ${schedule.destinations.map(plainPort).join('/')})`,
      url: table.url ?? '',
      cell: (week: string) => (index === undefined ? 'N/A' : table.weeks.get(week)?.cells[index] || 'OMIT'),
    }
  })

  const rows = [
    ['HPL', ...columns.map((column) => column.label)],
    ['QueryString', ...columns.map((column) => column.url)],
    ...weeks.map((week) => [weekLabels.get(week)!, ...columns.map((column) => column.cell(week))]),
  ]
  return '﻿' + rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n'
}
