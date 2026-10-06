import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CircleAlert, CircleCheck, ChevronDown, LoaderCircle, RotateCcw } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { PageHeader } from '@/shared/components'
import { RecentFiles, type UpdateState } from '../../components/RecentFiles/RecentFiles'
import { RouteCard } from '../../components/RouteCard/RouteCard'
import { ScraperStatus } from '../../components/ScraperStatus/ScraperStatus'
import { ServicePicker } from '../../components/ServicePicker/ServicePicker'
import { isDefaultRoute, SERVICES_BY_CODE } from '../../data/services'
import { useRecentFiles } from '../../hooks/useRecentFiles'
import { useScheduleSelection, WEEK_OPTIONS } from '../../hooks/useScheduleSelection'
import { getLatestSchedule, getSchedule } from '../../services/getSchedule'
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

const SAVED_NOTICE_MS = 10_000

type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; fileName: string }

// Spinner plus seconds elapsed: an "all services" request takes about a minute
function LoadingLabel() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      <LoaderCircle size={16} aria-hidden="true" className={styles.spinner} />
      Getting schedule…
      <span className={styles.elapsed}>{seconds}s</span>
    </>
  )
}

export function ShipSchedulePage() {
  const {
    selection,
    isDirty,
    save,
    setStartDate,
    setWeeks,
    toggleService,
    toggleAllServices,
    togglePort,
    resetAllRoutes,
    moveService,
    cancelChanges,
  } = useScheduleSelection()
  // Small move threshold so a click on the handle isn't a drag; arrow keys reorder from the keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over) moveService(String(active.id), String(over.id))
  }
  const { files, addFile, removeFile } = useRecentFiles()
  const [request, setRequest] = useState<RequestState>({ status: 'idle' })
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' })
  const [lastUpdate, setLastUpdate] = useState(loadLastUpdate)
  const [saveFailed, setSaveFailed] = useState(false)
  // When Save last succeeded; "Saved" shows for SAVED_NOTICE_MS after it
  const [savedAt, setSavedAt] = useState<number>()
  const dateId = useId()
  const weeksId = useId()
  const sectionTitleId = useId()

  const allDefault = selection.services.every(isDefaultRoute)

  const canSubmit =
    Boolean(selection.startDate) &&
    selection.services.length > 0 &&
    selection.services.every((route) => route.origins.length > 0 && route.destinations.length > 0)

  const handleGetSchedule = async () => {
    if (!canSubmit || request.status === 'loading') return
    setRequest({ status: 'loading' })
    try {
      const file = await getSchedule(selection)
      addFile(file)
      setRequest({ status: 'success', fileName: file.name })
    } catch (error) {
      setRequest({ status: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' })
    }
  }

  // The scheduled job's file only changes when it runs again, so skip one we already have
  const handleUpdate = async () => {
    if (update.status === 'loading') return
    setUpdate({ status: 'loading' })
    try {
      const file = await getLatestSchedule()
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

  const handleSave = () => {
    const saved = save()
    setSaveFailed(!saved)
    setSavedAt(saved ? Date.now() : undefined)
  }

  useEffect(() => {
    if (savedAt === undefined) return
    const timer = setTimeout(() => setSavedAt(undefined), SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [savedAt])

  const handleCancel = () => {
    cancelChanges()
    setSaveFailed(false)
  }

  return (
    <>
      <PageHeader title="Check ship schedule" description="Pick a start date, the services and their routes." />

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={dateId}>
            Date
          </label>
          <input
            id={dateId}
            className={styles.control}
            type="date"
            value={selection.startDate}
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
              value={selection.weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
            >
              {WEEK_OPTIONS.map((weeks) => (
                <option key={weeks} value={weeks}>
                  {weeks} weeks
                </option>
              ))}
            </select>
            <ChevronDown size={20} aria-hidden="true" className={styles.selectIcon} />
          </div>
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.main}>
          <section className={styles.section} aria-labelledby={sectionTitleId}>
            <div className={styles.sectionBody}>
              <div className={styles.sectionHead}>
                <div className={styles.sectionTitleGroup}>
                  <h2 id={sectionTitleId} className={styles.sectionTitle}>
                    ONE
                  </h2>
                  <ScraperStatus />
                </div>
                <button
                  type="button"
                  className={styles.resetAll}
                  onClick={resetAllRoutes}
                  disabled={allDefault}
                  title="Set every selected service back to its default ports"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  Reset to default
                </button>
              </div>
              <ServicePicker
                selected={selection.services.map((route) => route.code)}
                onToggle={toggleService}
                onToggleAll={toggleAllServices}
              />

              {selection.services.length === 0 ? (
                <p className={styles.empty}>Pick one or more services to choose their routes.</p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={selection.services.map((route) => route.code)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className={styles.cards}>
                      {selection.services.map((route) => {
                        const service = SERVICES_BY_CODE.get(route.code)
                        if (!service) return null
                        return (
                          <RouteCard
                            key={route.code}
                            service={service}
                            route={route}
                            onTogglePort={(side, port) => togglePort(route.code, side, port)}
                            onRemove={() => toggleService(route.code)}
                          />
                        )
                      })}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <footer className={styles.footer}>
              <p
                className={`${styles.saveStatus} ${saveFailed ? styles.saveStatusError : !isDirty ? styles.saveStatusSaved : ''}`}
                role="status"
              >
                {saveFailed ? (
                  "Couldn't save in this browser."
                ) : isDirty ? (
                  'Unsaved changes'
                ) : (
                  savedAt !== undefined && (
                    <>
                      <CircleCheck size={16} aria-hidden="true" /> Saved
                    </>
                  )
                )}
              </p>
              <button type="button" className={styles.secondary} onClick={handleCancel} disabled={!isDirty}>
                Cancel
              </button>
              <button type="button" className={styles.secondary} onClick={handleSave} disabled={!isDirty}>
                Save
              </button>
              <button
                type="button"
                className={styles.primary}
                onClick={handleGetSchedule}
                disabled={!canSubmit || request.status === 'loading'}
                aria-busy={request.status === 'loading'}
              >
                {request.status === 'loading' ? <LoadingLabel /> : 'Get Schedule'}
              </button>
            </footer>
          </section>

          <div aria-live="polite">
            {request.status === 'error' && (
              <p className={styles.error} role="alert">
                <CircleAlert size={18} aria-hidden="true" />
                {request.message}
              </p>
            )}
            {request.status === 'success' && (
              <p className={styles.success}>
                <CircleCheck size={18} aria-hidden="true" />
                {request.fileName} was added to ONE's files.
              </p>
            )}
          </div>
        </div>

        <RecentFiles files={files} onRemove={removeFile} onUpdate={handleUpdate} update={update} lastUpdate={lastUpdate} />
      </div>
    </>
  )
}
