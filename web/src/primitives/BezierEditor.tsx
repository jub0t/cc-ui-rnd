import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useElementSize } from './useElementSize'
import { usePointerDrag } from './usePointerDrag'
import { clamp, cx, roundTo } from './utils'
import styles from './BezierEditor.module.css'

/** `[x1, y1, x2, y2]` — the two control points of a CSS cubic-bezier. */
export type BezierValue = readonly [number, number, number, number]

export interface BezierEditorProps {
  value: BezierValue
  onChange: (value: BezierValue) => void
  /** how far past 0..1 the handles may travel on the y axis. Default 0.3 */
  overshoot?: number
  height?: number
  disabled?: boolean
  className?: string
}

const PAD = 16
const HANDLE_KEYS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
}

/**
 * Cubic-bezier curve editor. The endpoints are pinned at (0,0) and (1,1);
 * the two control handles drag freely, with x clamped to 0..1 so the result
 * stays a legal CSS timing function.
 */
export function BezierEditor({
  value,
  onChange,
  overshoot = 0.3,
  height = 190,
  disabled,
  className,
}: BezierEditorProps) {
  // Measure rather than rely on viewBox scaling, so 1 SVG unit === 1 CSS px
  // and pointer coordinates invert exactly.
  const [ref, size] = useElementSize<HTMLDivElement>()
  const [dragging, setDragging] = useState<0 | 1 | null>(null)
  const active = useRef<0 | 1>(0)

  const width = size.width || 260
  const innerW = Math.max(width - PAD * 2, 1)
  const innerH = Math.max(height - PAD * 2, 1)
  const yRange = 1 + overshoot * 2

  const toX = (x: number) => PAD + x * innerW
  const toY = (y: number) => PAD + ((1 + overshoot - y) / yRange) * innerH
  const fromX = (px: number) => (px - PAD) / innerW
  const fromY = (py: number) => 1 + overshoot - ((py - PAD) / innerH) * yRange

  const [x1, y1, x2, y2] = value

  const setHandle = (index: 0 | 1, x: number, y: number) => {
    const nx = roundTo(clamp(x, 0, 1), 3)
    const ny = roundTo(clamp(y, -overshoot, 1 + overshoot), 3)
    onChange(index === 0 ? [nx, ny, x2, y2] : [x1, y1, nx, ny])
  }

  const beginDrag = usePointerDrag({
    disabled,
    cursor: 'grabbing',
    onStart: () => setDragging(active.current),
    onMove: ({ x, y }) => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      setHandle(active.current, fromX(x - rect.left), fromY(y - rect.top))
    },
    onEnd: () => setDragging(null),
  })

  const onHandleKeyDown = (index: 0 | 1) => (event: KeyboardEvent<SVGGElement>) => {
    const delta = HANDLE_KEYS[event.key]
    if (!delta) return
    event.preventDefault()
    const amount = event.shiftKey ? 0.1 : 0.01
    const [hx, hy] = index === 0 ? [x1, y1] : [x2, y2]
    setHandle(index, hx + delta[0] * amount, hy + delta[1] * amount)
  }

  const curve = `M ${toX(0)} ${toY(0)} C ${toX(x1)} ${toY(y1)}, ${toX(x2)} ${toY(y2)}, ${toX(1)} ${toY(1)}`

  const handles = [
    { index: 0 as const, x: x1, y: y1, anchorX: 0, anchorY: 0 },
    { index: 1 as const, x: x2, y: y2, anchorX: 1, anchorY: 1 },
  ]

  return (
    <div
      ref={ref}
      className={cx(styles.canvas, disabled && styles.disabled, className)}
      style={{ height }}
    >
      <svg width={width} height={height} aria-hidden={false} role="group" aria-label="Bezier curve">
        {/* the 0 and 1 rails the curve travels between */}
        <line className={styles.rail} x1={0} y1={toY(1)} x2={width} y2={toY(1)} />
        <line className={styles.rail} x1={0} y1={toY(0)} x2={width} y2={toY(0)} />

        <path className={styles.curve} d={curve} />

        {handles.map((handle) => (
          <g
            key={handle.index}
            className={cx(styles.handle, dragging === handle.index && styles.handleActive)}
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-label={`Control point ${handle.index + 1}`}
            aria-valuetext={`x ${handle.x}, y ${handle.y}`}
            onKeyDown={onHandleKeyDown(handle.index)}
            onPointerDown={(event) => {
              if (disabled) return
              active.current = handle.index
              beginDrag(event)
            }}
          >
            <line
              className={styles.leash}
              x1={toX(handle.anchorX)}
              y1={toY(handle.anchorY)}
              x2={toX(handle.x)}
              y2={toY(handle.y)}
            />
            <circle className={styles.anchor} cx={toX(handle.anchorX)} cy={toY(handle.anchorY)} r={4} />
            {/* oversized transparent target so the 5px dot is still easy to grab */}
            <circle className={styles.hit} cx={toX(handle.x)} cy={toY(handle.y)} r={12} />
            <circle className={styles.point} cx={toX(handle.x)} cy={toY(handle.y)} r={5} />
          </g>
        ))}
      </svg>
    </div>
  )
}
