import type { Carrier } from '../data/services'
import type { ScheduleFile } from '../types'

/**
 * Which carrier a file in Results is from: Hapag-Lloyd files have HPL in the header's first cell
 * (and are named HPL-…csv); everything else came from ONE.
 */
export function fileCarrier(file: ScheduleFile): Carrier {
  const corner = file.content.replace(/^﻿/, '').split(/[,\r\n]/, 1)[0]?.trim().toUpperCase()
  return corner === 'HPL' || file.name.toUpperCase().startsWith('HPL-') ? 'hpl' : 'one'
}
