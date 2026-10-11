import { Check, Circle, Eye, FileDown, FileSpreadsheet, X } from 'lucide-react'
import { useId, useState } from 'react'
import { PageHeader } from '@/shared/components'
import { FileInput } from '../../components/FileInput/FileInput'
import { FilePreview } from '../../components/FilePreview/FilePreview'
import { WeekPicker } from '../../components/WeekPicker/WeekPicker'
import { useSavedOutputSample } from '../../hooks/useSavedOutputSample'
import {
  AIR_EXPORT,
  AIR_IMPORT,
  buildReport,
  type BuiltReport,
  type InputKind,
  type ReportInput,
  SEA_EXPORT,
  SEA_IMPORT,
} from '../../utils/buildReport'
import { detectInput, type InputSlot } from '../../utils/detectInput'
import { downloadWorkbookFile } from '../../utils/excel'
import { formatFileSize } from '../../utils/spreadsheetFiles'
import { addDays, formatDay, weekOfRange } from '../../utils/weeks'
import styles from './ReportPage.module.scss'

// The input categories, one file each, in the order their chips show
const SLOTS = [
  { key: 'seaImport', name: 'Sea Import' },
  { key: 'seaExport', name: 'Sea Export' },
  { key: 'airImport', name: 'Air Import' },
  { key: 'airExport', name: 'Air Export' },
  { key: 'volume', name: 'Volume' },
] as const

type SlotKey = (typeof SLOTS)[number]['key']

// Inputs the report is built from, in the order their rows go into it
const SUPPORTED_INPUTS: { key: Exclude<SlotKey, 'volume'>; kind: InputKind }[] = [
  { key: 'seaExport', kind: SEA_EXPORT },
  { key: 'seaImport', kind: SEA_IMPORT },
  { key: 'airExport', kind: AIR_EXPORT },
  { key: 'airImport', kind: AIR_IMPORT },
]

type Status =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; report: Omit<BuiltReport, 'buffer'>; inputNames: string[] }
  | { kind: 'error'; message: string }

// "a, b and c"
const listText = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : (items[0] ?? '')

const countText = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

// FINAL-REPORT-dd-mm-yyyy for the day it is created; "/" cannot be used in file names, so the parts are joined by "-"
const reportFileName = (date: Date) => {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `FINAL-REPORT-${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}.xlsx`
}

const SLOT_NAMES: Record<InputSlot, string> = {
  seaImport: 'Sea Import',
  seaExport: 'Sea Export',
  airImport: 'Air Import',
  airExport: 'Air Export',
  volume: 'Volume',
  outputSample: 'Output sample',
}

// Notes from the last drop on "Add files"; placed files show on the chips and in the list instead
type SortStatus =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'tooMany'; count: number }
  | { kind: 'done'; notes: { name: string; text: string; problem: boolean }[] }

// One file per category: Sea Import, Sea Export, Air Import, Air Export and Volume
const MAX_FILES = 5

