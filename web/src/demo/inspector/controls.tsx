// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Search } from 'lucide-react'
import { CloseIcon, NumberField, Row, clamp, cx, decimalsOf, roundTo, usePointerDrag } from '../../primitives'
import { Tooltip } from '../../primitives/Tooltip'
import styles from './inspector.module.css'

/**
 * Controls the inspector needs that `src/primitives` does not carry yet: a
 * horizontal fader, a switch, a help disclosure and a search field. They are
 * written to the same contract as the primitives — value/onChange, a real
 * `role`, keyboard parity with the pointer — so promoting one later is a file
 * move rather than a rewrite.
 *
 * The magnifier comes straight from lucide because `primitives/icons` is the
 * single adapter for the shipped set and this panel should not widen it on its
 * own; the day a second caller wants it, it belongs there.
 */

/* ------------------------------------------------------------------ */
/* Fader                                                               */
/* ------------------------------------------------------------------ */

export interface FaderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** value restored on double-click. Defaults to `min`, matching Knob */
  defaultValue?: number
  disabled?: boolean
  /** what a screen reader should say instead of the bare number */
  valueText?: string
  className?: string
  'aria-label'?: string
}

/** Horizontal fader. Click to jump, drag to ride, double-click to reset. */
export function Fader({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  defaultValue,
  disabled,
  valueText,
  className,
  'aria-label': ariaLabel,
}: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const digits = decimalsOf(step)
  const span = max - min || 1

  const settle = (next: number) => onChange(roundTo(clamp(next, min, max), digits))

  // The rail is inset from the track by the border plus 2px. Measuring against
  // the rail rather than the track is what puts the cap under the pointer at
  // both ends instead of a few px short of them.
  const INSET = 3
  const applyAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const usable = rect.width - INSET * 2
    if (usable <= 0) return
    settle(min + clamp((clientX - rect.left - INSET) / usable, 0, 1) * span)
  }

  const beginDrag = usePointerDrag({
    disabled,
    threshold: 0,
    cursor: 'ew-resize',
    onStart: ({ x }) => {
      setDragging(true)
      applyAt(x)
    },
    onMove: ({ x }) => applyAt(x),
    onEnd: () => setDragging(false),
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Same modifier grammar as NumberField: shift coarsens, alt refines.
    const scale = event.shiftKey ? 10 : event.altKey ? 0.1 : 1
    const moves: Record<string, number> = {
      ArrowRight: step * scale,
      ArrowUp: step * scale,
      ArrowLeft: -step * scale,
      ArrowDown: -step * scale,
      PageUp: step * 10,
      PageDown: -step * 10,
    }
    if (event.key === 'Home') {
      event.preventDefault()
      settle(min)
    } else if (event.key === 'End') {
      event.preventDefault()
      settle(max)
    } else if (event.key in moves) {
      event.preventDefault()
      settle(value + (moves[event.key] ?? 0))
    }
  }

  const percent = clamp((value - min) / span, 0, 1) * 100

  return (
    <div
      ref={trackRef}
      className={cx(styles.fader, disabled && styles.faderOff, dragging && styles.dragging, className)}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={valueText}
      aria-disabled={disabled}
      onPointerDown={beginDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={() => !disabled && settle(defaultValue ?? min)}
    >
      <div className={styles.rail}>
        <span className={styles.fill} style={{ width: `${percent}%` }} />
        <span
          className={styles.cap}
          style={{ left: `${percent}%`, transform: `translateX(-${percent}%)` }}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Param — the inspector's repeating unit                              */
/* ------------------------------------------------------------------ */

export interface ParamProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  defaultValue?: number
  /** the readout beside the label: the value in the unit a person thinks in */
  format: (value: number) => string
  disabled?: boolean
  help?: ReactNode
  /** passed to the Row, for the tighter padding used inside a card */
  className?: string
}

export function Param({
  label,
  value,
  onChange,
  min,
  max,
  step,
  defaultValue,
  format,
  disabled,
  help,
  className,
}: ParamProps) {
  const text = format(value)
  return (
    <Row stack className={className}>
      <div className={styles.head}>
        <span className={styles.labelGroup}>
          <span className={styles.label}>{label}</span>
          {help}
        </span>
        <span className={styles.readout}>{text}</span>
      </div>
      <div className={styles.body}>
        <Fader
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          defaultValue={defaultValue}
          disabled={disabled}
          valueText={text}
          aria-label={label}
        />
        <div className={styles.field}>
          <NumberField
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            aria-label={`${label} value`}
          />
        </div>
      </div>
    </Row>
  )
}

/* ------------------------------------------------------------------ */
/* Switch                                                              */
/* ------------------------------------------------------------------ */

export function Switch({
  checked,
  onChange,
  disabled,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(styles.switch, checked && styles.switchOn)}
    >
      <span className={styles.thumb} />
    </button>
  )
}

/** A labelled switch on one line, for settings whose label will not fit a Row. */
export function SwitchRow({
  label,
  checked,
  onChange,
  help,
  tip,
  shortcut,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  help?: ReactNode
  /** what the label cannot say in two words. A `help` disclosure is for the
   *  settings that need a sentence; this is for the ones that need a phrase. */
  tip?: string
  shortcut?: string
}) {
  const control = <Switch checked={checked} onChange={onChange} aria-label={label} />
  return (
    <Row>
      <div className={styles.switchRow}>
        <span className={styles.label}>{label}</span>
        {help}
        {tip === undefined ? (
          control
        ) : (
          <Tooltip label={tip} shortcut={shortcut}>
            {control}
          </Tooltip>
        )}
      </div>
    </Row>
  )
}

/* ------------------------------------------------------------------ */
/* Help disclosure                                                     */
/* ------------------------------------------------------------------ */

/**
 * A tooltip would hide the answer again the moment the pointer moves, and it
 * is unreachable by keyboard without a pile of machinery. This just toggles a
 * line of prose the caller renders where it belongs.
 */
export function HelpButton({
  label,
  open,
  onToggle,
}: {
  label: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={cx(styles.help, open && styles.helpOn)}
      aria-label={label}
      aria-expanded={open}
      onClick={onToggle}
    >
      ?
    </button>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export function SearchField({
  value,
  onChange,
  placeholder,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  'aria-label'?: string
}) {
  return (
    <div className={styles.search}>
      <Search size={13} className={styles.searchGlyph} aria-hidden />
      <input
        className={styles.searchInput}
        value={value}
        spellCheck={false}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {value !== '' && (
        <button
          type="button"
          className={cx(styles.searchClear)}
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <CloseIcon size={11} />
        </button>
      )}
    </div>
  )
}
