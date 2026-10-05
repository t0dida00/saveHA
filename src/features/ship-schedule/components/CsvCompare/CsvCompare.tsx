import { X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ScheduleFile } from '../../types'
import { compareCsv, type CellDiff } from '../../utils/compareCsv'
import { formatReceived } from '../../utils/formatDate'
import { StatusCell } from '../CsvPreview/CsvPreview'
import previewStyles from '../CsvPreview/CsvPreview.module.scss'
import styles from './CsvCompare.module.scss'

type CsvCompareProps = {
  /** Older file, the baseline */
  before: ScheduleFile
  /** Newer file */
  after: ScheduleFile
  onClose: () => void
}

const KIND_LABEL = { added: 'new', removed: 'removed' } as const

function DiffCell({ cell, hideSame }: { cell: CellDiff; hideSame: boolean }) {
  switch (cell.kind) {
    case 'same':
      return hideSame ? <td className={styles.hidden} aria-label="Unchanged" /> : <StatusCell value={cell.value} />
    case 'changed':
      return (
        <td className={styles.changed} data-fill="changed">
          <del className={styles.before}>{cell.before}</del>
          <ins className={styles.after}>{cell.after}</ins>
        </td>
      )
    case 'added':
      return (
        <td className={styles.added} data-fill="added">
          <span className={styles.badge}>new</span>
          <ins className={styles.after}>{cell.after}</ins>
        </td>
      )
    case 'removed':
      return (
        <td className={styles.removed} data-fill="removed">
          <span className={styles.badge}>removed</span>
          <del className={styles.before}>{cell.before}</del>
        </td>
      )
  }
}

// Older vs newer schedule CSV, lined up by week and service, with the differences highlighted
export function CsvCompare({ before, after, onClose }: CsvCompareProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [onlyChanges, setOnlyChanges] = useState(true)
  const diff = useMemo(() => compareCsv(before.content, after.content), [before.content, after.content])

  const changedRows = diff.rows.filter((row) => row.kind !== 'same')
  const rows = onlyChanges ? changedRows : diff.rows
  // Only show changes: drop services with no change in any week too, and blank the unchanged cells left over
  const columns = diff.services
    .map((service, index) => ({ service, index }))
    .filter(
      ({ service, index }) =>
        !onlyChanges || service.kind !== 'same' || changedRows.some((row) => row.cells[index].kind !== 'same'),
    )
  const summary =
    diff.changedCount === 0
      ? 'No differences'
      : `${diff.changedCount} ${diff.changedCount === 1 ? 'change' : 'changes'} in ${changedRows.length} ${changedRows.length === 1 ? 'week' : 'weeks'}`

  // Same StrictMode-safe opening as CsvPreview: no close() in a cleanup
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={previewStyles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className={previewStyles.head}>
        <h2 id={titleId} className={`${previewStyles.title} ${styles.title}`}>
          <span>
            {before.name} <span className={styles.time}>({formatReceived(before.createdAt)})</span>
          </span>
          <span className={styles.arrow} aria-label="compared with">
            →
          </span>
          <span>
            {after.name} <span className={styles.time}>({formatReceived(after.createdAt)})</span>
          </span>
        </h2>
        <button type="button" className={previewStyles.close} onClick={onClose} aria-label="Close comparison" title="Close">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.bar}>
        <p className={`${styles.summary} ${diff.changedCount === 0 ? styles.summarySame : ''}`} role="status">
          {summary}
        </p>
        <label className={styles.toggle}>
          <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} />
          Only show changes
        </label>
      </div>

      <div className={previewStyles.scroll}>
        {rows.length === 0 ? (
          <p className={previewStyles.empty}>
            {onlyChanges ? 'Both files have the same schedule.' : 'These files have no schedule rows.'}
          </p>
        ) : (
          <table className={previewStyles.table}>
            <thead>
              <tr>
                <th scope="col">ONE</th>
                {columns.map(({ service }) => (
                  <th key={service.code} scope="col">
                    {service.label}
                    {service.kind !== 'same' && (
                      <span className={`${styles.badge} ${styles.headBadge}`}>{KIND_LABEL[service.kind]}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.week}>
                  <th scope="row">
                    {row.label}
                    {(row.kind === 'added' || row.kind === 'removed') && (
                      <span className={`${styles.badge} ${styles.headBadge}`}>{KIND_LABEL[row.kind]} week</span>
                    )}
                  </th>
                  {columns.map(({ service, index }) => (
                    <DiffCell key={service.code} cell={row.cells[index]} hideSame={onlyChanges} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.legend} aria-hidden="true">
        <span className={`${styles.swatch} ${styles.changed}`} /> Changed
        <span className={`${styles.swatch} ${styles.added}`} /> Only in newer
        <span className={`${styles.swatch} ${styles.removed}`} /> Only in older
      </div>
    </dialog>
  )
}
