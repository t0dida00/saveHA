import { CalendarClock, Download, Eye, FileText, Hand } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import {
  CsvPreview,
  DEFAULT_CRON_SCHEDULE,
  describeSchedule,
  downloadFile,
  fileCarrier,
  formatReceived,
  nextRun,
  parseCsv,
  ScraperStatus,
  useRecentFiles,
  type Carrier,
  type ScheduleFile,
} from '@/features/ship-schedule'
import hplLogo from '@/shared/assets/hpl-logo.svg'
import oneLogo from '@/shared/assets/one-logo.svg'
import { LatestDifferences } from '../LatestDifferences/LatestDifferences'
import styles from './CarrierCard.module.scss'

const dateFormat = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })

const BRANDS: Record<Carrier, { name: string; logo: string; width: number; height: number }> = {
  one: { name: 'ONE', logo: oneLogo, width: 90, height: 40 },
  hpl: { name: 'Hapag-Lloyd', logo: hplLogo, width: 130, height: 20 },
}

// Header cells look like "PS7\n(HPH/VUT - LAX/LGB/OAK)"; the first line is the service code
function servicesIn(file: ScheduleFile) {
  const [header = []] = parseCsv(file.content)
  return header
    .slice(1)
    .map((cell) => cell.split('\n')[0].trim())
    .filter(Boolean)
}

/**
 * Dashboard card for one carrier: its newest file in Results, that file's services, how the
 * schedule is made, and what changed since its previous file
 */
export function CarrierCard({ carrier }: { carrier: Carrier }) {
  const titleId = useId()
  // Same list as Results, so adding or deleting a file there shows here straight away
  const { files: allFiles } = useRecentFiles()
  const files = useMemo(() => allFiles.filter((file) => fileCarrier(file) === carrier), [allFiles, carrier])
  const latest = files[0]
  const [previewing, setPreviewing] = useState(false)
  const brand = BRANDS[carrier]
  // Until the API can report its schedule, the one it's deployed with (editable in Settings later)
  const run = nextRun(DEFAULT_CRON_SCHEDULE)

  const services = latest ? servicesIn(latest) : []

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      {/* ONE is scraped by the API, so its bar shows the scraper's health; Hapag-Lloyd is copied by hand, so it's always up */}
      {carrier === 'one' ? (
        <ScraperStatus variant="bar" />
      ) : (
        <ScraperStatus variant="bar" alwaysAlive="Manual: links open hapag-lloyd.com, nothing to check" />
      )}
      <h2 id={titleId} className={styles.title}>
        <img
          src={brand.logo}
          alt={brand.name}
          width={brand.width}
          height={brand.height}
          className={styles.logo}
          data-carrier={carrier}
        />
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
          <p className={styles.muted}>Shown once Results has a {brand.name} file.</p>
        )}
      </div>

      <div className={styles.block}>
        <h3 className={styles.label}>Schedule</h3>
        {carrier === 'one' ? (
          <p className={styles.row}>
            <CalendarClock size={18} aria-hidden="true" className={styles.icon} />
            <span>
              {describeSchedule(DEFAULT_CRON_SCHEDULE)}
              <span className={styles.next}>
                Next: <time dateTime={run.toISOString()}>{dateFormat.format(run)}</time>
              </span>
            </span>
          </p>
        ) : (
          <p className={styles.row}>
            <Hand size={18} aria-hidden="true" className={styles.icon} />
            <span>
              Manual
              <span className={styles.next}>Get Links on Check ship schedule, then paste the sailings</span>
            </span>
          </p>
        )}
      </div>

      <div className={styles.block}>
        <h3 className={styles.label}>Latest file</h3>
        {!latest && <p className={styles.muted}>No {brand.name} files in Results.</p>}
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
        <LatestDifferences files={files} carrierName={brand.name} />
      </div>

      {previewing && latest && <CsvPreview file={latest} onClose={() => setPreviewing(false)} />}
    </section>
  )
}
