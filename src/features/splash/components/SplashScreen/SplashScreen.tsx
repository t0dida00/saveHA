import { Sailboat, Waves } from 'lucide-react'
import { useEffect, useState } from 'react'
import styles from './SplashScreen.module.scss'

const DURATION_MS = 2000
const REDUCED_DURATION_MS = 1000
const EXIT_MS = 350
// One strip must be wider than the content column; it is rendered twice for a seamless loop
const WAVES_PER_STRIP = 16

type SplashScreenProps = {
  onDone: () => void
}

function WaveStrip() {
  return (
    <span className={styles.waveStrip}>
      {Array.from({ length: WAVES_PER_STRIP }, (_, i) => (
        <Waves key={i} className={styles.wave} size={32} strokeWidth={1.5} />
      ))}
    </span>
  )
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setLeaving(true), reduced ? REDUCED_DURATION_MS : DURATION_MS)
    const skip = () => setLeaving(true)
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
  }, [])

  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(onDone, EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [leaving, onDone])

  return (
    <div className={`${styles.splash} ${leaving ? styles.leaving : ''}`} role="status" aria-live="polite">
      <div className={styles.body}>
        <div className={styles.voyage} aria-hidden="true">
          {/* Track is narrower than the column by one boat width, so the boat stops at the edge */}
          <div className={styles.track}>
            <div className={styles.mover}>
              <Sailboat className={styles.boat} size={56} strokeWidth={1.5} />
            </div>
          </div>
          <div className={styles.sea}>
            <div className={styles.waves}>
              <WaveStrip />
              <WaveStrip />
            </div>
          </div>
        </div>

        <h1 className={styles.greeting}>
          <span className={styles.greetingLine}>Hello Hải Anh,</span>
        </h1>
        <p className={styles.subline}>This tool will save you from repetitive work.</p>
      </div>
    </div>
  )
}
