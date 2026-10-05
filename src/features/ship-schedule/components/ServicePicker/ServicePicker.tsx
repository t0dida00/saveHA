import { Check, ChevronDown, Minus } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { formatRoute, SERVICES } from '../../data/services'
import styles from './ServicePicker.module.scss'

type ServicePickerProps = {
  selected: string[]
  onToggle: (code: string) => void
  onToggleAll: () => void
}

export function ServicePicker({ selected, onToggle, onToggleAll }: ServicePickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const allSelected = selected.length === SERVICES.length
  const someSelected = selected.length > 0 && !allSelected

  const label = allSelected
    ? 'All services selected'
    : selected.length === 0
      ? 'Choose services'
      : selected.length === 1
        ? '1 service selected'
        : `${selected.length} services selected`

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
      >
        <span className={selected.length === 0 ? styles.placeholder : undefined}>{label}</span>
        <ChevronDown size={20} aria-hidden="true" className={open ? styles.chevronOpen : styles.chevron} />
      </button>

      {open && (
        <ul id={listId} className={styles.list} role="listbox" aria-multiselectable="true" aria-label="Services">
          <li role="presentation" className={styles.allItem}>
            <button
              type="button"
              role="option"
              aria-selected={allSelected}
              className={styles.option}
              onClick={onToggleAll}
            >
              <span
                className={`${styles.checkbox} ${allSelected || someSelected ? styles.checkboxOn : ''}`}
                aria-hidden="true"
              >
                {allSelected && <Check size={14} strokeWidth={3} />}
                {someSelected && <Minus size={14} strokeWidth={3} />}
              </span>
              <span className={styles.allLabel}>Choose all</span>
            </button>
          </li>
          {SERVICES.map((service) => {
            const isSelected = selected.includes(service.code)
            return (
              <li key={service.code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={styles.option}
                  onClick={() => onToggle(service.code)}
                >
                  <span className={`${styles.checkbox} ${isSelected ? styles.checkboxOn : ''}`} aria-hidden="true">
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span className={styles.code}>{service.code}</span>
                  <span className={styles.route}>{formatRoute(service)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
