import { FileDown } from 'lucide-react'
import { useId, useState } from 'react'
import { PageHeader } from '@/shared/components'
import { FileInput } from '../../components/FileInput/FileInput'
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
import { downloadWorkbookFile } from '../../utils/excel'
import styles from './ReportPage.module.scss'

const INPUT_GROUPS = [
  {
    title: 'Sea',
    inputs: [
      { key: 'seaImport', title: 'Import' },
      { key: 'seaExport', title: 'Export' },
    ],
  },
  {
    title: 'Air',
    inputs: [
      { key: 'airImport', title: 'Import' },
      { key: 'airExport', title: 'Export' },
    ],
  },
] as const

type InputKey = (typeof INPUT_GROUPS)[number]['inputs'][number]['key']

// Inputs the report can be built from so far, in the order their rows go into it
const SUPPORTED_INPUTS: { key: InputKey; kind: InputKind }[] = [
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

export function ReportPage() {
  const inputsTitleId = useId()
  const createTitleId = useId()
  const fromId = useId()
  const toId = useId()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [outputSample, setOutputSample] = useSavedOutputSample()
  const [volume, setVolume] = useState<File[]>([])
  const [inputs, setInputs] = useState<Record<InputKey, File[]>>({
    seaImport: [],
    seaExport: [],
    airImport: [],
    airExport: [],
  })

  const reportInputs: ReportInput[] = SUPPORTED_INPUTS.flatMap(({ key, kind }) =>
    inputs[key].map((file) => ({ kind, file })),
  )
  const missing = [
    outputSample.length === 0 && 'an output sample',
    reportInputs.length === 0 && 'a Sea or Air file',
    volume.length === 0 && 'a Volume file',
    !from && 'a From date',
    !to && 'a To date',
  ].filter((item) => item !== false)
  const rangeInvalid = Boolean(from && to && from > to)
  const working = status.kind === 'working'

  const createReport = async () => {
    setStatus({ kind: 'working' })
    try {
      const sample = outputSample[0]
      const { buffer, ...report } = await buildReport(sample, reportInputs, volume[0], { from, to })
      downloadWorkbookFile(buffer, reportFileName(new Date()))
      // Every input with a file, in the page's order, so ones the report cannot use yet are listed too
      const inputNames = INPUT_GROUPS.flatMap((group) =>
        group.inputs.filter(({ key }) => inputs[key].length > 0).map(({ title }) => `${group.title} ${title}`),
      )
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
        />
        <section className={styles.inputs} aria-labelledby={inputsTitleId}>
          <div>
            <h2 id={inputsTitleId} className={styles.title}>
              Inputs
            </h2>
            <p className={styles.description}>The CSV or Excel files the report is built from.</p>
          </div>
          {INPUT_GROUPS.map((group) => (
            <div key={group.title} className={styles.group}>
              <h3 className={styles.groupTitle}>{group.title}</h3>
              <div className={styles.groupInputs}>
                {group.inputs.map(({ key, title }) => (
                  <FileInput
                    key={key}
                    title={title}
                    label={`${group.title} ${title}`}
                    compact
                    multiple
                    files={inputs[key]}
                    onChange={(files) => setInputs((current) => ({ ...current, [key]: files }))}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className={styles.group}>
            <FileInput title="Volume" label="Volume report" compact files={volume} onChange={setVolume} />
          </div>
        </section>
      </div>

      <section className={styles.create} aria-labelledby={createTitleId}>
        <div>
          <h2 id={createTitleId} className={styles.title}>
            Create report
          </h2>
          <p className={styles.description}>
            Fills the output sample from the Sea and Air files, with customer and sales details from the Volume file.
            Pick the date range: export files are filtered by ETD, import files by ETA.
          </p>
        </div>
        <div className={styles.fields}>
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
    </>
  )
}
