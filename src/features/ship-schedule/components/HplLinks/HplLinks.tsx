import { Bookmark, CircleAlert, CircleCheck, ClipboardPaste, ExternalLink } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ClipboardEvent } from 'react'
import { ConfirmDialog } from '@/shared/components'
import type { HplSearchLink } from '../../services/getSchedule'
import type { ScheduleFile, ServiceRoute } from '../../types'
import { HPL_BOOKMARKLET, HPL_READER, parseHplPaste, type HplSailing } from '../../utils/hplBookmarklet'
import { weeklyCsv } from '../../utils/weeklyCsv'
import styles from './HplLinks.module.scss'

type HplLinksProps = {
  links: HplSearchLink[]
  /** The card's services, in card order: the file's columns */
  services: ServiceRoute[]
  /** YYYY-MM-DD */
  startDate: string
  weeks: number
  onFile: (file: ScheduleFile) => void
  /** Closes the links and drops what was pasted */
  onDiscard: () => void
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const shortDate = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(8, 10)}`

// VUT for HPL_VUT: the plain port, as written in the file's column headers
const plainPort = (port: string) => port.replace(/^[A-Z]+_/, '')

const sailingKey = (s: HplSailing) => `${s.service} ${s.vessel} ${s.voyage} ${s.departure}`

/**
 * Hapag-Lloyd's searches, one per POL → POD. Their site blocks automated browsers, so the viewer opens
 * each link, clicks the Copy HPL schedule bookmark there and pastes here; the pasted sailings become an
 * HPL file in Results.
 */
export function HplLinks({ links, services, startDate, weeks, onFile, onDiscard }: HplLinksProps) {
  const bookmarkRef = useRef<HTMLAnchorElement>(null)
  const pasteId = useId()
  // Pasted sailings per link URL
  const [pasted, setPasted] = useState<Record<string, HplSailing[]>>({})
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string }>()
  const [readerCopied, setReaderCopied] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  // Nothing pasted yet: nothing to lose, so Discard closes straight away
  const handleDiscard = () => (Object.keys(pasted).length > 0 ? setConfirmingDiscard(true) : onDiscard())

  // React won't render a javascript: href, so the bookmark gets it straight on the element
  useEffect(() => {
    bookmarkRef.current?.setAttribute('href', HPL_BOOKMARKLET)
  }, [])

  const allPasted = links.every((link) => pasted[link.url])

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault()
    try {
      const paste = parseHplPaste(event.clipboardData.getData('text'))
      const link = links.find((l) => l.from === paste.from && l.to === paste.to)
      if (!link) {
        throw new Error(`Those sailings are for ${paste.from} → ${paste.to}, which isn't one of the links above.`)
      }
      // A later search window adds to what's there; a sailing seen twice counts once
      const merged = new Map([...(pasted[link.url] ?? []), ...paste.sailings].map((s) => [sailingKey(s), s]))
      setPasted({ ...pasted, [link.url]: [...merged.values()] })
      setMessage({ kind: 'success', text: `${paste.sailings.length} sailings added to ${link.codes.join(', ')}.` })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Could not read that.' })
    }
  }

  const handleAddToResults = () => {
    const columns = services.flatMap((route) => {
      const link = links.find((l) => l.codes.includes(route.code))
      if (!link) return []
      const sailings = (pasted[link.url] ?? []).filter((s) => s.service === route.code)
      return [
        {
          label: `${route.code}\n(${route.origins.map(plainPort).join('/')} - ${route.destinations.map(plainPort).join('/')})`,
          url: link.url,
          // Not among the route's sailings: Hapag-Lloyd doesn't run it there in this window
          placeholder: sailings.length === 0 ? 'N/A' : undefined,
          sailings: sailings.map((s) => ({ departure: s.departure, vessel: [s.vessel, s.voyage].filter(Boolean).join('/ ') })),
        },
      ]
    })
    const [year, month, day] = startDate.split('-')
    const createdAt = new Date()
    const name = `HPL-${day}${month}${year}.csv`
    onFile({
      id: `${createdAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdAt: createdAt.toISOString(),
      date: startDate,
      weeks,
      services: services.map((route) => route.code),
      content: weeklyCsv(columns, startDate, weeks, 'HPL'),
    })
    setMessage({ kind: 'success', text: `${name} was added to Results.` })
  }

  const copyReader = async () => {
    try {
      await navigator.clipboard.writeText(HPL_READER)
      setReaderCopied(true)
    } catch {
      setReaderCopied(false)
    }
  }

  return (
    <div className={styles.root}>
      <h3 className={styles.title}>Search on Hapag-Lloyd</h3>

      <div className={styles.install}>
        <a
          ref={bookmarkRef}
          className={styles.bookmark}
          // Only for dragging to the bookmarks bar; clicking it here does nothing
          onClick={(event) => event.preventDefault()}
          title="Drag to your bookmarks bar"
        >
          <Bookmark size={14} aria-hidden="true" />
          Copy HPL schedule
        </a>
        <p className={styles.hint}>
          Drag this to your bookmarks bar once. Then open a link below, wait for the sailings, click the bookmark and
          paste here.{' '}
          <button type="button" className={styles.textButton} onClick={copyReader}>
            {readerCopied ? 'Copied: paste it in the DevTools console there' : "Bookmark blocked? Copy it for the console"}
          </button>
        </p>
      </div>

      <ul className={styles.list}>
        {links.map((link) => {
          const sailings = pasted[link.url]
          const dates = sailings?.map((s) => s.departure).sort()
          return (
            <li key={link.url} className={styles.item}>
              <span className={styles.code}>{link.codes.join(', ')}</span>
              <span className={styles.route}>
                {link.origin} → {link.destination}
              </span>
              <span className={`${styles.status} ${sailings ? styles.statusDone : ''}`}>
                {sailings
                  ? `${sailings.length} sailings${dates?.length ? ` · ${shortDate(dates[0])} – ${shortDate(dates.at(-1)!)}` : ''}`
                  : 'Not pasted yet'}
              </span>
              <a href={link.url} target="_blank" rel="noreferrer" className={styles.link} title={link.url}>
                Open on Hapag-Lloyd
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </li>
          )
        })}
      </ul>

      <label className={styles.pasteLabel} htmlFor={pasteId}>
        <ClipboardPaste size={16} aria-hidden="true" />
        Paste the copied sailings
      </label>
      <textarea
        id={pasteId}
        className={styles.paste}
        rows={2}
        value=""
        // Only pasting does anything; typed text isn't kept
        onChange={() => {}}
        onPaste={handlePaste}
        placeholder="Click here and press ⌘V"
      />

      <div className={styles.actions}>
        <p
          className={`${styles.message} ${message?.kind === 'error' ? styles.messageError : styles.messageSuccess}`}
          role={message?.kind === 'error' ? 'alert' : 'status'}
        >
          {message?.kind === 'error' && <CircleAlert size={16} aria-hidden="true" />}
          {message?.kind === 'success' && <CircleCheck size={16} aria-hidden="true" />}
          {message?.text}
        </p>
        <button type="button" className={styles.discard} onClick={handleDiscard}>
          Discard
        </button>
        <button type="button" className={styles.add} onClick={handleAddToResults} disabled={!allPasted}>
          Add to Results
        </button>
      </div>

      {confirmingDiscard && (
        <ConfirmDialog
          title="Discard the pasted sailings?"
          confirmLabel="Discard"
          onConfirm={onDiscard}
          onCancel={() => setConfirmingDiscard(false)}
        >
          The links close and the sailings you pasted are lost. Files already in Results stay.
        </ConfirmDialog>
      )}
    </div>
  )
}
