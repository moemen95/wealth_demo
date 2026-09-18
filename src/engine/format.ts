/** Number formatting shared by the summary generator and the UI. */

export const fmtMoney = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

export const fmtMoneyShort = (n: number): string => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 2)}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`
  return `${sign}$${Math.round(abs)}`
}

export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US')

export const fmtPct = (n: number, digits = 0): string => `${n.toFixed(digits)}%`
