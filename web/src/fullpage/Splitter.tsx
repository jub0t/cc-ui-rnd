import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { clamp, usePointerDrag } from '../primitives'
import { cn } from '../demo/editor/ui'

export interface SplitterProps {
  /** `x` drags left/right and divides columns; `y` drags up/down and divides rows */
  axis: 'x' | 'y'
  value: number
  min: number
  max: number
  /** for a pane on the trailing edge, where dragging toward the start grows it */
  invert?: boolean
  onChange: (value: number) => void
  'aria-label': string
}

const STEP = 16

/**
 * Drag handle between two panes.
 *
 * The hit target is deliberately wider than the hairline it draws: a 1px
 * divider is honest visually but miserable to grab, so the target is 6px and
 * the line stays 1px. It is a real `separator` with arrow-key support, because
 * a resize you can only perform with a mouse is a resize some people cannot
 * perform at all.
 */
export function Splitter({ axis, value, min, max, invert = false, onChange, 'aria-label': label }: SplitterProps) {
  const start = useRef(value)

  const begin = usePointerDrag({
    cursor: axis === 'x' ? 'col-resize' : 'row-resize',
    onStart: () => {
      start.current = value
    },
    onMove: ({ dx, dy }) => {
      const travel = axis === 'x' ? dx : dy
      onChange(clamp(start.current + (invert ? -travel : travel), min, max))
    },
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp'
    const forward = axis === 'x' ? 'ArrowRight' : 'ArrowDown'
    if (event.key !== back && event.key !== forward && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    if (event.key === 'Home') return onChange(min)
    if (event.key === 'End') return onChange(max)
    const travel = event.key === forward ? STEP : -STEP
    onChange(clamp(value + (invert ? -travel : travel), min, max))
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={begin}
      onKeyDown={onKeyDown}
      className={cn(
        'group relative flex-none touch-none select-none focus-visible:outline-none',
        axis === 'x' ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize',
      )}
    >
      <span
        className={cn(
          'absolute bg-line transition-colors group-hover:bg-accent group-focus-visible:bg-accent',
          axis === 'x' ? 'inset-y-0 left-1/2 w-px -translate-x-1/2' : 'inset-x-0 top-1/2 h-px -translate-y-1/2',
        )}
      />
    </div>
  )
}
