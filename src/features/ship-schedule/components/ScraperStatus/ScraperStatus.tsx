import { useEffect, useState } from 'react'
import { getScraperHealth } from '../../services/getScraperHealth'
import { formatReceived } from '../../utils/formatDate'
import styles from './ScraperStatus.module.scss'

type Status =
  | { state: 'checking' }
  | { state: 'alive'; checkedAt: string }
  | { state: 'error'; checkedAt?: string; reason?: string }

/** Green "Alive" when the server's last scraper check passed, red "Error" otherwise, with when it ran */
export function ScraperStatus() {
  const [status, setStatus] = useState<Status>({ state: 'checking' })

  useEffect(() => {
    let cancelled = false
    getScraperHealth()
      .then((health) => {
        if (cancelled) return
        setStatus({ state: health.alive ? 'alive' : 'error', checkedAt: health.checkedAt })
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus({ state: 'error', reason: error instanceof Error ? error.message : 'Check failed.' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const label = status.state === 'checking' ? 'Checking…' : status.state === 'alive' ? 'Alive' : 'Error'
  const checkedAt = status.state === 'checking' ? undefined : status.checkedAt
  const reason = status.state === 'error' ? status.reason : undefined

  return (
    <p className={`${styles.status} ${styles[status.state]}`} role="status">
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>
        <span className={styles.srOnly}>Scraper: </span>
        {label}
      </span>
      {checkedAt && (
        <span className={styles.detail}>
          · Last check: <time dateTime={checkedAt}>{formatReceived(checkedAt)}</time>
        </span>
      )}
      {reason && <span className={styles.detail}>· {reason}</span>}
    </p>
  )
}
