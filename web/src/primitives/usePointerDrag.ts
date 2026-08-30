import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export interface DragInfo {
  /** pointer travel since pointerdown, in px */
  dx: number
  dy: number
  /** current viewport position, in px */
  x: number
  y: number
  shiftKey: boolean
  altKey: boolean
  /** flips true once the pointer passes `threshold` — lets a caller tell a click from a drag */
  moved: boolean
}

export interface PointerDragOptions {
  onStart?: (info: DragInfo) => void
  onMove?: (info: DragInfo) => void
  onEnd?: (info: DragInfo) => void
  /** px of travel before the gesture counts as a drag. Default 3 */
  threshold?: number
  /** cursor forced on the document while the gesture is live */
  cursor?: string
  disabled?: boolean
}

/**
 * Pointer-capture drag gesture shared by every scrubbing control (number
 * fields, knobs, curve handles). Capture keeps the stream alive when the
 * pointer leaves the element or the window.
 *
 * Returns the `onPointerDown` handler to put on the drag surface.
 */
export function usePointerDrag(options: PointerDragOptions) {
  const latest = useRef(options)
  latest.current = options

  const teardown = useRef<(() => void) | null>(null)
  useEffect(() => () => teardown.current?.(), [])

  return useCallback((event: ReactPointerEvent<Element>) => {
    const { disabled, threshold = 3, cursor } = latest.current
    if (disabled || event.button !== 0) return

    // React reuses the event object's currentTarget after the handler returns.
    const target = event.currentTarget
    const { pointerId } = event
    const startX = event.clientX
    const startY = event.clientY
    let moved = false

    teardown.current?.()
    target.setPointerCapture(pointerId)

    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    if (cursor) document.body.style.cursor = cursor
    document.body.style.userSelect = 'none'

    const info = (e: PointerEvent): DragInfo => ({
      dx: e.clientX - startX,
      dy: e.clientY - startY,
      x: e.clientX,
      y: e.clientY,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      moved,
    })

    const handleMove = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) > threshold) moved = true
      latest.current.onMove?.(info(e))
    }

    const handleEnd = (e: PointerEvent) => {
      const final = info(e)
      teardown.current?.()
      latest.current.onEnd?.(final)
    }

    teardown.current = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
      teardown.current = null
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)

    latest.current.onStart?.({
      dx: 0, dy: 0, x: startX, y: startY,
      shiftKey: event.shiftKey, altKey: event.altKey, moved: false,
    })
  }, [])
}
