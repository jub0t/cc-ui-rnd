import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { usePointerDrag } from './usePointerDrag'
import { KeyframeIcon } from './icons'
import { clamp, cx, decimalsOf, roundTo } from './utils'
import styles from './NumberField.module.css'

export interface NumberFieldProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  /** amount added per arrow key press, and per `pxPerStep` px of drag */
  step?: number
  /** decimals kept on commit. Defaults to the decimals in `step` */
  precision?: number
  /** horizontal drag distance that advances the value by one `step`. Default 2 */
  pxPerStep?: number
  /** leading adornment — an axis letter, a unit, an icon */
  prefix?: ReactNode
  /** appended to the displayed number, e.g. `%` or `s` */
  suffix?: string
  /** render the keyframe diamond on the trailing edge */
  keyframe?: boolean
  keyframed?: boolean
  onKeyframedChange?: (keyframed: boolean) => void
  /** custom display; pair with `parse` so typing still round-trips */
  format?: (value: number) => string
  parse?: (text: string) => number
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

/**
 * The workhorse of an inspector: drag left/right anywhere on the field to
 * scrub, click to type. Shift coarsens the scrub 10x, Alt refines it 10x.
 */
export function NumberField({
  value,
  onChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  precision,
  pxPerStep = 2,
  prefix,
  suffix,
  keyframe = false,
  keyframed = false,
  onKeyframedChange,
  format,
  parse,
  disabled,
  className,
  'aria-label': ariaLabel,
}: NumberFieldProps) {
  const digits = precision ?? decimalsOf(step)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragOrigin = useRef(value)
  const reverting = useRef(false)
  // null means "showing the formatted value"; a string means "being typed into"
  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null

  const shown = roundTo(value, Math.max(digits, 3))
  const display = format ? format(value) : `${shown}${suffix ?? ''}`

  const settle = (next: number, fine: boolean) =>
    onChange(roundTo(clamp(next, min, max), fine ? digits + 1 : digits))

  const beginDrag = usePointerDrag({
    disabled: disabled || editing,
    cursor: 'ew-resize',
    onStart: () => {
      dragOrigin.current = value
    },
    onMove: ({ dx, shiftKey, altKey, moved }) => {
      if (!moved) return
      const scale = shiftKey ? 10 : altKey ? 0.1 : 1
      settle(dragOrigin.current + (dx / pxPerStep) * step * scale, altKey)
    },
    onEnd: ({ moved }) => {
      // a press that never travelled is a click: fall through to text entry
      if (!moved) inputRef.current?.focus()
    },
  })

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || editing) return
    event.preventDefault() // withhold focus until the gesture resolves
    beginDrag(event)
  }

  const commit = (raw: string) => {
    const next = parse ? parse(raw) : Number.parseFloat(raw.replace(/[^\d.eE+-]/g, ''))
    if (Number.isFinite(next)) onChange(roundTo(clamp(next, min, max), Math.max(digits, 3)))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const scale = event.shiftKey ? 10 : event.altKey ? 0.1 : 1
      const direction = event.key === 'ArrowUp' ? 1 : -1
      const typed = draft !== null ? Number.parseFloat(draft) : Number.NaN
      const base = Number.isFinite(typed) ? typed : value
      const next = roundTo(
        clamp(base + direction * step * scale, min, max),
        event.altKey ? digits + 1 : digits,
      )
      onChange(next)
      if (draft !== null) setDraft(format ? format(next) : String(next))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      inputRef.current?.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      reverting.current = true
      inputRef.current?.blur()
    }
  }

  return (
    <div
      className={cx(styles.field, editing && styles.editing, disabled && styles.disabled, className)}
      onPointerDown={onPointerDown}
    >
      {prefix !== undefined && <span className={styles.prefix}>{prefix}</span>}
      <input
        ref={inputRef}
        className={styles.input}
        value={draft ?? display}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        inputMode="decimal"
        role="spinbutton"
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        onFocus={() => setDraft(format ? format(value) : String(shown))}
        onBlur={() => {
          if (draft !== null && !reverting.current) commit(draft)
          reverting.current = false
          setDraft(null)
        }}
        onKeyDown={onKeyDown}
        onChange={(event) => setDraft(event.target.value)}
      />
      {keyframe && (
        <button
          type="button"
          className={cx(styles.keyframe, keyframed && styles.keyframeOn)}
          disabled={disabled}
          aria-pressed={keyframed}
          aria-label={keyframed ? 'Remove keyframe' : 'Add keyframe'}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onKeyframedChange?.(!keyframed)}
        >
          <KeyframeIcon size={10} filled={keyframed} />
        </button>
      )}
    </div>
  )
}
