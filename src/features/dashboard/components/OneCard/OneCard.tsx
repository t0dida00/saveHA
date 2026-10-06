import { CalendarClock, Download, Eye, FileText } from 'lucide-react'
import { useId, useState } from 'react'
import {
  CsvPreview,
  downloadFile,
  formatReceived,
  parseCsv,
  ScraperStatus,
  useRecentFiles,
  type ScheduleFile,
} from '@/features/ship-schedule'
import oneLogo from '@/shared/assets/one-logo.svg'
import { LatestDifferences } from '../LatestDifferences/LatestDifferences'
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

/** Dashboard card: the newest file in Results, its services, when the weekly job runs, and what changed */
export function OneCard() {
  const titleId = useId()
  // Same list as Results, so adding or deleting a file there shows here straight away
  const { files } = useRecentFiles()
  const latest = files[0]
  const [previewing, setPreviewing] = useState(false)
  const run = nextRun()

  const services = latest ? servicesIn(latest) : []

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      {/* ONE's logo from one-line.com, kept in the repo since their copy's URL changes with each deploy */}
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          <img src={oneLogo} alt="ONE" width={90} height={40} className={styles.logo} />
        </h2>
        <ScraperStatus variant="dot" />
      </div>

      <div className={styles.block}>
        <h3 className={styles.label}>Services</h3>
        {services.length > 0 ? (
          <ul className={styles.services}>
            {services.map((code) => (
              <li key={code} className={styles.service}>
                {code}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Shown once Results has a file.</p>
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
        {!latest && <p className={styles.muted}>No files in Results.</p>}
        {latest && (
          <div className={styles.file}>
            <FileText size={20} aria-hidden="true" className={styles.icon} />
            <div className={styles.fileInfo}>
              <p className={styles.fileName} title={latest.name}>
                {latest.name}
              </p>
              <p className={styles.muted}>
                Received <time dateTime={latest.createdAt}>{formatReceived(latest.createdAt)}</time>
              </p>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setPreviewing(true)}
              aria-label={`Preview ${latest.name}`}
              title="Preview"
            >
              <Eye size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => downloadFile(latest)}
              aria-label={`Download ${latest.name}`}
              title="Download"
            >
              <Download size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className={styles.block}>
        <h3 className={styles.label}>Differences</h3>
        <LatestDifferences />
      </div>

      {previewing && latest && <CsvPreview file={latest} onClose={() => setPreviewing(false)} />}
    </section>
  )
}
