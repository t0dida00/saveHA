import { CircleCheck, Download, Eye } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import type { BuiltReport } from '../../utils/buildReport'
import styles from './ReportCreatedDialog.module.scss'

type ReportCreatedDialogProps = {
  name: string
  /** The From–To range, already formatted */
  range: string
  report: Omit<BuiltReport, 'buffer'>
  /** Every Sea and Air input that had a file, so ones with no rows are listed too */
  inputNames: string[]
  onPreview: () => void
  onDownload: () => void
  onClose: () => void
}

const countText = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

// Shown once a report is built: what went into it, with Preview and Download. Nothing downloads until asked
export function ReportCreatedDialog({
  name,
  range,
  report,
  inputNames,
  onPreview,
  onDownload,
  onClose,
}: ReportCreatedDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  // No close() in a cleanup: in StrictMode its late "close" event would cancel the dialog right after it opens
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const warnings = report.missing.length + (report.unmatchedFileNos.length > 0 ? 1 : 0)

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className={styles.body}>
        <span className={styles.icon} aria-hidden="true">
          <CircleCheck size={24} />
        </span>
        <div className={styles.content}>
          <h2 id={titleId} className={styles.title}>
            Report created
          </h2>
          <p className={styles.name}>{name}</p>
          <p className={styles.meta}>
            {range} · {countText(report.rowCount, 'row')}
          </p>

          <ul className={styles.inputs}>
            {inputNames.map((inputName) => {
              const counts = report.byInput.find((input) => input.name === inputName)
              return (
                <li key={inputName}>
                  <span className={styles.inputName}>{inputName}</span>
                  <span>
                    <strong>{countText(counts?.rowCount ?? 0, 'row')}</strong>
                    {counts && counts.cancelledCount > 0 && `, ${counts.cancelledCount} BKCANCELLATION left out`}
                  </span>
                </li>
              )
            })}
          </ul>

          {warnings > 0 && (
            <p className={styles.warning}>
              {countText(warnings, 'warning')} below the Create report button: some columns or File Nos were not found.
            </p>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.secondary} onClick={onClose}>
          Close
        </button>
        <button type="button" className={styles.secondary} onClick={onPreview}>
          <Eye size={18} aria-hidden="true" />
          Preview
        </button>
        <button type="button" className={styles.primary} onClick={onDownload} autoFocus>
          <Download size={18} aria-hidden="true" />
          Download
        </button>
      </div>
    </dialog>
  )
}
