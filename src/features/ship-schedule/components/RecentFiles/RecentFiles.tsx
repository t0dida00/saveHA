import { CircleAlert, CircleCheck, Download, Eye, FileText, GitCompare, Info, RefreshCw, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { ConfirmDialog } from '@/shared/components'
import type { Carrier } from '../../data/services'
import { MAX_FILES } from '../../hooks/useRecentFiles'
import type { ScheduleFile } from '../../types'
import { downloadFile } from '../../utils/downloadFile'
import { fileCarrier } from '../../utils/fileCarrier'
import { formatQueryDate, formatReceived } from '../../utils/formatDate'
import { CsvCompare } from '../CsvCompare/CsvCompare'
import { CsvPreview } from '../CsvPreview/CsvPreview'
import styles from './RecentFiles.module.scss'

export type UpdateState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

type RecentFilesProps = {
  files: ScheduleFile[]
  onRemove: (id: string) => void
  /** Fetch the newest file made by the API's scheduled job */
  onUpdate: () => void
  update: UpdateState
  /** ISO timestamp of the last successful Update */
  lastUpdate?: string
}

const CARRIERS: { carrier: Carrier; name: string }[] = [
  { carrier: 'one', name: 'ONE' },
  { carrier: 'hpl', name: 'Hapag-Lloyd' },
]

function formatSize(text: string) {
  const bytes = new Blob([text]).size
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

function formatQuery(file: ScheduleFile) {
  if (file.scheduled || !file.date) return 'Scheduled run on the server'
  const services = !file.services || file.services === 'all' ? 'All services' : file.services.join(', ')
  return `${formatQueryDate(file.date)} · ${file.weeks} weeks · ${services}`
}

// Only the name shows; the info button reveals when it was received, its size and its query
type FileItemProps = {
  file: ScheduleFile
  selected: boolean
  /** Why the checkbox is off: two others are ticked, or a file of the other carrier is */
  selectDisabledReason?: string
  onSelect: () => void
  onPreview: () => void
  onRemove: () => void
}

function FileItem({ file, selected, selectDisabledReason, onSelect, onPreview, onRemove }: FileItemProps) {
  const [showInfo, setShowInfo] = useState(false)
  const infoId = useId()

  return (
    <li className={`${styles.item} ${selected ? styles.itemSelected : ''}`}>
      <input
        type="checkbox"
        className={styles.select}
        checked={selected}
        disabled={Boolean(selectDisabledReason)}
        onChange={onSelect}
        aria-label={`Select ${file.name} to compare`}
        title={selectDisabledReason ?? 'Select to compare'}
      />
      <FileText size={20} aria-hidden="true" className={styles.icon} />
      <div className={styles.info}>
        <p className={styles.name} title={file.name}>
          {file.name}
        </p>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.iconButton} ${showInfo ? styles.iconButtonOn : ''}`}
          onClick={() => setShowInfo((v) => !v)}
          aria-expanded={showInfo}
          aria-controls={infoId}
          aria-label={`Information about ${file.name}`}
          title="Information"
        >
          <Info size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onPreview}
          aria-label={`Preview ${file.name}`}
          title="Preview"
        >
          <Eye size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => downloadFile(file)}
          aria-label={`Download ${file.name}`}
          title="Download"
        >
          <Download size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onRemove}
          aria-label={`Delete ${file.name}`}
          title="Delete"
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
      {showInfo && (
        <div id={infoId} className={styles.details}>
          <p className={styles.meta}>
            <time dateTime={file.createdAt}>{formatReceived(file.createdAt)}</time> ·{' '}
            {formatSize(file.content)}
          </p>
          <p className={styles.meta}>{formatQuery(file)}</p>
        </div>
      )}
    </li>
  )
}

export function RecentFiles({ files, onRemove, onUpdate, update, lastUpdate }: RecentFilesProps) {
  const titleId = useId()
  const [previewId, setPreviewId] = useState<string>()
  const previewFile = files.find((file) => file.id === previewId)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  const [deleteId, setDeleteId] = useState<string>()
  const deleteFile = files.find((file) => file.id === deleteId)

  // Ignore ids of files that were deleted or pushed out of the list
  const selectedFiles = files.filter((file) => selectedIds.includes(file.id))
  // Older file first: it is the baseline the newer one is compared against
  const [before, after] = [...selectedFiles].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  // Files are only compared within one carrier: once one is ticked, the other carrier's can't be
  const selectedCarrier = selectedFiles[0] && fileCarrier(selectedFiles[0])

  // At most 2: other checkboxes are disabled once two are ticked
  const toggleSelected = (id: string) => {
    const current = selectedFiles.map((file) => file.id)
    setSelectedIds(current.includes(id) ? current.filter((other) => other !== id) : [...current, id].slice(-2))
  }

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          Results
        </h2>
        <div className={styles.update}>
          <button
            type="button"
            className={styles.updateButton}
            onClick={onUpdate}
            disabled={update.status === 'loading'}
            aria-busy={update.status === 'loading'}
            title="Get the newest file from the scheduled job"
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              className={update.status === 'loading' ? styles.spinning : undefined}
            />
            {update.status === 'loading' ? 'Updating…' : 'Update'}
          </button>
          <p className={styles.lastUpdate}>
            {lastUpdate ? (
              <>
                Last update: <time dateTime={lastUpdate}>{formatReceived(lastUpdate)}</time>
              </>
            ) : (
              'Not updated yet'
            )}
          </p>
        </div>
      </div>

      <div aria-live="polite">
        {update.status === 'error' && (
          <p className={`${styles.notice} ${styles.noticeError}`} role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {update.message}
          </p>
        )}
        {update.status === 'success' && (
          <p className={`${styles.notice} ${styles.noticeSuccess}`}>
            <CircleCheck size={16} aria-hidden="true" />
            {update.message}
          </p>
        )}
      </div>

      {files.length > 1 && (
        <div className={styles.compareBar}>
          <p className={styles.compareHint}>
            {selectedFiles.length === 2 ? 'Ready to compare' : 'Tick 2 files of one carrier to compare'}
          </p>
          {selectedFiles.length > 0 && (
            <button type="button" className={styles.textButton} onClick={() => setSelectedIds([])}>
              Clear
            </button>
          )}
          <button
            type="button"
            className={styles.compareButton}
            onClick={() => setComparing(true)}
            disabled={selectedFiles.length !== 2}
          >
            <GitCompare size={16} aria-hidden="true" />
            Compare ({selectedFiles.length}/2)
          </button>
        </div>
      )}

      {CARRIERS.map(({ carrier, name }) => {
        const carrierFiles = files.filter((file) => fileCarrier(file) === carrier)
        const otherCarrierTicked = selectedCarrier !== undefined && selectedCarrier !== carrier
        return (
          <section key={carrier} aria-label={`${name} files`}>
            <h3 className={styles.groupTitle}>
              {name}
              <span className={styles.groupCount}>{carrierFiles.length}</span>
            </h3>
            {carrierFiles.length === 0 ? (
              <p className={styles.empty}>
                {carrier === 'one'
                  ? 'Files from Get Schedule and Update show up here.'
                  : 'Files from Get Links → Add to Results show up here.'}{' '}
                The {MAX_FILES} most recent are kept.
              </p>
            ) : (
              <ul className={styles.list}>
                {carrierFiles.map((file) => (
                  <FileItem
                    key={file.id}
                    file={file}
                    selected={selectedFiles.includes(file)}
                    selectDisabledReason={
                      selectedFiles.includes(file)
                        ? undefined
                        : otherCarrierTicked
                          ? 'Compare files from the same carrier'
                          : selectedFiles.length >= 2
                            ? 'Two files are already selected'
                            : undefined
                    }
                    onSelect={() => toggleSelected(file.id)}
                    onPreview={() => setPreviewId(file.id)}
                    onRemove={() => setDeleteId(file.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}

      {previewFile && <CsvPreview file={previewFile} onClose={() => setPreviewId(undefined)} />}
      {comparing && before && after && <CsvCompare before={before} after={after} onClose={() => setComparing(false)} />}
      {deleteFile && (
        <ConfirmDialog
          title="Delete this file?"
          confirmLabel="Delete"
          onConfirm={() => {
            onRemove(deleteFile.id)
            setDeleteId(undefined)
          }}
          onCancel={() => setDeleteId(undefined)}
        >
          <p>
            <strong>{deleteFile.name}</strong> ({formatReceived(deleteFile.createdAt)}) will be removed from Results.
            This can't be undone.
          </p>
        </ConfirmDialog>
      )}
    </section>
  )
}
