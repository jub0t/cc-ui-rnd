import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { clamp, cx, decimalsOf, roundTo, usePointerDrag } from '../../primitives'
import styles from './controls.module.css'
import shell from './relay.module.css'

/* ------------------------------------------------------------------------ */
/* Slider                                                                     */
/* ------------------------------------------------------------------------ */

export interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** text shown in the bubble while dragging — the live consequence, not the raw number */
  bubble?: (value: number) => string
  /** paint the track instead of the accent fill (used for the alpha ramp) */
  ramp?: CSSProperties
  disabled?: boolean
  'aria-label'?: string
}

/**
 * Press anywhere on the track to jump and start dragging in one gesture — the
 * thing the original olive progress-bar could not do, because it had no handle.
 */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  bubble,
  ramp,
  disabled,
  'aria-label': ariaLabel,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const digits = decimalsOf(step)

  const setFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const fraction = clamp((clientX - rect.left) / rect.width, 0, 1)
    const raw = min + fraction * (max - min)
    onChange(roundTo(clamp(Math.round(raw / step) * step, min, max), digits))
  }

  const begin = usePointerDrag({
    disabled,
    cursor: 'grabbing',
    threshold: 0,
    onStart: ({ x }) => {
      setDragging(true)
      setFromClientX(x)
    },
    onMove: ({ x }) => setFromClientX(x),
    onEnd: () => setDragging(false),
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const coarse = step * 10
    const moves: Record<string, number> = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: coarse,
      PageDown: -coarse,
    }
    if (event.key === 'Home') {
      event.preventDefault()
      onChange(min)
    } else if (event.key === 'End') {
      event.preventDefault()
      onChange(max)
    } else if (event.key in moves) {
      event.preventDefault()
      onChange(roundTo(clamp(value + (moves[event.key] ?? 0), min, max), digits))
    }
  }

  const percent = ((clamp(value, min, max) - min) / (max - min || 1)) * 100

  return (
    <div
      className={cx(styles.slider, dragging && styles.dragging, disabled && styles.disabled)}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onKeyDown={onKeyDown}
    >
      <div ref={trackRef} className={styles.track} onPointerDown={begin}>
        {ramp ? (
          <>
            <span className={styles.checker} />
            <span className={styles.ramp} style={ramp} />
          </>
        ) : (
          <span className={styles.fill} style={{ width: `${percent}%` }} />
        )}
        <span className={styles.handle} style={{ left: `${percent}%` }} />
      </div>
      {dragging && bubble && (
        <span className={styles.bubble} style={{ left: `${percent}%` }}>
          {bubble(value)}
        </span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Toggle                                                                     */
/* ------------------------------------------------------------------------ */

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
}

export function Toggle({ checked, onChange, disabled, 'aria-label': ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cx(styles.toggle, checked && styles.toggleOn)}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.toggleThumb} />
    </button>
  )
}

/* ------------------------------------------------------------------------ */
/* ColorField                                                                 */
/* ------------------------------------------------------------------------ */

export interface ColorFieldProps {
  value: string
  onChange: (value: string) => void
  /** drawn behind the swatch so the alpha is visible, not implied */
  alpha?: number
  'aria-label'?: string
}

const HEX = /^#[0-9a-f]{6}$/i

export function ColorField({ value, onChange, alpha = 1, 'aria-label': ariaLabel }: ColorFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string) => {
    const text = raw.trim().replace(/^#?/, '#')
    if (HEX.test(text)) onChange(text.toLowerCase())
    setDraft(null)
  }

  return (
    <div className={styles.colorField}>
      <span className={styles.swatchWrap}>
        <span className={styles.checker} />
        <span
          className={styles.ramp}
          style={{ background: value, opacity: alpha, borderRadius: 0 }}
        />
        <input
          type="color"
          className={styles.swatchInput}
          value={value}
          aria-label={ariaLabel ? `${ariaLabel} swatch` : 'Colour swatch'}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      <input
        className={styles.hex}
        value={draft ?? value}
        spellCheck={false}
        aria-label={ariaLabel}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            setDraft(null)
            event.currentTarget.blur()
          }
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Progress                                                                   */
/* ------------------------------------------------------------------------ */

export function Progress({ value, done = false }: { value: number; done?: boolean }) {
  const percent = clamp(value, 0, 1) * 100
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className={cx(styles.progressFill, done ? styles.done : styles.active)}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Layout                                                                     */
/* ------------------------------------------------------------------------ */

export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={shell.group}>
      <h3 className={shell.groupLabel}>{label}</h3>
      {children}
    </section>
  )
}

export function PropRow({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className={shell.propRow}>
      {label !== undefined && <span className={shell.propLabel}>{label}</span>}
      <div className={shell.propControls}>{children}</div>
    </div>
  )
}

/**
 * A full-width row headed by a value readout. The primary slot carries the
 * meaningful number and the secondary carries its real-world equivalent — the
 * inversion the original panel got backwards.
 */
export function ReadoutRow({
  primary,
  secondary,
  children,
}: {
  primary: ReactNode
  secondary?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={shell.propRowStack}>
      <div className={shell.readout}>
        <span className={shell.readoutPrimary}>{primary}</span>
        {secondary !== undefined && <span className={shell.readoutSecondary}>{secondary}</span>}
      </div>
      {children}
    </div>
  )
}

/** Collapsible sub-controls, revealed only once their parent toggle is on. */
export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={cx(shell.reveal, open && shell.revealOpen)} aria-hidden={!open}>
      <div className={shell.revealInner}>
        <div className={shell.revealBody} inert={!open || undefined}>
          {children}
        </div>
      </div>
    </div>
  )
}
