import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

export type ConfirmOptions = {
  title: string
  message: ReactNode
  confirmLabel: string
  onConfirm: () => void
}

/**
 * Asks before a change or delete: `confirm(...)` opens the warning and runs `onConfirm` only if the user agrees.
 * Render `dialog` somewhere in the component.
 */
export function useConfirmDialog() {
  const [pending, setPending] = useState<ConfirmOptions | null>(null)

  const dialog = pending && (
    <ConfirmDialog
      title={pending.title}
      confirmLabel={pending.confirmLabel}
      onConfirm={() => {
        pending.onConfirm()
        setPending(null)
      }}
      onCancel={() => setPending(null)}
    >
      {typeof pending.message === 'string' ? <p>{pending.message}</p> : pending.message}
    </ConfirmDialog>
  )

  return { confirm: setPending, dialog }
}
