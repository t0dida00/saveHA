import cmaLogo from '@/shared/assets/cma-logo.svg'
import hplLogo from '@/shared/assets/hpl-logo.svg'
import oneLogo from '@/shared/assets/one-logo.svg'
import type { Carrier } from './services'

export type Brand = { name: string; logo: string; width: number; height: number }

// Logos kept in the repo: ONE's from one-line.com, Hapag-Lloyd's from hapag-lloyd.com's header,
// CMA CGM's from Wikimedia Commons (File:CMA CGM logo.svg). Width and height are each file's own ratio.
export const BRANDS: Record<Carrier, Brand> = {
  one: { name: 'ONE', logo: oneLogo, width: 90, height: 40 },
  hpl: { name: 'Hapag-Lloyd', logo: hplLogo, width: 130, height: 20 },
  cma: { name: 'CMA CGM', logo: cmaLogo, width: 536, height: 327 },
}
