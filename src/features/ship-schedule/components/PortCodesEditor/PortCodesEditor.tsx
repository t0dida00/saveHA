import { CircleAlert, CircleCheck, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { DEFAULT_PORT_CODES, setPortCodes, usePortCodes, type PortCode } from '../../data/portCodesStore'
import { ALL_PORTS } from '../../data/services'
import styles from './PortCodesEditor.module.scss'

type Row = PortCode & { id: number }

let nextId = 0
const toRows = (codes: PortCode[]): Row[] => codes.map((entry) => ({ ...entry, id: nextId++ }))

const toList = (rows: Row[]): PortCode[] =>
  rows.map(({ code, websiteCode, isOrigin }) => ({ code: code.trim(), websiteCode: websiteCode.trim(), isOrigin }))

const sameList = (a: PortCode[], b: PortCode[]) => JSON.stringify(a) === JSON.stringify(b)

// Codes are letters and digits only, always upper case; a code may have one carrier prefix like HPL/
const clean = (value: string) => value.toUpperCase().replace(/[^A-Z0-9/]/g, '').replace(/(\/.*)\//g, '$1')

/** Settings table: each port code (HPH) and the code the ONE website uses for it (VNHPH), plus carrier rows like HPL/VUT */
export function PortCodesEditor() {
  const saved = usePortCodes()
  const [rows, setRows] = useState(() => toRows(saved))
  const [status, setStatus] = useState<'idle' | 'saved' | 'storageFailed'>('idle')
  const titleId = useId()

  const draft = toList(rows)
  const isDirty = !sameList(draft, saved)
  const isDefault = sameList(draft, DEFAULT_PORT_CODES)

  // Per-row problems: empty fields and repeated codes
  const errors = useMemo(() => {
    const counts = new Map<string, number>()
    rows.forEach((row) => counts.set(row.code, (counts.get(row.code) ?? 0) + 1))
    return new Map(
      rows.map((row) => [
        row.id,
        !row.code || !row.websiteCode
          ? 'Fill in both codes.'
          : (counts.get(row.code) ?? 0) > 1
            ? `${row.code} is listed more than once.`
            : undefined,
      ]),
    )
  }, [rows])
  const hasErrors = [...errors.values()].some(Boolean)
  // Ports a service uses but that have no website code: Get Schedule fails for them
  const missing = ALL_PORTS.filter((port) => !rows.some((row) => row.code === port && row.websiteCode))

  const update = (id: number, field: 'code' | 'websiteCode', value: string) => {
    setStatus('idle')
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: clean(value) } : row)))
  }

  const setOrigin = (id: number, isOrigin: boolean) => {
    setStatus('idle')
    setRows((current) => current.map((row) => (row.id === id ? { ...row, isOrigin } : row)))
  }

  const addRow = () => {
    setStatus('idle')
    setRows((current) => [...current, { id: nextId++, code: '', websiteCode: '', isOrigin: false }])
  }

  const removeRow = (id: number) => {
    setStatus('idle')
    setRows((current) => current.filter((row) => row.id !== id))
  }

  const handleSave = () => {
    if (hasErrors) return
    setStatus(setPortCodes(draft) ? 'saved' : 'storageFailed')
  }

  const handleCancel = () => {
    setRows(toRows(saved))
    setStatus('idle')
  }

  const handleReset = () => {
    setRows(toRows(DEFAULT_PORT_CODES))
    setStatus('idle')
  }

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.body}>
        <div className={styles.head}>
          <div>
            <h2 id={titleId} className={styles.title}>
              Port codes
            </h2>
            <p className={styles.intro}>
              The code each port uses on the ONE website, e.g. HPH → VNHPH. Where Hapag-Lloyd uses a different
              code, add it as HPL/ plus the port, e.g. HPL/VUT → VNVUT; other ports use the same code on both. Ports
              ticked Origin are listed under Origin on each service; all others under Destination.
            </p>
          </div>
          <button
            type="button"
            className={styles.textButton}
            onClick={handleReset}
            disabled={isDefault}
            title="Put back the original list of codes"
          >
            <RotateCcw size={16} aria-hidden="true" />
            Reset to default
          </button>
        </div>

        <div className={styles.table}>
          <div className={styles.headerRow} aria-hidden="true">
            <span>Code</span>
            <span />
            <span>Website code</span>
            <span className={styles.originHeader}>Origin</span>
            <span />
          </div>
          {rows.map((row) => {
            const error = errors.get(row.id)
            return (
              <div key={row.id} className={styles.row}>
                <input
                  className={`${styles.input} ${error ? styles.inputError : ''}`}
                  value={row.code}
                  onChange={(e) => update(row.id, 'code', e.target.value)}
                  placeholder="HPH"
                  maxLength={10}
                  aria-label={`Code ${row.code}`.trim()}
                  aria-invalid={Boolean(error)}
                />
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
                <input
                  className={`${styles.input} ${error ? styles.inputError : ''}`}
                  value={row.websiteCode}
                  onChange={(e) => update(row.id, 'websiteCode', e.target.value)}
                  placeholder="VNHPH"
                  maxLength={10}
                  aria-label={`Website code for ${row.code || 'new code'}`}
                  aria-invalid={Boolean(error)}
                />
                <label className={styles.originCell} title="List under Origin on each service">
                  <input
                    type="checkbox"
                    checked={row.isOrigin}
                    onChange={(e) => setOrigin(row.id, e.target.checked)}
                    aria-label={`${row.code || 'New code'} is an origin`}
                  />
                </label>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => removeRow(row.id)}
                  aria-label={`Remove ${row.code || 'this row'}`}
                  title="Remove"
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
                {error && <p className={styles.rowError}>{error}</p>}
              </div>
            )
          })}
        </div>

        <button type="button" className={styles.addButton} onClick={addRow}>
          <Plus size={18} aria-hidden="true" />
          Add code
        </button>

        {missing.length > 0 && (
          <p className={styles.warning}>
            <CircleAlert size={18} aria-hidden="true" />
            No website code for {missing.join(', ')}. Services using {missing.length === 1 ? 'it' : 'them'} can't get a
            schedule.
          </p>
        )}
      </div>

      <footer className={styles.footer}>
        <p
          className={`${styles.status} ${status === 'saved' ? styles.statusSaved : ''} ${status === 'storageFailed' ? styles.statusError : ''}`}
          role="status"
        >
          {status === 'saved' && !isDirty ? (
            <>
              <CircleCheck size={16} aria-hidden="true" /> Saved
            </>
          ) : status === 'storageFailed' ? (
            "Saved for now, but this browser couldn't keep it after a reload."
          ) : isDirty ? (
            'Unsaved changes'
          ) : (
            ''
          )}
        </p>
        <button type="button" className={styles.secondary} onClick={handleCancel} disabled={!isDirty}>
          Cancel
        </button>
        <button type="button" className={styles.primary} onClick={handleSave} disabled={!isDirty || hasErrors}>
          Save
        </button>
      </footer>
    </section>
  )
}
