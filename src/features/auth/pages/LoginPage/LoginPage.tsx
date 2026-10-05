import { Eye, EyeOff } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import styles from './LoginPage.module.scss'

export function LoginPage() {
  const { signIn } = useAuth()
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [shaking, setShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const errorId = useId()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password || pending) return
    setPending(true)
    const valid = await signIn(password)
    if (!valid) {
      setPending(false)
      setHasError(true)
      setShaking(true)
      inputRef.current?.select()
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <h1 className={styles.title}>Sign in to SaveHA</h1>
        <p className={styles.intro}>Make sure you're Hai Anh.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.label} htmlFor={inputId}>
            Password
          </label>
          <div
            className={`${styles.field} ${hasError ? styles.fieldError : ''} ${shaking ? styles.shake : ''}`}
            onAnimationEnd={() => setShaking(false)}
          >
            <input
              ref={inputRef}
              id={inputId}
              className={styles.input}
              type={visible ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setHasError(false)
              }}
              autoComplete="current-password"
              autoFocus
              aria-invalid={hasError}
              aria-describedby={hasError ? errorId : undefined}
            />
            <button
              type="button"
              className={styles.toggle}
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Hide password' : 'Show password'}
              title={visible ? 'Hide password' : 'Show password'}
            >
              {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </button>
          </div>
          <p id={errorId} className={styles.error} role="alert">
            {hasError ? "That password doesn't match. Try again." : ''}
          </p>

          <button type="submit" className={styles.submit} disabled={!password || pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
