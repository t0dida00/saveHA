import type { Carrier } from '../data/services'
import type { ScheduleFile } from '../types'

/**
 * Which carrier a file in Results is from: Hapag-Lloyd and CMA CGM files have HPL or CMA in the
 * header's first cell (and are named HPL-…csv or CMA-…csv); everything else came from ONE.
 */
export function fileCarrier(file: ScheduleFile): Carrier {
  const corner = file.content.replace(/^﻿/, '').split(/[,\r\n]/, 1)[0]?.trim().toUpperCase()
  const name = file.name.toUpperCase()
  if (corner === 'HPL' || name.startsWith('HPL-')) return 'hpl'
  if (corner === 'CMA' || name.startsWith('CMA-')) return 'cma'
  return 'one'
}
