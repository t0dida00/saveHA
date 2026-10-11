import { X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { readPreview, type FilePreview as Preview } from '../../utils/previewFile'
import styles from './FilePreview.module.scss'

type FilePreviewProps = {
  file: File
  onClose: () => void
}

type State = { kind: 'loading' } | { kind: 'ready'; preview: Preview } | { kind: 'error'; message: string }

// Rows are one line (cut with …) and all the same height, so the rows in view follow from the scroll position.
// This is a first guess; the real height is measured once rows are drawn
const ROW_HEIGHT = 29
// Rows drawn above and below the visible ones, so fast scrolling does not show gaps
const OVERSCAN = 15

// Column widths from the titles and the first rows, so they stay put while other rows scroll in
function columnWidths(preview: Preview) {
  const sample = [preview.titles, ...preview.rows.slice(0, 300)]
  return preview.titles.map((_, i) => {
    const longest = Math.max(...sample.map((row) => (row[i] ?? '').length))
    return Math.min(288, Math.max(72, longest * 7.5 + 20))
  })
}

// The whole sheet as a table; only the rows in view are drawn, so files with thousands of rows stay quick
function PreviewTable({ preview, label }: { preview: Preview; label: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(600)
  const [rowHeight, setRowHeight] = useState(ROW_HEIGHT)
  const widths = useMemo(() => columnWidths(preview), [preview])

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewport(element.clientHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // A guess off by even 1px adds up over thousands of rows, so the drawn height is measured once per file
  useLayoutEffect(() => {
    const drawn = scrollRef.current?.querySelector<HTMLTableRowElement>('tbody tr[aria-rowindex]')
    const height = drawn?.getBoundingClientRect().height
    if (height) setRowHeight(height)
  }, [preview])

  const { rows } = preview
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN)
  const last = Math.min(rows.length, Math.ceil((scrollTop + viewport) / rowHeight) + OVERSCAN)

  return (
    <div
      ref={scrollRef}
      className={styles.scroll}
      tabIndex={0}
      role="region"
      aria-label={label}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <table className={styles.table} aria-rowcount={rows.length + 1}>
        <colgroup>
          {widths.map((width, i) => (
            <col key={i} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr aria-rowindex={1}>
            {preview.titles.map((title, index) => (
              <th key={index} scope="col">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {first > 0 && <tr aria-hidden="true" style={{ height: first * rowHeight }} />}
          {rows.slice(first, last).map((row, offset) => {
            const index = first + offset
            return (
              <tr key={index} aria-rowindex={index + 2} className={index % 2 ? styles.striped : undefined}>
                {row.map((cell, column) => (
                  <td key={column} title={cell.length > 30 ? cell : undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            )
          })}
          {last < rows.length && <tr aria-hidden="true" style={{ height: (rows.length - last) * rowHeight }} />}
        </tbody>
      </table>
    </div>
  )
}

// Modal table of a whole file, to check it is the right file or look through a report
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
              {state.preview.rows.length.toLocaleString()} {state.preview.rows.length === 1 ? 'row' : 'rows'}
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
        {state.kind === 'ready' && <PreviewTable preview={state.preview} label={`Rows of ${file.name}`} />}
      </div>
    </dialog>
  )
}
