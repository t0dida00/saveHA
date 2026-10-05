import { Menu } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Outlet } from 'react-router'
import { Sidebar } from '../Sidebar/Sidebar'
import styles from './AppLayout.module.scss'

const COLLAPSED_KEY = 'saveha.sidebarCollapsed'
const YEAR = new Date().getFullYear()

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [menuOpen, setMenuOpen] = useState(false)
  const sidebarId = useId()

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, String(!value))
      } catch {
        // Not persisted; the choice still applies for this session
      }
      return !value
    })
  }

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <div className={styles.layout}>
      <Sidebar
        id={sidebarId}
        collapsed={collapsed}
        open={menuOpen}
        onToggleCollapsed={toggleCollapsed}
        onClose={() => setMenuOpen(false)}
      />
      {menuOpen && <div className={styles.backdrop} onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-controls={sidebarId}
            aria-expanded={menuOpen}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <span className={styles.brand}>SaveHA</span>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>

        <footer className={styles.footer}>
          <span>© {YEAR} SaveHA. All rights reserved.</span>
          <span>Built by Khoa Dinh</span>
        </footer>
      </div>
    </div>
  )
}
