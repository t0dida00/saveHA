import { ChevronDown, CircleAlert, CircleCheck } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import oneLogo from '@/shared/assets/one-logo.svg'
import {
  describeSchedule,
  fromLocal,
  MAX_MONTH_DAY,
  nextRun,
  toCronExpression,
  toLocal,
  type CronSchedule,
  type Frequency,
  type LocalSchedule,
} from '../../data/cronSchedule'
import { getCronSchedule, saveCronSchedule } from '../../services/cronScheduleApi'
import styles from './CronScheduleEditor.module.scss'

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// Monday first in the list
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const MONTH_DAYS = Array.from({ length: MAX_MONTH_DAY }, (_, i) => i + 1)

const dateFormat = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })

type Status =
  | { state: 'loading' }
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved' }
  | { state: 'error'; message: string }

/** Settings card: how often and when the API's ONE job runs, edited in the viewer's own time zone */
export function CronScheduleEditor() {
  const titleId = useId()
  const dayId = useId()
  const timeId = useId()
  const [saved, setSaved] = useState<CronSchedule>()
  const [draft, setDraft] = useState<LocalSchedule>()
  const [status, setStatus] = useState<Status>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false
    getCronSchedule()
      .then((schedule) => {
        if (cancelled) return
        setSaved(schedule)
        setDraft(toLocal(schedule))
        setStatus({ state: 'idle' })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus({ state: 'error', message: error instanceof Error ? error.message : "Couldn't load the schedule." })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const converted = draft?.time ? fromLocal(draft) : undefined
  const edited = converted && 'schedule' in converted ? converted.schedule : undefined
  const invalid = converted && 'error' in converted ? converted.error : undefined
  const isDirty = Boolean(
    saved && draft && (invalid || (edited && toCronExpression(saved) !== toCronExpression(edited))),
  )
  const busy = status.state === 'loading' || status.state === 'saving'

  const change = (next: Partial<LocalSchedule>) => {
    setDraft((current) => current && { ...current, ...next })
    if (status.state === 'saved' || status.state === 'error') setStatus({ state: 'idle' })
  }

  const handleCancel = () => {
    if (saved) setDraft(toLocal(saved))
    setStatus({ state: 'idle' })
  }

  const handleSave = async () => {
    if (!edited || !isDirty) return
    setStatus({ state: 'saving' })
    try {
      const schedule = await saveCronSchedule(edited)
      setSaved(schedule)
      setDraft(toLocal(schedule))
      setStatus({ state: 'saved' })
    } catch (error) {
      setStatus({ state: 'error', message: error instanceof Error ? error.message : "Couldn't save the schedule." })
    }
  }

  const run = saved && nextRun(saved)

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.body}>
        <h2 id={titleId} className={styles.title}>
          <img src={oneLogo} alt="ONE" width={90} height={40} className={styles.logo} />
          <span className={styles.srOnly}> schedule</span>
        </h2>
        <p className={styles.intro}>When the server gets the schedule for every service. Times are in your time zone.</p>

        <div className={styles.current}>
          <span className={styles.currentLabel}>Current</span>
          {saved && run ? (
            <span>
              {describeSchedule(saved)}
              <span className={styles.muted}>
                {' '}
                · Next: <time dateTime={run.toISOString()}>{dateFormat.format(run)}</time>
              </span>
            </span>
          ) : (
            <span className={styles.muted}>Loading…</span>
          )}
        </div>

        <fieldset className={styles.frequency} disabled={!draft || busy}>
          <legend className={styles.label}>Frequency</legend>
          <div className={styles.segments}>
            {FREQUENCIES.map(({ value, label }) => (
              <label key={value} className={styles.segment}>
                <input
                  type="radio"
                  name={`${titleId}-frequency`}
                  value={value}
                  checked={draft?.frequency === value}
                  onChange={() => change({ frequency: value })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.fields}>
          {draft?.frequency === 'weekly' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={dayId}>
                Day
              </label>
              <div className={styles.selectWrap}>
                <select
                  id={dayId}
                  className={`${styles.control} ${styles.select}`}
                  value={draft.weekday}
                  onChange={(e) => change({ weekday: Number(e.target.value) })}
                  disabled={busy}
                >
                  {WEEKDAY_ORDER.map((day) => (
                    <option key={day} value={day}>
                      {WEEKDAYS[day]}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} aria-hidden="true" className={styles.selectIcon} />
              </div>
            </div>
          )}
          {draft?.frequency === 'monthly' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={dayId}>
                Day of month
              </label>
              <div className={styles.selectWrap}>
                <select
                  id={dayId}
                  className={`${styles.control} ${styles.select}`}
                  value={draft.day}
                  onChange={(e) => change({ day: Number(e.target.value) })}
                  disabled={busy}
                >
                  {MONTH_DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} aria-hidden="true" className={styles.selectIcon} />
              </div>
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.label} htmlFor={timeId}>
              Time
            </label>
            <input
              id={timeId}
              type="time"
              className={styles.control}
              value={draft?.time ?? ''}
              onChange={(e) => change({ time: e.target.value })}
              disabled={!draft || busy}
              required
            />
          </div>
        </div>

        {invalid ? (
          <p className={`${styles.preview} ${styles.previewError}`} role="alert">
            <CircleAlert size={16} aria-hidden="true" /> {invalid}
          </p>
        ) : (
          isDirty &&
          edited && (
            <p className={styles.preview}>
              New: {describeSchedule(edited)}
            </p>
          )
        )}
      </div>

      <footer className={styles.footer}>
        <p
          className={`${styles.status} ${status.state === 'saved' ? styles.statusSaved : ''} ${status.state === 'error' ? styles.statusError : ''}`}
          role="status"
        >
          {status.state === 'saved' ? (
            <>
              <CircleCheck size={16} aria-hidden="true" /> Saved
            </>
          ) : status.state === 'error' ? (
            <>
              <CircleAlert size={16} aria-hidden="true" /> {status.message}
            </>
          ) : status.state === 'saving' ? (
            'Saving…'
          ) : isDirty ? (
            'Unsaved changes'
          ) : (
            ''
          )}
        </p>
        <button type="button" className={styles.secondary} onClick={handleCancel} disabled={!isDirty || busy}>
          Cancel
        </button>
        <button type="button" className={styles.primary} onClick={handleSave} disabled={!isDirty || !edited || busy}>
          Save
        </button>
      </footer>
    </section>
  )
}
