// Same layout as the schedule API's files (SaveHA-backend weeklySchedule.ts), built in the browser

const DAY_MS = 86_400_000
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export type WeeklyColumn = {
  /** Header cell, e.g. "AA7\n(VUT - NYC/ORF/CHS/SAV)" */
  label: string
  /** The search page, shown in the QueryString row */
  url: string
  /** Fills every week instead of sailings, e.g. N/A when the service isn't on the route */
  placeholder?: string
  /** Departure (YYYY-MM-DD) and the cell text before the date, e.g. "WAN HAI A15/ E010" */
  sailings: { departure: string; vessel: string }[]
}

/**
 * One row per ISO week from the week of fromDate for `weeks` weeks, one column each:
 *
 *   HPL                    | AA7 (VUT - NYC/ORF/CHS/SAV)
 *   QueryString            | https://www.hapag-lloyd.com/…
 *   W41/2026 05/10-11/10   | WAN HAI A15/ E010/ OCT 08
 *
 * Weeks with no sailing read OMIT; weeks with several list each on its own line.
 * Sailings outside fromDate … fromDate + weeks are left out.
 */
export function weeklyCsv(columns: WeeklyColumn[], fromDate: string, weeks: number, corner: string): string {
  const first = Date.parse(`${fromDate}T00:00:00Z`)
  const lastDay = new Date(first + (weeks * 7 - 1) * DAY_MS).toISOString().slice(0, 10)
  const rows = [
    [corner, ...columns.map((column) => column.label)],
    ['QueryString', ...columns.map((column) => column.url)],
  ]

  for (let monday = mondayOf(fromDate); monday <= mondayOf(lastDay); monday += 7 * DAY_MS) {
    rows.push([
      weekLabel(monday),
      ...columns.map((column) => {
        if (column.placeholder) return column.placeholder
        return (
          column.sailings
            .filter((s) => s.departure >= fromDate && s.departure <= lastDay && mondayOf(s.departure) === monday)
            .sort((a, b) => a.departure.localeCompare(b.departure))
            .map((s) => `${s.vessel}/ ${monthDay(s.departure)}`)
            .join('\n') || 'OMIT'
        )
      }),
    ])
  }

  return '﻿' + rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n'
}

/** Monday 00:00 UTC of the date's ISO week, as epoch ms */
function mondayOf(date: string): number {
  const day = Date.parse(`${date}T00:00:00Z`)
  return day - ((new Date(day).getUTCDay() + 6) % 7) * DAY_MS
}

/** "W41/2026\n05/10-11/10" */
function weekLabel(monday: number): string {
  // The ISO week belongs to the year its Thursday falls in
  const thursday = new Date(monday + 3 * DAY_MS)
  const year = thursday.getUTCFullYear()
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1
  return `W${String(week).padStart(2, '0')}/${year}\n${dayMonth(monday)}-${dayMonth(monday + 6 * DAY_MS)}`
}

function dayMonth(ms: number): string {
  const date = new Date(ms)
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** "2026-10-08" → "OCT 08" */
function monthDay(date: string): string {
  const [, month, day] = date.split('-')
  return `${MONTHS[Number(month) - 1]} ${day}`
}

const csvField = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
