import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { addDays, formatDay, isoWeek, mondayOf } from '../../utils/weeks'
import styles from './WeekPicker.module.scss'

type WeekPickerProps = {
  /** Monday of the chosen week, or null when none is */
  value: Date | null
  onChange: (monday: Date) => void
}

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const LONG = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const todayUtc = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

// Just the number; From and To beside it show the dates
const weekLabel = (monday: Date) => `Week ${isoWeek(monday).week}`

// Mondays of every week that has a day in the month
function monthWeeks(month: Date) {
  const last = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0))
  const mondays: Date[] = []
  for (let monday = mondayOf(month); monday <= last; monday = addDays(monday, 7)) mondays.push(monday)
  return mondays
}

const firstOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))

// A button that opens a month calendar with week numbers; picking a row chooses that Monday-to-Sunday week
export function WeekPicker({ value, onChange }: WeekPickerProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => firstOfMonth(value ?? todayUtc()))
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverId = useId()
  const today = formatDay(todayUtc())
  const chosen = value ? formatDay(value) : null

  // Closes on a click outside or Escape
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    if (!open) setMonth(firstOfMonth(value ?? todayUtc()))
    setOpen(!open)
  }

  const pick = (monday: Date) => {
    onChange(monday)
    setOpen(false)
    buttonRef.current?.focus()
  }

  const shiftMonth = (by: number) => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + by, 1)))

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={toggle}
      >
        <span className={value ? undefined : styles.placeholder}>{value ? weekLabel(value) : 'Pick a week'}</span>
        {value && (
          <span className={styles.visuallyHidden}>
            , {LONG.format(value)} to {LONG.format(addDays(value, 6))}
          </span>
        )}
        <CalendarDays size={20} aria-hidden="true" className={styles.triggerIcon} />
      </button>

      {open && (
        <div id={popoverId} className={styles.popover} role="dialog" aria-label="Choose a week">
          <div className={styles.header}>
            <button type="button" className={styles.nav} onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <span className={styles.month}>{MONTH.format(month)}</span>
            <button type="button" className={styles.nav} onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.row} aria-hidden="true">
            <span className={styles.weekHead}>Wk</span>
            {WEEKDAYS.map((day) => (
              <span key={day} className={styles.dayHead}>
                {day}
              </span>
            ))}
          </div>

          {monthWeeks(month).map((monday) => {
            const sunday = addDays(monday, 6)
            const selected = formatDay(monday) === chosen
            return (
              <button
                key={formatDay(monday)}
                type="button"
                className={`${styles.row} ${styles.week} ${selected ? styles.selected : ''}`}
                aria-pressed={selected}
                aria-label={`Week ${isoWeek(monday).week}, ${LONG.format(monday)} to ${LONG.format(sunday)}`}
                onClick={() => pick(monday)}
              >
                <span className={styles.weekNumber}>{isoWeek(monday).week}</span>
                {WEEKDAYS.map((_, index) => {
                  const day = addDays(monday, index)
                  const classes = [
                    styles.day,
                    day.getUTCMonth() !== month.getUTCMonth() && styles.outside,
                    formatDay(day) === today && styles.today,
                  ]
                  return (
                    <span key={index} className={classes.filter(Boolean).join(' ')}>
                      {day.getUTCDate()}
                    </span>
                  )
                })}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
