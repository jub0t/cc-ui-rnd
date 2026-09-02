// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ')

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const roundTo = (value: number, decimals: number): number =>
  Number(value.toFixed(clamp(decimals, 0, 12)))

/** Decimals present in a literal step, so `step={0.01}` implies 2 digits. */
export const decimalsOf = (n: number): number => {
  const [, frac = ''] = String(n).split('.')
  return frac.length
}
