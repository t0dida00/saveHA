import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { Fragment, useId, useState, type ClipboardEvent, type FormEvent } from 'react'
import { useConfirmDialog } from '@/shared/components'
import { COLUMN_IDS, type ColumnId } from '../../utils/mapping'
import { addShortNames, matchKey, parseShortNames, type ShortNames } from '../../utils/shortNames'
import styles from './ShortNamesEditor.module.scss'

type ShortNamesEditorProps = {
  shortNames: ShortNames
  onChange: (shortNames: ShortNames) => void
  /** The report's column titles, as the output sample has them */
  titles: Record<ColumnId, string>
}

type Message = { text: string; problem: boolean }

type Draft = { key: number; from: string; to: string }

let nextKey = 0
const emptyDraft = (): Draft => ({ key: nextKey++, from: '', to: '' })

// Pick a column and fill Original text → Short text rows; + adds a row. Every matching value in that column is
// then written short. Pasting several lines (or two columns from Excel) into Original text fills that many rows
export function ShortNamesEditor({ shortNames, onChange, titles }: ShortNamesEditorProps) {
  const columnId = useId()
  const fromId = useId()
  const toId = useId()
  const [column, setColumn] = useState<ColumnId>('Customer type')
  const [drafts, setDrafts] = useState<Draft[]>(() => [emptyDraft()])
  const [message, setMessage] = useState<Message | null>(null)

  const update = (key: number, change: Partial<Draft>) =>
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...change } : draft)))

  const addRow = () => setDrafts((current) => [...current, emptyDraft()])

  const removeRow = (key: number) => setDrafts((current) => current.filter((draft) => draft.key !== key))

  // Several lines pasted into one Original text box become rows of their own
  const onPaste = (key: number, event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text')
    if (!/[\n\t]/.test(text.trim())) return
    event.preventDefault()
    const { rules, skipped } = parseShortNames(text)
    const pasted = [...rules, ...skipped.map((from) => ({ from, to: '' }))].map((rule) => ({
      ...emptyDraft(),
      ...rule,
    }))
    setDrafts((current) => {
      const index = current.findIndex((draft) => draft.key === key)
      const keep = current[index].from || current[index].to ? [current[index]] : []
      return [...current.slice(0, index), ...keep, ...pasted, ...current.slice(index + 1)]
    })
  }

  const filled = drafts.filter((draft) => draft.from.trim() && draft.to.trim())
  const halfFilled = drafts.filter((draft) => Boolean(draft.from.trim()) !== Boolean(draft.to.trim()))

  const { confirm, dialog } = useConfirmDialog()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (filled.length === 0) return
    const rules = filled.map(({ from, to }) => ({ from: from.trim(), to: to.trim() }))
    const existing = shortNames[column] ?? []
    // A value that already has a different short name is a change, so it asks first
    const changes = rules.flatMap((rule) => {
      const known = existing.find(({ from }) => matchKey(from) === matchKey(rule.from))
      return known && known.to !== rule.to ? [{ from: known.from, was: known.to, now: rule.to }] : []
    })
    if (changes.length === 0) return save(rules)
    confirm({
      title: `Change ${changes.length === 1 ? 'a short name' : `${changes.length} short names`}?`,
      confirmLabel: 'Change',
      message: (
        <ul className={styles.changes}>
          {changes.map(({ from, was, now }) => (
            <li key={from}>
              <strong>{from}</strong> in {titles[column]}: {was} → <strong>{now}</strong>
            </li>
          ))}
        </ul>
      ),
      onConfirm: () => save(rules),
    })
  }

  const save = (rules: { from: string; to: string }[]) => {
    onChange({ ...shortNames, [column]: addShortNames(shortNames[column] ?? [], rules) })
    // Rows missing a half stay for finishing; the rest are cleared
    setDrafts(halfFilled.length > 0 ? halfFilled : [emptyDraft()])
    setMessage({
      text:
        `Added ${rules.length} short ${rules.length === 1 ? 'name' : 'names'} to ${titles[column]}.` +
        (halfFilled.length > 0
          ? ` ${halfFilled.length} unfinished ${halfFilled.length === 1 ? 'row' : 'rows'} left.`
          : ''),
      problem: halfFilled.length > 0,
    })
  }

  const remove = (columnKey: ColumnId, index: number) => {
    const rule = shortNames[columnKey]![index]
    confirm({
      title: 'Remove this short name?',
      confirmLabel: 'Remove',
      message: (
        <p>
          <strong>
            {rule.from} → {rule.to}
          </strong>{' '}
          is no longer used in {titles[columnKey]}; the full name is written instead.
        </p>
      ),
      onConfirm: () => {
        const list = (shortNames[columnKey] ?? []).filter((_, i) => i !== index)
        const next = { ...shortNames }
        if (list.length > 0) next[columnKey] = list
        else delete next[columnKey]
        onChange(next)
      },
    })
  }

  const columnsWithNames = COLUMN_IDS.filter((id) => shortNames[id]?.length)

  // Each column's short names fold away under its heading row; all start open
  const listId = useId()
  const [collapsed, setCollapsed] = useState<Set<ColumnId>>(new Set())
  const toggle = (id: ColumnId) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className={styles.editor}>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.rows}>
          <label htmlFor={columnId} className={styles.label}>
            Column
          </label>
          <label htmlFor={`${fromId}-0`} className={styles.label}>
            Original text
          </label>
          <label htmlFor={`${toId}-0`} className={styles.label}>
            Short text
          </label>
          <span />

          {drafts.map((draft, index) => {
            const last = index === drafts.length - 1
            return (
              <Fragment key={draft.key}>
                {index === 0 ? (
                  <div className={styles.selectWrap}>
                    <select
                      id={columnId}
                      className={styles.select}
                      value={column}
                      onChange={(event) => setColumn(event.target.value as ColumnId)}
                    >
                      {COLUMN_IDS.map((id) => (
                        <option key={id} value={id}>
                          {titles[id]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={18} aria-hidden="true" className={styles.selectIcon} />
                  </div>
                ) : (
                  <span className={styles.spacer} />
                )}
                <input
                  id={`${fromId}-${index}`}
                  className={styles.input}
                  value={draft.from}
                  placeholder={index === 0 ? 'Free cargo' : undefined}
                  aria-label={index === 0 ? undefined : `Original text, row ${index + 1}`}
                  onChange={(event) => update(draft.key, { from: event.target.value })}
                  onPaste={(event) => onPaste(draft.key, event)}
                />
                <input
                  id={`${toId}-${index}`}
                  className={styles.input}
                  value={draft.to}
                  placeholder={index === 0 ? 'BCO' : undefined}
                  aria-label={index === 0 ? undefined : `Short text, row ${index + 1}`}
                  onChange={(event) => update(draft.key, { to: event.target.value })}
                />
                {last ? (
                  <button type="button" className={styles.iconButton} onClick={addRow} aria-label="Add another row">
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
            )
          })}
        </div>

        <div className={styles.footer}>
          <p className={styles.hint}>Paste several lines, or two columns from Excel, into Original text to add many.</p>
          <div role="status" className={message?.problem ? styles.messageProblem : styles.message}>
            {message?.text}
          </div>
          <button type="submit" className={styles.add} disabled={filled.length === 0}>
            <Plus size={18} aria-hidden="true" />
            Add short names
          </button>
        </div>
      </form>

      {columnsWithNames.length === 0 ? (
        <p className={styles.empty}>No short names yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.columnHead}>
                Column
              </th>
              <th scope="col">Original text</th>
              <th scope="col">Short text</th>
              <th scope="col">
                <span className={styles.visuallyHidden}>Remove</span>
              </th>
            </tr>
          </thead>
          {columnsWithNames.map((id) => {
            const open = !collapsed.has(id)
            const rowsId = `${listId}-${COLUMN_IDS.indexOf(id)}`
            return (
              <tbody key={id}>
                <tr className={styles.group}>
                  <th scope="colgroup" colSpan={4}>
                    <button
                      type="button"
                      className={styles.toggle}
                      aria-expanded={open}
                      aria-controls={rowsId}
                      onClick={() => toggle(id)}
                    >
                      <ChevronRight
                        size={18}
                        aria-hidden="true"
                        className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
                      />
                      {titles[id]}
                      <span className={styles.count}>{shortNames[id]!.length}</span>
                    </button>
                  </th>
                </tr>
                {shortNames[id]!.map(({ from, to }, index) => (
                  <tr key={from} id={index === 0 ? rowsId : undefined} hidden={!open}>
                    <td className={styles.columnCell}>{titles[id]}</td>
                    <td>{from}</td>
                    <td className={styles.short}>{to}</td>
                    <td className={styles.removeCell}>
                      <button
                        type="button"
                        className={styles.remove}
                        onClick={() => remove(id, index)}
                        aria-label={`Remove ${from} → ${to} from ${titles[id]}`}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )
          })}
        </table>
      )}
      {dialog}
    </div>
  )
}
