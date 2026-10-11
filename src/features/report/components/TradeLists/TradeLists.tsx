import { Plus, Search, X } from 'lucide-react'
import { useId, useMemo, useState, type FormEvent } from 'react'
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

// One lane's list: its ports as chips to remove, and a box to add one
function TradeList({
  trade,
  ports,
  filter,
  matched,
  onAdd,
  onRemove,
}: {
  trade: Trade
  ports: string[]
  /** Only names containing this are shown, plus the matched one */
  filter: string
  /** The listed name Find a port matched, highlighted */
  matched: string | null
  /** Adds a name, reporting what happened once it is done (a move asks first) */
  onAdd: (trade: Trade, name: string, report: (message: string) => void) => void
  onRemove: (trade: Trade, port: string) => void
}) {
  const titleId = useId()
  const inputId = useId()
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const shown = [...ports].sort().filter((port) => !filter || port.includes(filter) || port === matched)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    onAdd(trade, draft, setMessage)
    setDraft('')
  }

  return (
    <section className={styles.list} aria-labelledby={titleId}>
      <div className={styles.listHead}>
        <h3 id={titleId} className={styles.listTitle}>
          {trade}
        </h3>
        <span className={styles.count}>
          {ports.length} {ports.length === 1 ? 'name' : 'names'}
        </span>
      </div>
      <p className={styles.listDescription}>{DESCRIPTIONS[trade]}</p>

      <form className={styles.add} onSubmit={submit}>
        <label htmlFor={inputId} className={styles.visuallyHidden}>
          Add a port or airport to {trade}
        </label>
        <input
          id={inputId}
          className={styles.addInput}
          value={draft}
          placeholder="Add a port or airport"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className={styles.addButton} aria-label={`Add to ${trade}`} disabled={!draft.trim()}>
          <Plus size={18} aria-hidden="true" />
        </button>
      </form>
      <p className={styles.message} role="status">
        {message}
      </p>

      {shown.length === 0 ? (
        <p className={styles.empty}>{ports.length === 0 ? 'No names yet.' : `No names with ${filter}.`}</p>
      ) : (
        <ul className={styles.chips}>
          {shown.map((port) => (
            <li key={port} className={`${styles.chip} ${port === matched ? styles.chipMatched : ''}`}>
              {port}
              <button
                type="button"
                className={styles.remove}
                onClick={() => onRemove(trade, port)}
                aria-label={`Remove ${port} from ${trade}`}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// The TP, EU, Asia and Other lists the Trade column is worked out from
export function TradeLists({ ports, onChange }: TradeListsProps) {
  const findId = useId()
  const [query, setQuery] = useState('')
  const match = useMemo(() => createTradeMatcher(ports), [ports])
  const filter = cleanPort(query)
  const found = filter ? match(query) : null

  // Names are kept the way they are matched (capitals, no INT'L or PT); a name on another list moves here
  const { confirm, dialog } = useConfirmDialog()

  const add = (trade: Trade, name: string, report: (message: string) => void) => {
    const port = cleanPort(name)
    if (!port) return
    if (ports[trade].includes(port)) return report(`${port} is already on ${trade}.`)
    const from = TRADES.find((other) => other !== trade && ports[other].includes(port))
    if (!from) {
      onChange({ ...ports, [trade]: [...ports[trade], port] })
      return report(`${port} added.`)
    }
    // Already on another lane, so adding it here changes its lane
    confirm({
      title: `Move ${port} to ${trade}?`,
      confirmLabel: 'Move',
      message: `${port} is on the ${from} list. Moving it makes the report give ${trade} instead of ${from}.`,
      onConfirm: () => {
        onChange({
          ...ports,
          [from]: ports[from].filter((known) => known !== port),
          [trade]: [...ports[trade], port],
        })
        report(`${port} moved here from ${from}.`)
      },
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
        <label htmlFor={findId} className={styles.findLabel}>
          Find a port
        </label>
        <div className={styles.findBox}>
          <Search size={18} aria-hidden="true" className={styles.findIcon} />
          <input
            id={findId}
            type="search"
            className={styles.findInput}
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

      <div className={styles.grid}>
        {TRADES.map((trade) => (
          <TradeList
            key={trade}
            trade={trade}
            ports={ports[trade]}
            filter={filter}
            matched={found?.port ?? null}
            onAdd={add}
            onRemove={remove}
          />
        ))}
      </div>
      {dialog}
    </div>
  )
}
