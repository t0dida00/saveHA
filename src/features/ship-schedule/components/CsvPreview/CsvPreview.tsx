import { X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef } from 'react'
import type { ScheduleFile } from '../../types'
import { cellStatus, isLink } from '../../utils/cellStatus'
import { parseCsv } from '../../utils/parseCsv'
import styles from './CsvPreview.module.scss'

type CsvPreviewProps = {
  file: ScheduleFile
  onClose: () => void
}

function Cell({ value }: { value: string }) {
  if (isLink(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer" className={styles.link}>
        Open on {value.includes('hapag-lloyd.com') ? 'Hapag-Lloyd' : value.includes('cma-cgm.com') ? 'CMA CGM' : 'ONE'} ↗
      </a>
    )
  }
  return value
}

// N/A cells are filled red, OMIT cells light yellow
export function StatusCell({ value }: { value: string }) {
  const status = cellStatus(value)
  return (
    <td className={status && styles[status]} data-fill={status}>
      <Cell value={value} />
    </td>
  )
}

// Modal table view of a CSV file: the first row is the header, the first column labels each row
export function CsvPreview({ file, onClose }: CsvPreviewProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [header = [], ...rows] = useMemo(() => parseCsv(file.content), [file.content])

  // No close() in a cleanup: in StrictMode its late "close" event would shut the preview right after it opens.
  // Unmounting removes the dialog from the page, which also takes it out of the modal layer.
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {file.name}
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close preview" title="Close">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.scroll}>
        {header.length === 0 ? (
          <p className={styles.empty}>This file is empty.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                {header.map((cell, index) => (
                  <th key={index} scope="col">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) =>
                    index === 0 ? (
                      <th key={index} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <StatusCell key={index} value={cell} />
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </dialog>
  )
}
