import { GitCompare } from 'lucide-react'
import { useMemo, useState } from 'react'
import { compareCsv, CsvCompare, useRecentFiles } from '@/features/ship-schedule'
import styles from '../OneCard/OneCard.module.scss'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** What changed between the 2 newest files in Results, with the full comparison a click away */
export function LatestDifferences() {
  // Newest first, read from this browser like the Results list
  const { files } = useRecentFiles()
  const [comparing, setComparing] = useState(false)

  // The older one is the baseline, as in Results' Compare
  const [after, before] = files
  const diff = useMemo(() => (before && after ? compareCsv(before.content, after.content) : undefined), [before, after])

  if (!before || !after || !diff) {
    return <p className={styles.muted}>Shown once Results has 2 files.</p>
  }

  const weeks = diff.rows.filter((row) => row.kind !== 'same').length
  const services = diff.services.filter((service) => service.kind !== 'same').length
  const summary =
    diff.changedCount === 0 && services === 0
      ? 'No differences'
      : [
          plural(diff.changedCount, 'change'),
          weeks > 0 && `in ${plural(weeks, 'week')}`,
          services > 0 && `· ${plural(services, 'service')} added or removed`,
        ]
          .filter(Boolean)
          .join(' ')

  return (
    <>
      <div className={styles.file}>
        <GitCompare size={20} aria-hidden="true" className={styles.icon} />
        <div className={styles.fileInfo}>
          <p className={styles.fileName}>{summary}</p>
          <p className={styles.muted} title={`${before.name} → ${after.name}`}>
            {before.name} → {after.name}
          </p>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setComparing(true)}
          aria-label={`Compare ${before.name} with ${after.name}`}
          title="View differences"
        >
          <GitCompare size={18} aria-hidden="true" />
        </button>
      </div>
      {comparing && <CsvCompare before={before} after={after} onClose={() => setComparing(false)} />}
    </>
  )
}
