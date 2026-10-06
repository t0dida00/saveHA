import { CalendarClock, Download, Eye, FileText } from 'lucide-react'
import { useId, useState } from 'react'
import {
  CsvPreview,
  DEFAULT_CRON_SCHEDULE,
  describeSchedule,
  downloadFile,
  formatReceived,
  nextRun,
  parseCsv,
  ScraperStatus,
  useRecentFiles,
  type ScheduleFile,
} from '@/features/ship-schedule'
import oneLogo from '@/shared/assets/one-logo.svg'
import { LatestDifferences } from '../LatestDifferences/LatestDifferences'
import styles from './OneCard.module.scss'

const dateFormat = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })

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
  // Until the API can report its schedule, the one it's deployed with (editable in Settings later)
  const run = nextRun(DEFAULT_CRON_SCHEDULE)

  const services = latest ? servicesIn(latest) : []

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      {/* ONE's logo from one-line.com, kept in the repo since their copy's URL changes with each deploy */}
      <ScraperStatus variant="bar" />
      <h2 id={titleId} className={styles.title}>
        <img src={oneLogo} alt="ONE" width={90} height={40} className={styles.logo} />
      </h2>

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
            {describeSchedule(DEFAULT_CRON_SCHEDULE)}
            <span className={styles.next}>
              Next: <time dateTime={run.toISOString()}>{dateFormat.format(run)}</time>
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
