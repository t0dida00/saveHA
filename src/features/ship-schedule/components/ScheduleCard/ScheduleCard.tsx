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
import { CircleAlert, CircleCheck, LoaderCircle, RotateCcw } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import hplLogo from '@/shared/assets/hpl-logo.svg'
import oneLogo from '@/shared/assets/one-logo.svg'
import { ConfirmDialog } from '@/shared/components'
import { findService, isDefaultRoute, SERVICES, type Carrier } from '../../data/services'
import { useScheduleSelection } from '../../hooks/useScheduleSelection'
import { getSchedule, hplSearchLinks, type HplSearchLink } from '../../services/getSchedule'
import type { ScheduleFile } from '../../types'
import { HplLinks } from '../HplLinks/HplLinks'
import { RouteCard } from '../RouteCard/RouteCard'
import { ServicePicker } from '../ServicePicker/ServicePicker'
import styles from './ScheduleCard.module.scss'

// Logos kept in the repo: ONE's from one-line.com, Hapag-Lloyd's from hapag-lloyd.com's header
const BRANDS: Record<Carrier, { name: string; logo: string; width: number; height: number }> = {
  one: { name: 'ONE', logo: oneLogo, width: 90, height: 40 },
  hpl: { name: 'Hapag-Lloyd', logo: hplLogo, width: 130, height: 20 },
}

type ScheduleCardProps = {
  carrier: Carrier
  /** YYYY-MM-DD, shared by every carrier's card */
  startDate: string
  weeks: number
  /** Shown under the logo, e.g. the scraper status */
  status?: ReactNode
  /** A file the API returned, for Results (ONE only; Hapag-Lloyd gives search links instead) */
  onFile: (file: ScheduleFile) => void
}

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
      <LoaderCircle size={20} aria-hidden="true" className={styles.spinner} />
      Getting schedule…
      <span className={styles.elapsed}>{seconds}s</span>
    </>
  )
}

/** One carrier: its services with their routes, saved per carrier, and Get Schedule */
export function ScheduleCard({ carrier, startDate, weeks, status, onFile }: ScheduleCardProps) {
  const {
    services,
    isDirty,
    save,
    toggleService,
    toggleAllServices,
    togglePort,
    resetAllRoutes,
    moveService,
    cancelChanges,
  } = useScheduleSelection(carrier)
  // Small move threshold so a click on the handle isn't a drag; arrow keys reorder from the keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over) moveService(String(active.id), String(over.id))
  }
  const [request, setRequest] = useState<RequestState>({ status: 'idle' })
  const [saveFailed, setSaveFailed] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  // Hapag-Lloyd search links, kept with the services and date they were made for, so they hide once those change
  const [hplLinks, setHplLinks] = useState<{ key: string; links: HplSearchLink[] }>()
  const linksKey = JSON.stringify({ startDate, services })
  const links = hplLinks?.key === linksKey ? hplLinks.links : undefined
  const titleId = useId()
  const brand = BRANDS[carrier]

  const allDefault = services.every((route) => isDefaultRoute(carrier, route))

  const canSubmit =
    Boolean(startDate) &&
    services.length > 0 &&
    services.every((route) => route.origins.length > 0 && route.destinations.length > 0)

  const handleGetSchedule = async () => {
    if (!canSubmit || request.status === 'loading') return
    if (carrier === 'hpl') {
      try {
        setHplLinks({ key: linksKey, links: hplSearchLinks({ startDate, weeks, services }) })
        setRequest({ status: 'idle' })
      } catch (error) {
        setRequest({ status: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' })
      }
      return
    }
    setRequest({ status: 'loading' })
    try {
      const file = await getSchedule({ startDate, weeks, services })
      onFile(file)
      setRequest({ status: 'success', fileName: file.name })
    } catch (error) {
      setRequest({ status: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' })
    }
  }

  const handleSave = () => setSaveFailed(!save())

  // Cancel asks first: it throws away every unsaved change to the services and ports
  const handleDiscard = () => {
    cancelChanges()
    setSaveFailed(false)
    setConfirmingCancel(false)
  }

  return (
    <div>
      <section className={styles.section} aria-labelledby={titleId}>
        <div className={styles.sectionBody}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitleGroup}>
              <h2 id={titleId} className={styles.sectionTitle}>
                <img
                  src={brand.logo}
                  alt={brand.name}
                  width={brand.width}
                  height={brand.height}
                  className={styles.logo}
                  data-carrier={carrier}
                />
              </h2>
              {status}
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
            services={SERVICES[carrier]}
            selected={services.map((route) => route.code)}
            onToggle={toggleService}
            onToggleAll={toggleAllServices}
          />

          {services.length === 0 ? (
            <p className={styles.empty}>Pick one or more services to choose their routes.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={services.map((route) => route.code)} strategy={verticalListSortingStrategy}>
                <ul className={styles.cards}>
                  {services.map((route) => {
                    const service = findService(carrier, route.code)
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

          {links && links.length > 0 && (
            // Keyed by the services and date, so pasted sailings start over when the links change
            <HplLinks
              key={linksKey}
              links={links}
              services={services}
              startDate={startDate}
              weeks={weeks}
              onFile={onFile}
              onDiscard={() => setHplLinks(undefined)}
            />
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
              <>
                <CircleCheck size={16} aria-hidden="true" /> Saved
              </>
            )}
          </p>
          <button type="button" className={styles.secondary} onClick={() => setConfirmingCancel(true)} disabled={!isDirty}>
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
            {request.status === 'loading' ? <LoadingLabel /> : carrier === 'hpl' ? 'Get Links' : 'Get Schedule'}
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
            {request.fileName} was added to Results.
          </p>
        )}
      </div>

      {confirmingCancel && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          confirmLabel="Discard"
          onConfirm={handleDiscard}
          onCancel={() => setConfirmingCancel(false)}
        >
          {brand.name}'s services and ports go back to what you last saved.
        </ConfirmDialog>
      )}
    </div>
  )
}
