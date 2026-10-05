import { TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './ConfirmDialog.module.scss'

type ConfirmDialogProps = {
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

// Modal warning before a destructive action. Cancel has focus first, so Enter or Esc never deletes by accident.
export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const messageId = useId()

  // No close() in a cleanup: in StrictMode its late "close" event would cancel the dialog right after it opens
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onClose={onCancel}
      // A click on the backdrop lands on the dialog element itself
      onClick={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div className={styles.body}>
        <span className={styles.icon} aria-hidden="true">
          <TriangleAlert size={22} />
        </span>
        <div>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <div id={messageId} className={styles.message}>
            {children}
          </div>
        </div>
      </div>
      <div className={styles.footer}>
        <button type="button" className={styles.cancel} onClick={onCancel} autoFocus>
          Cancel
        </button>
        <button type="button" className={styles.confirm} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
