import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { PREVIEW_ROWS, readPreview, type FilePreview as Preview } from '../../utils/previewFile'
import styles from './FilePreview.module.scss'

type FilePreviewProps = {
  file: File
  onClose: () => void
}

type State = { kind: 'loading' } | { kind: 'ready'; preview: Preview } | { kind: 'error'; message: string }

// Modal table of a file's titles and first rows, to check it is the right file before building the report
export function FilePreview({ file, onClose }: FilePreviewProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [state, setState] = useState<State>({ kind: 'loading' })

  // No close() in a cleanup: in StrictMode its late "close" event would cancel the dialog right after it opens
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  useEffect(() => {
    let cancelled = false
    readPreview(file)
      .then((preview) => !cancelled && setState({ kind: 'ready', preview }))
      .catch(
        (error) =>
          !cancelled &&
          setState({ kind: 'error', message: error instanceof Error ? error.message : 'This file cannot be read.' }),
      )
    return () => {
      cancelled = true
    }
  }, [file])

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title} title={file.name}>
            {file.name}
          </h2>
          {state.kind === 'ready' && (
            <p className={styles.meta}>
              {state.preview.sheet && `Sheet "${state.preview.sheet}" · `}
              {state.preview.totalRows > PREVIEW_ROWS
                ? `First ${PREVIEW_ROWS} of ${state.preview.totalRows.toLocaleString()} rows`
                : `${state.preview.totalRows} ${state.preview.totalRows === 1 ? 'row' : 'rows'}`}
              {state.preview.headerRow > 1 && ` · titles on row ${state.preview.headerRow}`}
            </p>
          )}
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close preview" autoFocus>
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.body}>
        {state.kind === 'loading' && <p className={styles.note}>Reading the file…</p>}
        {state.kind === 'error' && (
          <p className={styles.error} role="alert">
            {state.message}
          </p>
        )}
        {state.kind === 'ready' && (
          <div className={styles.scroll} tabIndex={0} aria-label={`First rows of ${file.name}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {state.preview.titles.map((title, index) => (
                    <th key={index} scope="col">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.preview.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, index) => (
                      <td key={index} title={cell.length > 40 ? cell : undefined}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </dialog>
  )
}
