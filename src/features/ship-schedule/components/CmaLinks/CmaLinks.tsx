import { Bookmark, CircleAlert, CircleCheck, ClipboardPaste, ExternalLink } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ClipboardEvent } from 'react'
import { ConfirmDialog } from '@/shared/components'
import { cmaSearchUrl, cmaSiteCode, type SearchLink } from '../../services/getSchedule'
import type { ScheduleFile, ServiceRoute } from '../../types'
import { CMA_BOOKMARKLET, CMA_FILLER, CMA_MAX_WEEKS, parseCmaPaste, type CmaSailing } from '../../utils/cmaBookmarklet'
import { weeklyCsv } from '../../utils/weeklyCsv'
// Same look as Hapag-Lloyd's links
import styles from '../HplLinks/HplLinks.module.scss'

type CmaLinksProps = {
  links: SearchLink[]
  /** The card's services, in card order: the file's columns */
  services: ServiceRoute[]
  /** YYYY-MM-DD */
  startDate: string
  onFile: (file: ScheduleFile) => void
  /** Closes the links and drops what was pasted */
  onDiscard: () => void
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const shortDate = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(8, 10)}`

// VUT for HPL_VUT: the plain port, as written in the file's column headers
const plainPort = (port: string) => port.replace(/^[A-Z]+_/, '')

/**
 * CMA CGM's searches, one per POL → POD. The routing finder searches by form, not by URL, so a link
 * opens it with the routes in the hash and the Fill CMA search bookmark fills the form and presses Search.
 * Search all puts every route in one tab: each bookmark click reads the results on screen, copies all
 * found so far and searches the next route. Pasted here, the sailings become a CMA file in Results.
 */
export function CmaLinks({ links, services, startDate, onFile, onDiscard }: CmaLinksProps) {
  // Every route in one tab: each bookmark click searches the next
  const allUrl = cmaSearchUrl(links, startDate)
  const bookmarkRef = useRef<HTMLAnchorElement>(null)
  const pasteId = useId()
  // Found sailings per link (POL-POD key); an empty list was searched and had none
  const [pasted, setPasted] = useState<Record<string, CmaSailing[]>>({})
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string }>()
  const [fillerCopied, setFillerCopied] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const handleDiscard = () => (Object.keys(pasted).length > 0 ? setConfirmingDiscard(true) : onDiscard())

  // React won't render a javascript: href, so the bookmark gets it straight on the element
  useEffect(() => {
    bookmarkRef.current?.setAttribute('href', CMA_BOOKMARKLET)
  }, [])

  const anyPasted = Object.keys(pasted).length > 0

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault()
    try {
      const paste = parseCmaPaste(event.clipboardData.getData('text'))
      const next = { ...pasted }
      let count = 0
      for (const route of paste.routes) {
        const link = links.find((l) => l.from === route.from && l.to === route.to)
        if (!link || !route.sailings) continue
        // Each paste carries the whole run so far, so it replaces what was pasted for that route
        next[link.key] = route.sailings
        count += route.sailings.length
      }
      if (Object.keys(next).length === Object.keys(pasted).length && count === 0) {
        throw new Error("Those searches aren't for the links above.")
      }
      setPasted(next)
      setMessage({ kind: 'success', text: `${count} sailings pasted.` })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Could not read that.' })
    }
  }

  const handleAddToResults = () => {
    const columns = services.flatMap((route) => {
      const link = links.find((l) => l.codes.includes(route.code))
      if (!link) return []
      const found = pasted[link.key]
      // The bookmark names each sailing's service by CMA's code (PEARLAS1 for PEARL)
      const sailings = (found ?? []).filter((s) => s.service === cmaSiteCode(route.code))
      return [
        {
          label: `${route.code}\n(${route.origins.map(plainPort).join('/')} - ${route.destinations.map(plainPort).join('/')})`,
          url: link.url,
          // Not searched, or CMA CGM doesn't run it there in this window
          placeholder: sailings.length === 0 ? 'N/A' : undefined,
          sailings: sailings.map((s) => ({ departure: s.departure, vessel: [s.vessel, s.voyage].filter(Boolean).join(' / ') })),
        },
      ]
    })
    const [year, month, day] = startDate.split('-')
    const createdAt = new Date()
    const name = `CMA-${day}${month}${year}.csv`
    onFile({
      id: `${createdAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdAt: createdAt.toISOString(),
      date: startDate,
      // CMA CGM is always searched for its full 10 weeks, so the file covers them all
      weeks: CMA_MAX_WEEKS,
      services: services.map((route) => route.code),
      content: weeklyCsv(columns, startDate, CMA_MAX_WEEKS, 'CMA', ' / '),
    })
    setMessage({ kind: 'success', text: `${name} was added to Results.` })
  }

  const copyFiller = async () => {
    try {
      await navigator.clipboard.writeText(CMA_FILLER)
      setFillerCopied(true)
    } catch {
      setFillerCopied(false)
    }
  }

  return (
    <div className={styles.root}>
      <h3 className={styles.title}>Search on CMA CGM</h3>

      <div className={styles.install}>
        <a
          ref={bookmarkRef}
          className={styles.bookmark}
          // Only for dragging to the bookmarks bar; clicking it here does nothing
          onClick={(event) => event.preventDefault()}
          title="Drag to your bookmarks bar"
        >
          <Bookmark size={14} aria-hidden="true" />
          Fill CMA search
        </a>
        <p className={styles.hint}>
          Drag this to your bookmarks bar once. Open Search all routes and click the bookmark: it searches the first
          route. Each time the results show, click it again: it copies them and searches the next. After the last
          one, paste here.{' '}
          <button type="button" className={styles.textButton} onClick={copyFiller}>
            {fillerCopied ? 'Copied: paste it in the DevTools console there' : 'Bookmark blocked? Copy it for the console'}
          </button>
        </p>
      </div>

      <p>
        <a href={allUrl} target="_blank" rel="noreferrer" className={styles.add} title={allUrl}>
          Search all {links.length} routes on CMA CGM
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </p>

      <ul className={styles.list}>
        {links.map((link) => {
          const sailings = pasted[link.key]
          const dates = sailings?.map((s) => s.departure).sort()
          return (
            <li key={link.key} className={styles.item}>
              <span className={styles.code}>{link.codes.join(', ')}</span>
              <span className={styles.route}>
                {link.from} → {link.to}
              </span>
              <span className={`${styles.status} ${sailings ? styles.statusDone : ''}`}>
                {sailings
                  ? `${sailings.length} sailings${dates?.length ? ` · ${shortDate(dates[0])} – ${shortDate(dates.at(-1)!)}` : ''}`
                  : 'Not pasted yet'}
              </span>
              <a href={link.url} target="_blank" rel="noreferrer" className={styles.link} title={link.url}>
                Open on CMA CGM
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
        <button type="button" className={styles.add} onClick={handleAddToResults} disabled={!anyPasted}>
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
