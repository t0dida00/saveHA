import { MessageCircle, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { AssistantChat } from '../AssistantChat/AssistantChat'
import styles from './AssistantBubble.module.scss'

/** Round chat button at the bottom-right of every page; opens "Ask about schedules" over the page */
export function AssistantBubble() {
  const [open, setOpen] = useState(false)
  const chatId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Focus goes back to the bubble so keyboard users don't lose their place
  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <>
      <AssistantChat id={chatId} open={open} onClose={close} />
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.bubble} ${open ? styles.bubbleOpen : ''}`}
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={chatId}
        aria-label={open ? 'Close chat' : 'Ask about schedules'}
        title={open ? 'Close chat' : 'Ask about schedules'}
      >
        {open ? <X size={20} aria-hidden="true" /> : <MessageCircle size={20} aria-hidden="true" />}
      </button>
    </>
  )
}
