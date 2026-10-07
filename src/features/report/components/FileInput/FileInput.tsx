import { FileSpreadsheet, Upload, X } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import { formatFileSize, isSpreadsheetFile, SPREADSHEET_ACCEPT } from '../../utils/spreadsheetFiles'
import styles from './FileInput.module.scss'

type FileInputProps = {
  title: string
  description: string
  /** Multiple files can be added; otherwise a new file replaces the current one */
  multiple?: boolean
  files: File[]
  onChange: (files: File[]) => void
}

// Same name, size and modified time counts as the same file
const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`

// CSV / Excel picker: drop files on it or browse, then remove any from the list
export function FileInput({ title, description, multiple = false, files, onChange }: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const errorId = useId()
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return
    const accepted = incoming.filter(isSpreadsheetFile)
    const rejected = incoming.filter((file) => !isSpreadsheetFile(file))

    if (!multiple && accepted.length > 1) {
      setError('Only one file can be added here.')
      return
    }
    setError(
      rejected.length > 0
        ? `${rejected.map((file) => file.name).join(', ')} ${rejected.length === 1 ? 'is' : 'are'} not a CSV or Excel file.`
        : null,
    )
    if (accepted.length === 0) return

    if (multiple) {
      const known = new Set(files.map(fileKey))
      onChange([...files, ...accepted.filter((file) => !known.has(fileKey(file)))])
    } else {
      onChange([accepted[0]])
    }
  }

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
    setError(null)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    addFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p className={styles.description}>{description}</p>
      </div>

      <div
        className={`${styles.drop} ${dragging ? styles.dragging : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <Upload size={24} aria-hidden="true" className={styles.dropIcon} />
        <p className={styles.dropText}>
          Drop {multiple ? 'files' : 'a file'} here or{' '}
          <button type="button" className={styles.browse} onClick={() => inputRef.current?.click()}>
            browse
          </button>
        </p>
        <p className={styles.hint}>CSV or Excel (.csv, .xlsx, .xls){multiple ? ', several at once' : ', one file'}</p>
        <input
          ref={inputRef}
          type="file"
          className={styles.input}
          accept={SPREADSHEET_ACCEPT}
          multiple={multiple}
          aria-labelledby={titleId}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []))
            // Let the same file be picked again after it was removed
            event.target.value = ''
          }}
        />
      </div>

      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}

      {files.length > 0 && (
        <ul className={styles.list}>
          {files.map((file, index) => (
            <li key={fileKey(file)} className={styles.file}>
              <FileSpreadsheet size={18} aria-hidden="true" className={styles.fileIcon} />
              <span className={styles.fileName} title={file.name}>
                {file.name}
              </span>
              <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
              <button
                type="button"
                className={styles.remove}
                onClick={() => removeFile(index)}
                aria-label={`Remove ${file.name}`}
                title="Remove"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
