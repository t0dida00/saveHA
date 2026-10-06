export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  /** Schedule files the answer was based on, newest first; assistant messages only */
  files?: string[]
}

export type ChatAnswer = {
  /** Markdown */
  answer: string
  /** e.g. ["ONE-06102026.csv", "ONE-05102026.csv"] */
  files: string[]
}

// The API accepts at most 20 messages, so older turns drop off a long conversation
const MAX_MESSAGES = 20

export class ChatApiNotConfiguredError extends Error {
  constructor() {
    super("The schedule API isn't connected yet. Set HOST_URL in .env and restart the dev server.")
    this.name = 'ChatApiNotConfiguredError'
  }
}

// The API keeps no history, so every request carries the whole conversation
export async function askSchedules(messages: ChatMessage[]): Promise<ChatAnswer> {
  if (!__HOST_URL__) throw new ChatApiNotConfiguredError()

  const response = await fetch(`${__HOST_URL__}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.slice(-MAX_MESSAGES).map(({ role, content }) => ({ role, content })),
    }),
  })
  if (response.ok) return response.json()

  // Errors are JSON like { "error": "..." }, written to be shown to the user
  const body = await response.json().catch(() => undefined)
  if (response.status === 404) throw new Error("There are no saved schedules yet. The weekly job hasn't run.")
  throw new Error(body?.error ?? `Schedule API returned ${response.status} ${response.statusText}`)
}
