// Container sizes count in 20-foot units: 20xx*1 = 1, 40xx*1 = 2, 60xx*1 = 3, and the quantity multiplies.
// Size is the number a part starts with and quantity the number after its "*", so a type
// with digits in it (20DC1*1) still reads as one 20-foot container
const SIZE = /^\s*(\d+)/
const QUANTITY = /\*\s*(\d+)\s*$/

/** TEUs for a Volume like "20DC1*1, 40HC*2" (= 5); null when there is nothing to count */
export function teusFromVolume(volume: unknown): number | null {
  if (typeof volume !== 'string' || volume.trim() === '') return null
  let total = 0
  let counted = false
  for (const part of volume.split(/[,;]/)) {
    const size = SIZE.exec(part)
    const quantity = QUANTITY.exec(part)
    if (!size || !quantity) continue
    total += (Number(size[1]) / 20) * Number(quantity[1])
    counted = true
  }
  return counted ? total : null
}
