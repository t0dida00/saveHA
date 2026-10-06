import { Send, SquarePen, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { askSchedules, type ChatMessage } from '../../services/askSchedules'
import styles from './AssistantChat.module.scss'

const STORAGE_KEY = 'saveha.assistantChat'

// GitHub-flavored Markdown adds tables, which answers use for voyage lists
const REMARK_PLUGINS = [remarkGfm]

// Wide tables scroll sideways inside the answer instead of stretching the page on phones
const MARKDOWN_COMPONENTS: Components = {
  table: ({ node: _node, ...props }) => (
    <div className={styles.tableWrap}>
      <table {...props} />
    </div>
  ),
}

const SUGGESTIONS = [
  'How many voyages does MS2 have?',
  'List the voyages of PS7.',
  'Are there any differences between the last 2 files?',
]

function readChat(): ChatMessage[] {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

// ONE-06102026.csv → 10/06/2026, the app's mm/dd/yyyy
function fileDate(file: string) {
  const match = file.match(/(\d{2})(\d{2})(\d{4})/)
  return match ? `${match[2]}/${match[1]}/${match[3]}` : file
}

type AssistantChatProps = {
  id: string
  open: boolean
  onClose: () => void
}

/**
 * Chat about the last 3 schedules the API's weekly job saved, in a panel over the page.
 * Stays mounted while closed, so an answer still arriving isn't lost.
 */
export function AssistantChat({ id, open, onClose }: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(readChat)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Kept for this tab only, so a reload doesn't lose the conversation
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // Not persisted; the chat still works for this visit
    }
  }, [messages])

  // Newest message at the bottom of the panel; scrolls only the panel, never the page
  useEffect(() => {
    const list = messagesRef.current
    if (open && list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [messages, pending, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function ask(question: string) {
    const text = question.trim()
    if (!text || pending) return

    const conversation: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(conversation)
    setInput('')
    setError(undefined)
    setPending(true)
    try {
      const { answer, files } = await askSchedules(conversation)
      setMessages([...conversation, { role: 'assistant', content: answer, files }])
    } catch (err) {
      // Take the unanswered question back into the box so it can be sent again
      setMessages(messages)
      setInput(text)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setPending(false)
      inputRef.current?.focus()
    }
  }

  const startOver = () => {
    setMessages([])
    setError(undefined)
    inputRef.current?.focus()
  }

  return (
    <section
      id={id}
      className={styles.panel}
      hidden={!open}
      aria-labelledby={`${id}-title`}
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
    >
      <header className={styles.header}>
        <h2 id={`${id}-title`} className={styles.title}>
          Ask about schedules
        </h2>
        {messages.length > 0 && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={startOver}
            disabled={pending}
            aria-label="New chat"
            title="New chat"
          >
            <SquarePen size={18} aria-hidden="true" />
          </button>
        )}
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close chat" title="Close">
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className={styles.chat}>
        <div ref={messagesRef} className={styles.messages} aria-live="polite">
          {messages.length === 0 && (
            <div className={styles.empty}>
              <p className={styles.emptyIntro}>
                Ask about the last 3 schedules the weekly job saved: voyages per service, or what changed between
                files.
              </p>
              <p className={styles.emptyTitle}>Try asking</p>
              <ul className={styles.suggestions}>
                {SUGGESTIONS.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      className={styles.suggestion}
                      onClick={() => ask(suggestion)}
                      disabled={pending}
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {messages.map((message, i) =>
            message.role === 'user' ? (
              <p key={i} className={`${styles.message} ${styles.user}`}>
                {message.content}
              </p>
            ) : (
              <div key={i} className={`${styles.message} ${styles.assistant}`}>
                <div className={styles.markdown}>
                  <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
                    {message.content}
                  </Markdown>
                </div>
                {message.files && message.files.length > 0 && (
                  <p className={styles.sources}>Based on schedules from {message.files.map(fileDate).join(', ')}</p>
                )}
              </div>
            ),
          )}

          {pending && (
            <p className={`${styles.message} ${styles.assistant} ${styles.thinking}`} role="status">
              <span className={styles.dots} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Looking through the schedules…
            </p>
          )}
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault()
            ask(input)
          }}
        >
          <label htmlFor={`${id}-question`} className={styles.srOnly}>
            Your question
          </label>
          <textarea
            id={`${id}-question`}
            ref={inputRef}
            className={styles.input}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter adds a new line
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                ask(input)
              }
            }}
            placeholder="e.g. How many voyages does EC2 have?"
            rows={1}
            maxLength={2000}
            disabled={pending}
          />
          <button type="submit" className={styles.send} disabled={pending || !input.trim()} aria-label="Send">
            <Send size={15} aria-hidden="true" />
          </button>
        </form>
      </div>
    </section>
  )
}