export function ReportPage() {
  const inputsTitleId = useId()
  const createTitleId = useId()
  const fromId = useId()
  const toId = useId()
  const weekLabelId = useId()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [outputSample, setOutputSample] = useSavedOutputSample()
  const [files, setFiles] = useState<Record<SlotKey, File | null>>({
    seaImport: null,
    seaExport: null,
    airImport: null,
    airExport: null,
    volume: null,
  })
  const [sortStatus, setSortStatus] = useState<SortStatus>({ kind: 'idle' })
  const [previewing, setPreviewing] = useState<File | null>(null)

  // Files dropped on "Add files" go to their category, by name or else by what is in them. A category holds one
  // file, so a new one replaces it; a second file for the same category in one drop is skipped
  const addFiles = async (dropped: File[]) => {
    if (dropped.length > MAX_FILES) {
      setSortStatus({ kind: 'tooMany', count: dropped.length })
      return
    }
    setSortStatus({ kind: 'working' })
    const slots = await Promise.all(dropped.map(detectInput))
    const placed = new Map<InputSlot, string>()
    const notes: { name: string; text: string; problem: boolean }[] = []
    const next = { ...files }
    dropped.forEach((file, index) => {
      const slot = slots[index]
      if (!slot) {
        notes.push({ name: file.name, text: 'not recognised as a Sea, Air or Volume file', problem: true })
        return
      }
      const first = placed.get(slot)
      if (first) {
        notes.push({
          name: file.name,
          text: `skipped, ${first} is already the ${SLOT_NAMES[slot]} file`,
          problem: true,
        })
        return
      }
      placed.set(slot, file.name)
      if (slot === 'outputSample') {
        setOutputSample([file])
        notes.push({ name: file.name, text: 'set as the output sample', problem: false })
        return
      }
      const replaced = next[slot]
      if (replaced && replaced.name !== file.name) {
        notes.push({ name: file.name, text: `replaced ${replaced.name} as ${SLOT_NAMES[slot]}`, problem: false })
      }
      next[slot] = file
    })
    setFiles(next)
    setSortStatus({ kind: 'done', notes })
  }

  const removeFile = (key: SlotKey) => setFiles((current) => ({ ...current, [key]: null }))

  const reportInputs: ReportInput[] = SUPPORTED_INPUTS.flatMap(({ key, kind }) => {
    const file = files[key]
    return file ? [{ kind, file }] : []
  })
  const missing = [
    outputSample.length === 0 && 'an output sample',
    reportInputs.length === 0 && 'a Sea or Air file',
    !files.volume && 'a Volume file',
    !from && 'a From date',
    !to && 'a To date',
  ].filter((item) => item !== false)
  const rangeInvalid = Boolean(from && to && from > to)
  const working = status.kind === 'working'

  const createReport = async () => {
    setStatus({ kind: 'working' })
    try {
      const sample = outputSample[0]
      const { buffer, ...report } = await buildReport(sample, reportInputs, files.volume!, { from, to })
      downloadWorkbookFile(buffer, reportFileName(new Date()))
      // Every Sea and Air input with a file, in the chips' order
      const inputNames = SLOTS.filter(({ key }) => key !== 'volume' && files[key]).map(({ name }) => name)
      setStatus({ kind: 'done', report, inputNames })
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'The report could not be created.' })
    }
  }

  return (
    <>
      <PageHeader title="Report" description="Add a sample of the output you want and the files to build it from." />
      <div className={styles.sections}>
        <FileInput
          title="Output sample"
          description="One Excel file showing how the report should look. It is kept in this browser for next time."
          files={outputSample}
          onChange={setOutputSample}
          onPreview={setPreviewing}
        />
        <section className={styles.inputs} aria-labelledby={inputsTitleId}>
          <div>
            <h2 id={inputsTitleId} className={styles.title}>
              Inputs
            </h2>
            <p className={styles.description}>
              Drop the Sea, Air and Volume files here, up to {MAX_FILES}. Each is sorted into its category by a name
              like SEA-EXPORT or AIR-IMPORT, or else by its File Nos.
            </p>
          </div>
          <FileInput title="Add files" label="Add input files" compact multiple files={[]} onChange={addFiles} />

          <ul className={styles.chips} aria-label="Categories">
            {SLOTS.map(({ key, name }) => {
              const file = files[key]
              return (
                <li key={key} className={`${styles.chip} ${file ? styles.chipDone : ''}`}>
                  {file ? (
                    <Check size={16} aria-hidden="true" className={styles.chipIcon} />
                  ) : (
                    <Circle size={16} aria-hidden="true" className={styles.chipIcon} />
                  )}
                  {name}
                  <span className={styles.visuallyHidden}>{file ? `: ${file.name}` : ': no file yet'}</span>
                </li>
              )
            })}
          </ul>

          <div role="status">
            {sortStatus.kind === 'working' && <p className={styles.sortNote}>Sorting the files…</p>}
            {sortStatus.kind === 'tooMany' && (
              <p className={styles.sortProblem} role="alert">
                {sortStatus.count} files is too many. Add up to {MAX_FILES}: Sea Import, Sea Export, Air Import, Air
                Export and Volume.
              </p>
            )}
            {sortStatus.kind === 'done' && sortStatus.notes.length > 0 && (
              <ul className={styles.sortList}>
                {sortStatus.notes.map(({ name, text, problem }) => (
                  <li key={name} className={problem ? styles.sortProblem : styles.sortNote}>
                    <span className={styles.sortFile}>{name}</span>: {text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {SLOTS.some(({ key }) => files[key]) && (
            <ul className={styles.fileList}>
              {SLOTS.map(({ key, name }) => {
                const file = files[key]
                if (!file) return null
                return (
                  <li key={key} className={styles.file}>
                    <FileSpreadsheet size={18} aria-hidden="true" className={styles.fileIcon} />
                    <span className={styles.fileName} title={file.name}>
                      {file.name}
                    </span>
                    <span className={styles.fileTag}>{name}</span>
                    <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      className={styles.fileAction}
                      onClick={() => setPreviewing(file)}
                      aria-label={`Preview ${file.name}`}
                      title="Preview"
                    >
                      <Eye size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`${styles.fileAction} ${styles.fileRemove}`}
                      onClick={() => removeFile(key)}
                      aria-label={`Remove ${file.name}`}
                      title="Remove"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <section className={styles.create} aria-labelledby={createTitleId}>
        <div>
          <h2 id={createTitleId} className={styles.title}>
            Create report
          </h2>
          <p className={styles.description}>
            Fills the output sample from the Sea and Air files, with customer and sales details from the Volume file.
            Pick a week, or set From and To: export files are filtered by ETD, import files by ETA.
          </p>
        </div>
        <div className={styles.fields}>
          <div className={styles.field}>
            <span id={weekLabelId} className={styles.label}>
              Week
            </span>
            <div role="group" aria-labelledby={weekLabelId}>
              <WeekPicker
                value={weekOfRange(from, to)}
                onChange={(monday) => {
                  setFrom(formatDay(monday))
                  setTo(formatDay(addDays(monday, 6)))
                }}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={fromId}>
              From
            </label>
            <input
              id={fromId}
              className={styles.control}
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={toId}>
              To
            </label>
            <input
              id={toId}
              className={styles.control}
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={styles.primary}
            disabled={missing.length > 0 || rangeInvalid || working}
            aria-busy={working}
            onClick={createReport}
          >
            <FileDown size={20} aria-hidden="true" />
            {working ? 'Creating…' : 'Create report'}
          </button>
        </div>
        <p className={styles.status} role="status">
          {missing.length > 0 && `Add ${listText(missing)} to create the report.`}
          {missing.length === 0 && rangeInvalid && 'From must be on or before To.'}
          {missing.length === 0 &&
            !rangeInvalid &&
            status.kind === 'done' &&
            (status.report.rowCount === 0
              ? 'No rows to add in that range. The report was downloaded empty.'
              : `Report downloaded with ${countText(status.report.rowCount, 'row')}:`)}
        </p>
        {missing.length === 0 && !rangeInvalid && status.kind === 'done' && (
          <ul className={styles.breakdown}>
            {status.inputNames.map((name) => {
              const counts = status.report.byInput.find((input) => input.name === name)
              return (
                <li key={name} className={styles.breakdownRow}>
                  <span className={styles.breakdownName}>{name}</span>
                  {counts ? (
                    <span>
                      <strong>{countText(counts.rowCount, 'row')}</strong>
                      {counts.cancelledCount > 0 &&
                        `, ${countText(counts.cancelledCount, 'cancelled booking')} (BKCANCELLATION) left out`}
                    </span>
                  ) : (
                    <span className={styles.breakdownNote}>file added, not used in the report yet</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {missing.length === 0 && status.kind === 'done' && status.report.missing.length > 0 && (
          <p className={styles.warning} role="alert">
            Not found, so left empty: {status.report.missing.join(', ')}.
          </p>
        )}
        {missing.length === 0 && status.kind === 'done' && status.report.unmatchedFileNos.length > 0 && (
          <p className={styles.warning} role="alert">
            Not in the Volume file, so Shipment Type to Salesman and Own or Coload are empty for{' '}
            {status.report.unmatchedFileNos.length} File {status.report.unmatchedFileNos.length === 1 ? 'No.' : 'Nos.'}:{' '}
            {status.report.unmatchedFileNos.join(', ')}.
          </p>
        )}
        {status.kind === 'error' && (
          <p className={styles.error} role="alert">
            {status.message}
          </p>
        )}
      </section>
      {previewing && <FilePreview file={previewing} onClose={() => setPreviewing(null)} />}
    </>
  )
}
