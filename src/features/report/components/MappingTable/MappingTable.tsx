import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useConfirmDialog } from '@/shared/components'
import { VOLUME_NOTES } from '../../utils/buildReport'
import {
  CALCULATED,
  COLUMN_IDS,
  type ColumnId,
  INPUT_IDS,
  INPUT_INFO,
  LOOKUP_COLUMNS,
  parseRule,
  type ReportMapping,
  ruleText,
  VOLUME_FIELD_COLUMN,
  type VolumeField,
} from '../../utils/mapping'
import styles from './MappingTable.module.scss'

type MappingTableProps = {
  mapping: ReportMapping
  onChange: (mapping: ReportMapping) => void
}

// Click to edit: Enter or leaving the box saves, Escape cancels (and the blur that follows does not save)
function useInlineEdit(value: string, onSave: (text: string) => void) {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)

  const start = () => {
    cancelled.current = false
    setDraft(value)
  }

  const save = () => {
    if (!cancelled.current && draft !== null && draft.trim() !== value) onSave(draft)
    setDraft(null)
  }

  const inputProps = {
    value: draft ?? '',
    autoFocus: true,
    className: styles.input,
    onChange: (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
    onBlur: save,
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') save()
      if (event.key === 'Escape') {
        cancelled.current = true
        setDraft(null)
      }
    },
  }

  return { editing: draft !== null, start, inputProps }
}

type EditableCellProps = {
  value: string
  /** Shown when the value is empty, e.g. "Empty" or "Calculated from Volume" */
  placeholder: string
  label: string
  className?: string
  note?: string
  onSave: (text: string) => void
}

function EditableCell({ value, placeholder, label, className, note, onSave }: EditableCellProps) {
  const { editing, start, inputProps } = useInlineEdit(value, onSave)

  if (editing) {
    return (
      <td className={styles.editing}>
        <input {...inputProps} placeholder={placeholder} aria-label={label} />
      </td>
    )
  }

  return (
    <td className={className}>
      <button
        type="button"
        className={styles.cellButton}
        aria-label={`${label}: ${value || placeholder}`}
        onClick={start}
      >
        {value || placeholder}
        {note && <span className={styles.note}>{note}</span>}
      </button>
    </td>
  )
}

const VOLUME_FIELD_BY_COLUMN = Object.fromEntries(
  (Object.keys(VOLUME_FIELD_COLUMN) as VolumeField[]).map((field) => [VOLUME_FIELD_COLUMN[field], field]),
) as Partial<Record<ColumnId, VolumeField>>

// Which input column fills each report column. Every cell can be edited; the report reads and writes by it
export function MappingTable({ mapping, onChange }: MappingTableProps) {
  const { confirm, dialog } = useConfirmDialog()

  // Every edit is a change to how the report is read or written, so it asks first, showing old → new
  const ask = (where: string, was: string, now: string, apply: () => void) =>
    confirm({
      title: 'Change the mapping?',
      confirmLabel: 'Change',
      message: (
        <p>
          <strong>{where}</strong>: {was || 'empty'} → <strong>{now || 'empty'}</strong>
        </p>
      ),
      onConfirm: apply,
    })

  const setTitle = (columnId: ColumnId, text: string) => {
    const title = text.trim() || columnId
    if (title === mapping.outputTitles[columnId]) return
    ask(`Report column ${mapping.outputTitles[columnId]}`, mapping.outputTitles[columnId], title, () =>
      onChange({ ...mapping, outputTitles: { ...mapping.outputTitles, [columnId]: title } }),
    )
  }

  const setRule = (inputId: (typeof INPUT_IDS)[number], columnId: ColumnId, text: string) => {
    const rule = parseRule(text)
    const was = ruleText(mapping.inputs[inputId][columnId])
    if (ruleText(rule) === was) return
    ask(`${INPUT_INFO[inputId].name}, ${mapping.outputTitles[columnId]}`, was, ruleText(rule), () => {
      const rules = { ...mapping.inputs[inputId] }
      if (rule) rules[columnId] = rule
      else delete rules[columnId]
      onChange({ ...mapping, inputs: { ...mapping.inputs, [inputId]: rules } })
    })
  }

  const setVolumeTitle = (field: VolumeField, text: string) => {
    const title = text.trim()
    if (!title || title === mapping.volume[field]) return
    ask(`Volume, ${mapping.outputTitles[VOLUME_FIELD_COLUMN[field]]}`, mapping.volume[field], title, () =>
      onChange({ ...mapping, volume: { ...mapping.volume, [field]: title } }),
    )
  }

  return (
    <>
      <div className={styles.scroll} tabIndex={0} role="region" aria-label="Column mapping">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.corner}>
                Report column
              </th>
              {COLUMN_IDS.map((columnId) => (
                <EditableTitle
                  key={columnId}
                  value={mapping.outputTitles[columnId]}
                  label={`Report column title (default ${columnId})`}
                  onSave={(text) => setTitle(columnId, text)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {INPUT_IDS.map((inputId) => {
              const { name, dateColumn } = INPUT_INFO[inputId]
              return (
                <tr key={inputId}>
                  <th scope="row" className={styles.rowHead}>
                    <span className={styles.rowName}>{name}</span>
                    <span className={styles.rowDetail}>Filtered by {mapping.outputTitles[dateColumn]}</span>
                  </th>
                  {COLUMN_IDS.map((columnId) => {
                    // Filled by the Volume lookup, which the Volume row sets
                    if (LOOKUP_COLUMNS.includes(columnId)) return <td key={columnId} />
                    const rule = mapping.inputs[inputId][columnId]
                    const calculated = CALCULATED[columnId]
                    return (
                      <EditableCell
                        key={columnId}
                        value={ruleText(rule)}
                        placeholder={calculated ? `Calculated from ${mapping.outputTitles[calculated.from]}` : 'Empty'}
                        note={!rule && calculated ? calculated.note : undefined}
                        label={`${name}, ${mapping.outputTitles[columnId]}`}
                        className={
                          !rule
                            ? calculated
                              ? styles.derived
                              : styles.empty
                            : 'value' in rule
                              ? styles.fixed
                              : styles.source
                        }
                        onSave={(text) => setRule(inputId, columnId, text)}
                      />
                    )
                  })}
                </tr>
              )
            })}
            <tr>
              <th scope="row" className={styles.rowHead}>
                <span className={styles.rowName}>Volume</span>
                <span className={styles.rowDetail}>Looked up by {mapping.outputTitles['File No.']}</span>
              </th>
              {COLUMN_IDS.map((columnId) => {
                const field = VOLUME_FIELD_BY_COLUMN[columnId]
                if (!field) return <td key={columnId} className={styles.none} />
                return (
                  <EditableCell
                    key={columnId}
                    value={mapping.volume[field]}
                    placeholder={mapping.volume[field]}
                    note={VOLUME_NOTES[field]}
                    label={`Volume, ${mapping.outputTitles[columnId]}`}
                    className={styles.source}
                    onSave={(text) => setVolumeTitle(field, text)}
                  />
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {dialog}
    </>
  )
}

// A report column title in the header row; an empty title goes back to the default
function EditableTitle({ value, label, onSave }: { value: string; label: string; onSave: (text: string) => void }) {
  const { editing, start, inputProps } = useInlineEdit(value, onSave)

  return (
    <th scope="col">
      {editing ? (
        <input {...inputProps} aria-label={label} />
      ) : (
        <button type="button" className={styles.titleButton} aria-label={`${label}: ${value}`} onClick={start}>
          {value}
        </button>
      )}
    </th>
  )
}
