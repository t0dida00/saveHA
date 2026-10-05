import { FileText, LayoutDashboard, Settings, Ship, type LucideIcon } from 'lucide-react'

export type NavItem = {
  path: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/ship-schedule', label: 'Check ship schedule', icon: Ship },
  { path: '/report', label: 'Report', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
]
