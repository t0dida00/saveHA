import { useEffect, useId, useState } from 'react'
import { getScraperHealth, readCachedScraperHealth, type ScraperHealth } from '../../services/getScraperHealth'
import { formatReceived } from '../../utils/formatDate'
import styles from './ScraperStatus.module.scss'

type Status =
  | { state: 'checking' }
  | { state: 'alive'; checkedAt: string }
  | { state: 'error'; checkedAt?: string; reason?: string }

const toStatus = (health: ScraperHealth): Status => ({
  state: health.alive ? 'alive' : 'error',
  checkedAt: health.checkedAt,
})

type ScraperStatusProps = {
  /**
   * "bar": a strip in the status color across the top of the parent, which must be position: relative.
   * The details show in a tooltip on hover or focus.
   */
  variant?: 'full' | 'bar'
  /**
   * For a carrier with no scraper to check (Hapag-Lloyd is copied by hand): always green "Alive",
   * with this text in place of the last check. Nothing is asked of the server.
   */
  alwaysAlive?: string
}

/** Green "Alive" when the server's last scraper check passed, red "Error" otherwise, with when it ran */
export function ScraperStatus({ variant = 'full', alwaysAlive }: ScraperStatusProps) {
  const tooltipId = useId()
  // An answer fetched within the last day shows straight away
  const [fetched, setStatus] = useState<Status>(() => {
    const cached = readCachedScraperHealth()
    return cached ? toStatus(cached) : { state: 'checking' }
  })
  const status: Status = alwaysAlive ? { state: 'alive', checkedAt: '' } : fetched

  // With a fresh cache this resolves from it without a request
  useEffect(() => {
    if (alwaysAlive) return
    let cancelled = false
    getScraperHealth()
      .then((health) => {
        if (!cancelled) setStatus(toStatus(health))
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus({ state: 'error', reason: error instanceof Error ? error.message : 'Check failed.' })
      })
    return () => {
      cancelled = true
    }
  }, [alwaysAlive])

  const label = status.state === 'checking' ? 'Checking…' : status.state === 'alive' ? 'Alive' : 'Error'
  const checkedAt = status.state === 'checking' ? undefined : status.checkedAt
  const reason = status.state === 'error' ? status.reason : alwaysAlive

  if (variant === 'bar') {
    const detail = checkedAt ? `Last check: ${formatReceived(checkedAt)}` : (reason ?? 'Checking the scraper…')
    return (
      // Focusable so keyboard users can open the tooltip too
      <span
        className={`${styles.bar} ${styles[status.state]}`}
        tabIndex={0}
        role="status"
        aria-label={`Scraper: ${label}`}
        aria-describedby={tooltipId}
      >
        <span className={styles.barFill} aria-hidden="true" />
        <span id={tooltipId} role="tooltip" className={styles.tooltip}>
          {detail}
        </span>
      </span>
    )
  }

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
