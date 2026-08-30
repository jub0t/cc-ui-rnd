/** Shared formatters. Every number the user reads goes through one of these. */

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0')

/** 154 -> "2:34"; over an hour -> "1:02:34" */
export function duration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const body = `${Math.floor((whole % 3600) / 60)}:${pad2(whole % 60)}`
  return hours > 0 ? `${hours}:${pad2((whole % 3600) / 60)}:${pad2(whole % 60)}` : body
}

/** 154 -> "00:02:34" */
export function timecode(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return [pad2(whole / 3600), pad2((whole % 3600) / 60), pad2(whole % 60)].join(':')
}

/** Binary-ish sizes, matching how download managers report them. */
export function bytes(value: number, decimals = 0): string {
  if (value < 1024) return `${Math.round(value)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = value / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  const digits = size < 10 && decimals === 0 ? 1 : decimals
  return `${size.toFixed(digits)} ${units[unit]}`
}

export function megabytes(mb: number, decimals = 0): string {
  return bytes(mb * 1024 * 1024, decimals)
}

/** "12.4 MB/s" */
export function rate(bytesPerSecond: number): string {
  return `${bytes(bytesPerSecond, 1)}/s`
}

/** Humane countdown: "8s left", "1m 20s left", "almost done" */
export function eta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'almost done'
  if (seconds < 60) return `${Math.ceil(seconds)}s left`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.ceil(seconds % 60)
  return rest === 0 ? `${minutes}m left` : `${minutes}m ${rest}s left`
}

/**
 * Truncate a long path from the middle so both the drive and the folder stay
 * readable — the original dialog cut the end off, hiding the filename.
 */
export function midTruncate(text: string, max = 46): string {
  if (text.length <= max) return text
  const head = Math.ceil((max - 1) / 2)
  const tail = Math.floor((max - 1) / 2)
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`
}

/** Deterministic 0..1 noise, so generated waveforms are stable across renders. */
export function seeded(seed: number): () => number {
  let state = seed * 2654435761
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/** #rrggbb + alpha -> rgb(r g b / a), so a plate's alpha stays independent
 *  of the text drawn on top of it. */
export function rgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const int = Number.parseInt(value.length === 3 ? value.replace(/./g, '$&$&') : value, 16)
  if (!Number.isFinite(int)) return hex
  return `rgb(${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255} / ${alpha})`
}
