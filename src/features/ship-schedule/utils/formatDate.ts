const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

const pad = (n: number) => String(n).padStart(2, '0')

// ISO timestamp → mm/dd/yyyy, h:mm AM
export function formatReceived(iso: string) {
  const date = new Date(iso)
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}, ${timeFormat.format(date)}`
}

// YYYY-MM-DD → mm/dd/yyyy
export function formatQueryDate(value: string) {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${month}/${day}/${year}` : value
}
