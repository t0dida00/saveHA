import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, GripVertical, X } from 'lucide-react'
import { useId, useState } from 'react'
import { formatRoute, formatWebsiteCodes, portChoices, type Service } from '../../data/services'
import { usePortCodes } from '../../data/portCodesStore'
import type { PortSide, ServiceRoute } from '../../types'
import styles from './RouteCard.module.scss'

type RouteCardProps = {
  service: Service
  route: ServiceRoute
  onTogglePort: (side: PortSide, port: string) => void
  onRemove: () => void
}

const SIDES: { side: PortSide; label: string }[] = [
  { side: 'origins', label: 'Origin' },
  { side: 'destinations', label: 'Destination' },
]

// One accordion item: the header shows the route summary, the body holds the port chips
export function RouteCard({ service, route, onTogglePort, onRemove }: RouteCardProps) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const incomplete = route.origins.length === 0 || route.destinations.length === 0
  const portCodes = usePortCodes()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: service.code,
  })

  return (
    <li
      ref={setNodeRef}
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <div className={styles.head}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={styles.handle}
          aria-label={`Move ${service.code}`}
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} aria-hidden="true" />
        </button>
        <h3 className={styles.heading}>
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={bodyId}
          >
            <ChevronDown size={20} aria-hidden="true" className={open ? styles.chevronOpen : styles.chevron} />
            <span className={styles.code}>{service.code}</span>
            <span className={styles.route}>
              {formatRoute(route)} <span className={styles.websiteCodes}>({formatWebsiteCodes(route, portCodes)})</span>
            </span>
            {incomplete && <span className={styles.badge}>Needs ports</span>}
          </button>
        </h3>
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={`Remove ${service.code}`}
          title={`Remove ${service.code}`}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div id={bodyId} className={styles.body} hidden={!open}>
        {SIDES.map(({ side, label }) => (
          <div key={side} className={styles.row} role="group" aria-label={`${service.code} ${label}`}>
            <span className={styles.label}>{label}</span>
            <div className={styles.chips}>
              {portChoices(side, route[side], portCodes).map((port) => {
                const on = route[side].includes(port)
                return (
                  <button
                    key={port}
                    type="button"
                    className={`${styles.chip} ${on ? styles.chipOn : ''}`}
                    aria-pressed={on}
                    onClick={() => onTogglePort(side, port)}
                  >
                    {port}
                  </button>
                )
              })}
            </div>
            {route[side].length === 0 && <p className={styles.warning}>Pick at least one {label.toLowerCase()}.</p>}
          </div>
        ))}
      </div>
    </li>
  )
}
