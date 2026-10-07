import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { PageHeader } from '@/shared/components'
import { RecentFiles, type UpdateState } from '../../components/RecentFiles/RecentFiles'
import { ScheduleCard } from '../../components/ScheduleCard/ScheduleCard'
import { ScraperStatus } from '../../components/ScraperStatus/ScraperStatus'
import { useRecentFiles } from '../../hooks/useRecentFiles'
import { DEFAULT_WEEKS, today, WEEK_OPTIONS } from '../../hooks/useScheduleSelection'
import { getLatestSchedule } from '../../services/getSchedule'
import styles from './ShipSchedulePage.module.scss'

const LAST_UPDATE_KEY = 'saveha.shipSchedule.lastUpdate'

function loadLastUpdate() {
  try {
    return localStorage.getItem(LAST_UPDATE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function storeLastUpdate(iso: string) {
  try {
    localStorage.setItem(LAST_UPDATE_KEY, iso)
  } catch {
    // Only shown as a hint; fine to lose
  }
}

export function ShipSchedulePage() {
  // Shared by every carrier's card. Not saved: they always start at today and 8 weeks.
  const [startDate, setStartDate] = useState(today)
  const [weeks, setWeeks] = useState(DEFAULT_WEEKS)
  const { files, addFile, removeFile } = useRecentFiles()
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' })
  const [lastUpdate, setLastUpdate] = useState(loadLastUpdate)
  const dateId = useId()
  const weeksId = useId()

  // The scheduled job's file only changes weekly: a copy fetched within the last day is reused,
  // and one already in Results isn't added again
  const handleUpdate = async () => {
    if (update.status === 'loading') return
    setUpdate({ status: 'loading' })
    try {
      const file = await getLatestSchedule({ cached: true })
      setLastUpdate(file.createdAt)
      storeLastUpdate(file.createdAt)
      const known = files.some((other) => other.name === file.name && other.content === file.content)
      if (known) {
        setUpdate({ status: 'success', message: `Already up to date: ${file.name} is in Results.` })
        return
      }
      addFile(file)
      setUpdate({ status: 'success', message: `${file.name} was added to Results.` })
    } catch (error) {
      setUpdate({ status: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' })
    }
  }

  return (
    <>
      <PageHeader title="Check ship schedule" description="Pick a start date, then each carrier's services and their routes." />

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={dateId}>
            Date
          </label>
          <input
            id={dateId}
            className={styles.control}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={weeksId}>
            Next
          </label>
          <div className={styles.selectWrap}>
            <select
              id={weeksId}
              className={`${styles.control} ${styles.select}`}
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
            >
              {WEEK_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} weeks
                </option>
              ))}
            </select>
            <ChevronDown size={20} aria-hidden="true" className={styles.selectIcon} />
          </div>
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.main}>
          <ScheduleCard carrier="one" startDate={startDate} weeks={weeks} status={<ScraperStatus />} onFile={addFile} />
          <ScheduleCard carrier="hpl" startDate={startDate} weeks={weeks} onFile={addFile} />
          <ScheduleCard carrier="cma" startDate={startDate} weeks={weeks} onFile={addFile} />
        </div>

        <RecentFiles files={files} onRemove={removeFile} onUpdate={handleUpdate} update={update} lastUpdate={lastUpdate} />
      </div>
    </>
  )
}
