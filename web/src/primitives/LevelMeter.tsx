// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { clamp, cx } from './utils'
import styles from './LevelMeter.module.css'

export interface LevelMeterProps {
  /** current level, 0..1 */
  value: number
  /** peak-hold marker, 0..1 */
  peak?: number
  orientation?: 'horizontal' | 'vertical'
  /** track thickness in px. Default 6 horizontal / 8 vertical */
  thickness?: number
  className?: string
  'aria-label'?: string
}

/**
 * Audio level meter. The green/amber/red ramp is painted at full length and
 * revealed by a clip, so a colour always means the same level regardless of
 * how far the bar has filled.
 */
export function LevelMeter({
  value,
  peak,
  orientation = 'horizontal',
  thickness,
  className,
  'aria-label': ariaLabel = 'Level',
}: LevelMeterProps) {
  const vertical = orientation === 'vertical'
  const level = clamp(value, 0, 1)
  const hold = peak === undefined ? undefined : clamp(peak, 0, 1)
  const size = thickness ?? (vertical ? 8 : 6)

  const clip = vertical
    ? `inset(${(1 - level) * 100}% 0 0 0)`
    : `inset(0 ${(1 - level) * 100}% 0 0)`

  return (
    <div
      className={cx(styles.track, vertical ? styles.vertical : styles.horizontal, className)}
      style={vertical ? { width: size } : { height: size }}
      role="meter"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(level * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={styles.ramp} style={{ clipPath: clip }} />
      {hold !== undefined && (
        <div
          className={styles.peak}
          style={vertical ? { bottom: `${hold * 100}%` } : { left: `${hold * 100}%` }}
        />
      )}
    </div>
  )
}
