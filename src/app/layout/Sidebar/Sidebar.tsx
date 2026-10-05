import { LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { NavLink } from 'react-router'
import { useAuth } from '@/features/auth'
import { NAV_ITEMS } from './navItems'
import styles from './Sidebar.module.scss'

type SidebarProps = {
  id: string
  /** Desktop: icon-only rail */
  collapsed: boolean
  /** Mobile: drawer is showing */
  open: boolean
  onToggleCollapsed: () => void
  onClose: () => void
}

export function Sidebar({ id, collapsed, open, onToggleCollapsed, onClose }: SidebarProps) {
  const { signOut } = useAuth()
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <aside
      id={id}
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${open ? styles.open : ''}`}
      aria-label="Main"
    >
      <div className={styles.header}>
        <span className={styles.brand}>SaveHA</span>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.collapseButton}`}
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          <CollapseIcon size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.closeButton}`}
          onClick={onClose}
          aria-label="Close menu"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
            title={collapsed ? label : undefined}
            onClick={onClose}
          >
            <Icon className={styles.icon} size={20} aria-hidden="true" />
            <span className={styles.label}>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.item}
          onClick={signOut}
          title={collapsed ? 'Log out' : undefined}
        >
          <LogOut className={styles.icon} size={20} aria-hidden="true" />
          <span className={styles.label}>Log out</span>
        </button>
      </div>
    </aside>
  )
}
