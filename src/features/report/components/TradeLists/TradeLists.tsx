import { ChevronDown, ChevronRight, Plus, Search, X } from 'lucide-react'
import { Fragment, useId, useMemo, useState, type ClipboardEvent, type FormEvent } from 'react'
import { useConfirmDialog } from '@/shared/components'
import { cleanPort, createTradeMatcher, TRADES, type Trade } from '../../utils/trade'
import styles from './TradeLists.module.scss'

type TradeListsProps = {
  ports: Record<Trade, string[]>
  onChange: (ports: Record<Trade, string[]>) => void
}

const DESCRIPTIONS: Record<Trade, string> = {
  TP: 'US and Canada, inland points included',
  EU: 'Europe, the UK and Turkey',
  Asia: 'Asia and the Middle East',
  Other: 'Kept as Other even when the name contains a listed one',
}

type Draft = { key: number; port: string }
type Message = { text: string; problem: boolean }

let nextKey = 0
const emptyDraft = (): Draft => ({ key: nextKey++, port: '' })

// Find a port, then add ports to an area (several rows at once), then the four areas as accordions of chips
export function TradeLists({ ports, onChange }: TradeListsProps) {
  const findId = useId()
  const areaId = useId()
  const portId = useId()
  const listId = useId()
  const { confirm, dialog } = useConfirmDialog()

  const [query, setQuery] = useState('')
  const match = useMemo(() => createTradeMatcher(ports), [ports])
  const filter = cleanPort(query)
  const found = filter ? match(query) : null

  const [area, setArea] = useState<Trade>('TP')
  const [drafts, setDrafts] = useState<Draft[]>(() => [emptyDraft()])
  const [message, setMessage] = useState<Message | null>(null)
  const [open, setOpen] = useState<Set<Trade>>(new Set())

  const toggle = (trade: Trade) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(trade)) next.delete(trade)
      else next.add(trade)
      return next
    })

  const update = (key: number, port: string) =>
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, port } : draft)))

  const addRow = () => setDrafts((current) => [...current, emptyDraft()])

  const removeRow = (key: number) => setDrafts((current) => current.filter((draft) => draft.key !== key))

  // Several lines pasted into one Port box become rows of their own
  const onPaste = (key: number, event: ClipboardEvent<HTMLInputElement>) => {
    const lines = event.clipboardData
      .getData('text')
      .split(/[\r\n\t]+/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length < 2) return
    event.preventDefault()
    setDrafts((current) => {
      const index = current.findIndex((draft) => draft.key === key)
      const keep = current[index].port ? [current[index]] : []
      const pasted = lines.map((port) => ({ ...emptyDraft(), port }))
      return [...current.slice(0, index), ...keep, ...pasted, ...current.slice(index + 1)]
    })
  }

  const filled = drafts.filter((draft) => cleanPort(draft.port))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const names = [...new Set(filled.map((draft) => cleanPort(draft.port)))]
    if (names.length === 0) return

    const already = names.filter((port) => ports[area].includes(port))
    const moves = names.flatMap((port) => {
      const from = TRADES.find((other) => other !== area && ports[other].includes(port))
      return from ? [{ port, from }] : []
    })
    const added = names.filter((port) => !already.includes(port) && !moves.some((move) => move.port === port))

    const save = (withMoves: boolean) => {
      const next = { ...ports }
      const moving = withMoves ? moves : []
      for (const { port, from } of moving) next[from] = next[from].filter((known) => known !== port)
      next[area] = [...next[area], ...added, ...moving.map(({ port }) => port)]
      onChange(next)
      setDrafts([emptyDraft()])
      setOpen((current) => new Set(current).add(area))
      const parts = [
        added.length > 0 && `Added ${added.length} to ${area}.`,
        moving.length > 0 && `Moved ${moving.length} to ${area}.`,
        already.length > 0 && `${already.join(', ')} ${already.length === 1 ? 'was' : 'were'} already on ${area}.`,
        !withMoves && moves.length > 0 && `${moves.length} left where ${moves.length === 1 ? 'it was' : 'they were'}.`,
      ].filter(Boolean)
      setMessage({ text: parts.join(' '), problem: added.length === 0 && moving.length === 0 })
    }

    if (moves.length === 0) return save(false)
    // Already on another area, so adding them here changes their lane
    confirm({
      title: moves.length === 1 ? `Move ${moves[0].port} to ${area}?` : `Move ${moves.length} ports to ${area}?`,
      confirmLabel: 'Move',
      message: (
        <ul className={styles.changes}>
          {moves.map(({ port, from }) => (
            <li key={port}>
              <strong>{port}</strong>: {from} → <strong>{area}</strong>
            </li>
          ))}
        </ul>
      ),
      onConfirm: () => save(true),
    })
  }

  const remove = (trade: Trade, port: string) =>
    confirm({
      title: `Remove ${port} from ${trade}?`,
      confirmLabel: 'Remove',
      message:
        trade === 'Other'
          ? `${port} can then match a lane through a listed name it contains.`
          : `PODs with ${port} are then Other, unless they match another listed name.`,
      onConfirm: () => onChange({ ...ports, [trade]: ports[trade].filter((known) => known !== port) }),
    })

  return (
    <div className={styles.lanes}>
      <div className={styles.find}>
        <label htmlFor={findId} className={styles.label}>
          Find a port
        </label>
        <div className={styles.findBox}>
          <Search size={18} aria-hidden="true" className={styles.findIcon} />
          <input
            id={findId}
            type="search"
            className={`${styles.input} ${styles.findInput}`}
            value={query}
            placeholder="A port or airport, as the files write it"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <p className={styles.findResult} role="status">
          {found && (
            <>
              <strong>{query.trim()}</strong> → <strong>{found.trade}</strong>
              {found.port
                ? found.port === filter
                  ? ` (on the ${found.trade} list)`
                  : `, matched by ${found.port}`
                : ', on no list'}
            </>
          )}
        </p>
      </div>

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.rows}>
          <label htmlFor={areaId} className={styles.label}>
            Area
          </label>
          <label htmlFor={`${portId}-0`} className={styles.label}>
            Port or airport
          </label>
          <span />

          {drafts.map((draft, index) => (
            <Fragment key={draft.key}>
              {index === 0 ? (
                <div className={styles.selectWrap}>
                  <select
                    id={areaId}
                    className={`${styles.input} ${styles.select}`}
                    value={area}
                    onChange={(event) => setArea(event.target.value as Trade)}
                  >
                    {TRADES.map((trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} aria-hidden="true" className={styles.selectIcon} />
                </div>
              ) : (
                <span />
              )}
              <input
                id={`${portId}-${index}`}
                className={styles.input}
                value={draft.port}
                placeholder={index === 0 ? 'Memphis' : undefined}
                aria-label={index === 0 ? undefined : `Port or airport, row ${index + 1}`}
                onChange={(event) => update(draft.key, event.target.value)}
                onPaste={(event) => onPaste(draft.key, event)}
              />
              {index === drafts.length - 1 ? (
                <button type="button" className={styles.iconButton} onClick={addRow} aria-label="Add another port">
                  <Plus size={20} aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.removeRow}`}
                  onClick={() => removeRow(draft.key)}
                  aria-label={`Remove row ${index + 1}`}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              )}
            </Fragment>
          ))}
        </div>

        <div className={styles.footer}>
          <p className={styles.hint}>
            Names are kept in capitals without INT'L, AIRPORT or PT. Paste several lines into a box to add many.
          </p>
          <div role="status" className={message?.problem ? styles.messageProblem : styles.message}>
            {message?.text}
          </div>
          <button type="submit" className={styles.add} disabled={filled.length === 0}>
            <Plus size={18} aria-hidden="true" />
            Add ports
          </button>
        </div>
      </form>

      <div className={styles.container}>
        {TRADES.map((trade) => {
          const shown = [...ports[trade]]
            .sort()
            .filter((port) => !filter || port.includes(filter) || port === found?.port)
          // While searching, areas with a match open on their own
          const expanded = filter ? shown.length > 0 : open.has(trade)
          const panelId = `${listId}-${trade}`
          return (
            <section key={trade} className={styles.area}>
              <h3 className={styles.areaHeading}>
                <button
                  type="button"
                  className={styles.toggle}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => toggle(trade)}
                  disabled={Boolean(filter)}
                >
                  <ChevronRight
                    size={18}
                    aria-hidden="true"
                    className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
                  />
                  <span className={styles.areaName}>{trade}</span>
                  <span className={styles.areaDescription}>{DESCRIPTIONS[trade]}</span>
                  <span className={styles.count}>
                    {filter ? `${shown.length} of ${ports[trade].length}` : ports[trade].length}{' '}
                    {ports[trade].length === 1 ? 'name' : 'names'}
                  </span>
                </button>
              </h3>
              <div id={panelId} className={styles.panel} hidden={!expanded}>
                {shown.length === 0 ? (
                  <p className={styles.empty}>No names yet.</p>
                ) : (
                  <ul className={styles.chips}>
                    {shown.map((port) => (
                      <li key={port} className={`${styles.chip} ${port === found?.port ? styles.chipMatched : ''}`}>
                        {port}
                        <button
                          type="button"
                          className={styles.remove}
                          onClick={() => remove(trade, port)}
                          aria-label={`Remove ${port} from ${trade}`}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )
        })}
      </div>
      {dialog}
    </div>
  )
}
