// Schedule cells that mean "no sailing": N/A (shown red) and OMIT (shown light yellow)
export function cellStatus(value: string): 'na' | 'omit' | undefined {
  const status = value.trim().toUpperCase()
  if (status === 'N/A') return 'na'
  if (status === 'OMIT') return 'omit'
  return undefined
}

export const isLink = (value: string) => /^https?:\/\//.test(value)
