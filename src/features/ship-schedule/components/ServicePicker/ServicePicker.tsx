import { Check, ChevronDown, Minus } from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { formatRoute, type Service } from '../../data/services'
import styles from './ServicePicker.module.scss'

type ServicePickerProps = {
  /** The carrier's catalogue */
  services: Service[]
  selected: string[]
  onToggle: (code: string) => void
  onToggleAll: () => void
}

// Tallest the list gets (24rem); it shrinks to the room left on screen
const LIST_MAX_HEIGHT = 384
// Kept clear between the list and the window edge
const EDGE_GAP = 16

export function ServicePicker({ services, selected, onToggle, onToggleAll }: ServicePickerProps) {
  const [open, setOpen] = useState(false)
  // Where the list opens: below the button, or above it when the button sits low on the screen
  const [placement, setPlacement] = useState({ up: false, maxHeight: LIST_MAX_HEIGHT })
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

  const allSelected = selected.length === services.length
  const someSelected = selected.length > 0 && !allSelected

  const toggleOpen = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!open && rect) {
      const below = window.innerHeight - rect.bottom - EDGE_GAP
      const above = rect.top - EDGE_GAP
      const up = below < Math.min(LIST_MAX_HEIGHT, 280) && above > below
      setPlacement({ up, maxHeight: Math.min(LIST_MAX_HEIGHT, up ? above : below) })
    }
    setOpen((o) => !o)
  }

  // The code column fits the longest code (e.g. YANGTSE), so routes line up under each other
  const listStyle = {
    maxHeight: placement.maxHeight,
    // +1: bold capitals run wider than a ch (the width of "0")
    '--code-width': `${Math.max(3, ...services.map((service) => service.code.length)) + 1}ch`,
  } as CSSProperties

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
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
      >
        <span className={selected.length === 0 ? styles.placeholder : undefined}>{label}</span>
        <ChevronDown size={20} aria-hidden="true" className={open ? styles.chevronOpen : styles.chevron} />
      </button>

      {open && (
        <ul
          id={listId}
          className={`${styles.list} ${placement.up ? styles.listUp : ''}`}
          style={listStyle}
          role="listbox"
          aria-multiselectable="true"
          aria-label="Services"
        >
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
          {services.map((service) => {
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
                  <span className={styles.details} title={[service.name, formatRoute(service)].filter(Boolean).join(' · ')}>
                    <span className={styles.route}>{formatRoute(service)}</span>
                    {service.name && <span className={styles.name}>{service.name}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
