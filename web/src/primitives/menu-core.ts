import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'

/**
 * The plumbing every pop-up menu needs and none of them should own: where the
 * surface lands, and what makes it go away. `ContextMenu` and `MiniMenu` are
 * two surfaces over this one core, so a fix to the clamp or the dismissal
 * rules lands in both.
 */

/** Distance kept between a menu and the viewport edge. */
export const MENU_MARGIN = 8

/* ------------------------------------------------------------------ */
/* Trigger                                                             */
/* ------------------------------------------------------------------ */

export interface MenuAnchor {
  open: boolean
  x: number
  y: number
  onClose: () => void
}

/**
 * Turns a right-click into an anchored, dismissable menu:
 *
 *   const menu = useContextMenu()
 *   <div onContextMenu={menu.onContextMenu}>…</div>
 *   <ContextMenu {...menu.props} items={ITEMS} />
 */
export function useContextMenu() {
  const [state, setState] = useState({ open: false, x: 0, y: 0 })

  const onContextMenu = useCallback((event: ReactMouseEvent) => {
    event.preventDefault()
    // Shift+F10 and the Menu key raise a contextmenu event too, but some
    // browsers hand it 0,0 — anchor those to the element instead of the
    // top-left corner of the screen.
    const keyboardInvoked = event.clientX === 0 && event.clientY === 0
    const rect = keyboardInvoked ? event.currentTarget.getBoundingClientRect() : null
    setState({
      open: true,
      x: rect ? rect.left + 12 : event.clientX,
      y: rect ? rect.top + 12 : event.clientY,
    })
  }, [])

  const close = useCallback(() => setState((current) => ({ ...current, open: false })), [])

  return {
    onContextMenu,
    close,
    props: { open: state.open, x: state.x, y: state.y, onClose: close } satisfies MenuAnchor,
  }
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */

export interface Placement {
  left: number
  top: number
  /** true once the surface had to open to the left of its anchor */
  flipped: boolean
}

/**
 * Clamps the surface inside the viewport. Measured after the first paint pass
 * while the caller still has it hidden, so the correction is never seen.
 *
 * `deps` re-runs the measurement when the surface's own contents change size.
 */
export function useMenuPlacement(
  ref: RefObject<HTMLElement | null>,
  x: number,
  y: number,
  preferLeft = false,
  deps: unknown[] = [],
): Placement | null {
  const [placed, setPlaced] = useState<Placement | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const { width, height } = element.getBoundingClientRect()
    const room = { w: window.innerWidth, h: window.innerHeight }

    let left = preferLeft ? x - width : x
    if (left + width > room.w - MENU_MARGIN) left = x - width
    if (left < MENU_MARGIN) left = Math.min(MENU_MARGIN, room.w - width - MENU_MARGIN)

    let top = y
    if (top + height > room.h - MENU_MARGIN) top = Math.max(MENU_MARGIN, room.h - height - MENU_MARGIN)
    if (top < MENU_MARGIN) top = MENU_MARGIN

    // Guarded so a caller that rebuilds its `items` array on every render
    // cannot bounce the surface between two identical positions forever.
    setPlaced((current) =>
      current && current.left === left && current.top === top
        ? current
        : { left, top, flipped: left < x },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, x, y, preferLeft, ...deps])

  return placed
}

/* ------------------------------------------------------------------ */
/* Dismissal                                                           */
/* ------------------------------------------------------------------ */

/**
 * The five things that close a menu: Escape (handled by the surface's own key
 * handler), an outside press, a scroll, a resize, and the window losing focus.
 * Also puts focus back where it came from, so the next Tab does not restart at
 * the top of the document.
 *
 * Any surface that opts in must carry `data-cp-menu`, submenus included.
 */
export function useMenuDismiss(open: boolean, onClose: () => void) {
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreTo.current = document.activeElement as HTMLElement | null

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest('[data-cp-menu]')) return
      onClose()
    }
    // Scrolling moves whatever the menu was aimed at, so the menu has to go
    // with it. Capture, because the scroll can happen in any container.
    const dismiss = () => onClose()

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    window.addEventListener('blur', dismiss)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('blur', dismiss)
      restoreTo.current?.focus?.({ preventScroll: true })
    }
  }, [open, onClose])
}
