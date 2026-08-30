import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { usePointerDrag } from './usePointerDrag'
import { clamp, cx, decimalsOf, roundTo } from './utils'
import styles from './Knob.module.css'

export interface KnobProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** value restored on double-click. Defaults to `min` */
  defaultValue?: number
  /** diameter of the dial in px. Default 54 */
  size?: number
  /** vertical drag distance that sweeps the full range. Default 170 */
  travel?: number
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

// 270deg of sweep with the dead zone at the bottom, the way hardware knobs read.
const START_ANGLE = 135
const SWEEP = 270

const polar = (cx0: number, cy0: number, radius: number, degrees: number) => {
  const radians = (degrees * Math.PI) / 180
  return [cx0 + radius * Math.cos(radians), cy0 + radius * Math.sin(radians)] as const
}

const arcPath = (cx0: number, cy0: number, radius: number, from: number, to: number) => {
  const [x0, y0] = polar(cx0, cy0, radius, from)
  const [x1, y1] = polar(cx0, cy0, radius, to)
  const largeArc = Math.abs(to - from) > 180 ? 1 : 0
  return `M ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1}`
}

/** Rotary control. Drag up/down to turn, wheel to nudge, double-click to reset. */
export function Knob({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  defaultValue,
  size = 54,
  travel = 170,
  disabled,
  className,
  'aria-label': ariaLabel,
}: KnobProps) {
  const digits = decimalsOf(step)
  const rootRef = useRef<HTMLDivElement>(null)
  const dragOrigin = useRef(value)

  const settle = (next: number) => onChange(roundTo(clamp(next, min, max), digits))

  const latest = useRef({ value, settle })
  latest.current = { value, settle }

  const span = max - min || 1
  const fraction = clamp((value - min) / span, 0, 1)
  const angle = START_ANGLE + fraction * SWEEP

  const center = size / 2
  const radius = center - 4
  const [needleX, needleY] = polar(center, center, radius - 9, angle)
  const [needleInnerX, needleInnerY] = polar(center, center, radius * 0.3, angle)

  const beginDrag = usePointerDrag({
    disabled,
    cursor: 'ns-resize',
    onStart: () => {
      dragOrigin.current = value
    },
    onMove: ({ dy, shiftKey, moved }) => {
      if (!moved) return
      const scale = shiftKey ? 0.25 : 1
      settle(dragOrigin.current + (-dy / travel) * span * scale)
    },
  })

  // React attaches wheel passively at the root, so bind it directly to opt out.
  useEffect(() => {
    const el = rootRef.current
    if (!el || disabled) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const direction = event.deltaY > 0 ? -1 : 1
      latest.current.settle(latest.current.value + direction * step * (event.shiftKey ? 0.25 : 1))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [disabled, step])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const coarse = step * 10
    const moves: Record<string, number> = {
      ArrowUp: step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowLeft: -step,
      PageUp: coarse,
      PageDown: -coarse,
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

  return (
    <div
      ref={rootRef}
      className={cx(styles.knob, disabled && styles.disabled, className)}
      style={{ width: size, height: size }}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-disabled={disabled}
      onPointerDown={beginDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={() => !disabled && settle(defaultValue ?? min)}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden focusable="false">
        <circle className={styles.body} cx={center} cy={center} r={radius - 2} />
        <path
          className={styles.track}
          d={arcPath(center, center, radius, START_ANGLE, START_ANGLE + SWEEP)}
        />
        {fraction > 0 && (
          <path
            className={styles.fill}
            d={arcPath(center, center, radius, START_ANGLE, angle)}
          />
        )}
        <line
          className={styles.needle}
          x1={needleInnerX}
          y1={needleInnerY}
          x2={needleX}
          y2={needleY}
        />
      </svg>
    </div>
  )
}
