import { CalendarClock, Download, Eye, FileText } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import {
  CsvPreview,
  downloadFile,
  getLatestSchedule,
  parseCsv,
  readCachedLatest,
  type ScheduleFile,
} from '@/features/ship-schedule'
import oneLogo from '../../assets/one-logo.svg'
import styles from './OneCard.module.scss'

// The API's weekly job runs on Saturdays at 01:00 UTC (vercel.json in the API repo: "0 1 * * 6")
const RUN_WEEKDAY_UTC = 6
const RUN_HOUR_UTC = 1

const weekdayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })

function nextRun(now = new Date()) {
  const daysAhead = (RUN_WEEKDAY_UTC - now.getUTCDay() + 7) % 7
  const run = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead, RUN_HOUR_UTC),
  )
  if (run <= now) run.setUTCDate(run.getUTCDate() + 7)
  return run
}

// Header cells look like "PS7\n(HPH/VUT - LAX/LGB/OAK)"; the first line is the service code
function servicesIn(file: ScheduleFile) {
  const [header = []] = parseCsv(file.content)
  return header
    .slice(1)
    .map((cell) => cell.split('\n')[0].trim())
    .filter(Boolean)
}

// ONE-06102026.csv → 10/06/2026, the app's mm/dd/yyyy
function scrapedOn(name: string) {
  const match = name.match(/(\d{2})(\d{2})(\d{4})/)
  return match ? `${match[2]}/${match[1]}/${match[3]}` : undefined
}

type Latest = { state: 'loading' } | { state: 'ready'; file: ScheduleFile } | { state: 'error'; message: string }

/** Dashboard card: the services the weekly job scrapes, when it runs, and its newest CSV */
export function OneCard() {
  const titleId = useId()
  // A file fetched within the last day shows straight away, with no request
  const [latest, setLatest] = useState<Latest>(() => {
    const file = readCachedLatest()
    return file ? { state: 'ready', file } : { state: 'loading' }
  })
  const [previewing, setPreviewing] = useState(false)
  const run = nextRun()

  // With a fresh cache this resolves from it without a request
  useEffect(() => {
    let cancelled = false
    getLatestSchedule({ cached: true })
      .then((file) => !cancelled && setLatest({ state: 'ready', file }))
      .catch(
        (error: unknown) =>
          !cancelled &&
          setLatest({ state: 'error', message: error instanceof Error ? error.message : "Couldn't load the file." }),
      )
    return () => {
      cancelled = true
    }
  }, [])

  const services = latest.state === 'ready' ? servicesIn(latest.file) : []

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      {/* ONE's logo from one-line.com, kept in the repo since their copy's URL changes with each deploy */}
      <h2 id={titleId} className={styles.title}>
        <img src={oneLogo} alt="ONE" width={90} height={40} className={styles.logo} />
      </h2>

      <div className={styles.block}>
        <h3 className={styles.label}>Services</h3>
        {latest.state === 'loading' ? (
          <p className={styles.muted}>Loading…</p>
        ) : services.length > 0 ? (
          <ul className={styles.services}>
            {services.map((code) => (
              <li key={code} className={styles.service}>
                {code}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Shown once the weekly job has made a file.</p>
        )}
      </div>

      <div className={styles.block}>
        <h3 className={styles.label}>Schedule</h3>
        <p className={styles.row}>
          <CalendarClock size={18} aria-hidden="true" className={styles.icon} />
          <span>
            Weekly, every {weekdayFormat.format(run)} at {timeFormat.format(run)}
            <span className={styles.muted}>
              {' '}
              · Next: <time dateTime={run.toISOString()}>{dateFormat.format(run)}</time>
            </span>
          </span>
        </p>
      </div>

      <div className={styles.block}>
        <h3 className={styles.label}>Latest file</h3>
        {latest.state === 'loading' && <p className={styles.muted}>Loading…</p>}
        {latest.state === 'error' && <p className={styles.error}>{latest.message}</p>}
        {latest.state === 'ready' && (
          <div className={styles.file}>
            <FileText size={20} aria-hidden="true" className={styles.icon} />
            <div className={styles.fileInfo}>
              <p className={styles.fileName} title={latest.file.name}>
                {latest.file.name}
              </p>
              {scrapedOn(latest.file.name) && (
                <p className={styles.muted}>Scraped {scrapedOn(latest.file.name)}</p>
              )}
            </div>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setPreviewing(true)}
              aria-label={`Preview ${latest.file.name}`}
              title="Preview"
            >
              <Eye size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => downloadFile(latest.file)}
              aria-label={`Download ${latest.file.name}`}
              title="Download"
            >
              <Download size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {previewing && latest.state === 'ready' && (
        <CsvPreview file={latest.file} onClose={() => setPreviewing(false)} />
      )}
    </section>
  )
}
