// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { clamp, cx } from './utils'
import styles from './Tooltip.module.css'

/**
 * Tooltip.
 *
 * The native `title` waits about a second, cannot be styled, and shows up
 * again a second later on the next control — which is why a toolbar built on
 * it feels like wading. This one opens in 130ms, and once one tip has been
 * shown the next is instant until the pointer has been off every trigger for
 * 400ms. Sweeping a row of icon buttons reads them at the speed you move.
 *
 *   <Tooltip label="Italic" shortcut="Ctrl+I">
 *     <button …>I</button>
 *   </Tooltip>
 *
 * The wrapper is `display: contents`, so it can go around any child — one
 * that forwards no ref and spreads no props included — without touching the
 * layout or needing the child to cooperate.
 */

/** First tip costs this; the rest are free while the group stays warm. */
const OPEN_DELAY = 130
/** How long the group stays warm after the last tip closes. */
const WARM_WINDOW = 400
/** Gap between the trigger and the tip, and the viewport keep-out. */
const GAP = 8
const MARGIN = 8

// Module scope on purpose: "warm" is a property of the page, not of one
// tooltip. Moving between two different Tooltips has to keep it.
let warm = false
let coolTimer = 0

export type TooltipSide = 'top' | 'bottom'

export interface TooltipProps {
  label: ReactNode
  /** right-aligned key hint, e.g. "Ctrl+I" — display only */
  shortcut?: string
  /** preferred side; flips when there is no room */
  side?: TooltipSide
  /** for a control whose tip would be noise in its current state */
  disabled?: boolean
  children: ReactNode
}

interface Placement {
  left: number
  top: number
  caret: number
  side: TooltipSide
}

export function Tooltip({ label, shortcut, side = 'top', disabled = false, children }: TooltipProps) {
  const id = useId()
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const openTimer = useRef(0)
  const [open, setOpen] = useState(false)
  const [placed, setPlaced] = useState<Placement | null>(null)

  /** The control itself. The wrapper has no box, so it cannot be measured. */
  const trigger = () => (wrapRef.current?.firstElementChild as HTMLElement | null) ?? null

  const hide = useCallback(() => {
    window.clearTimeout(openTimer.current)
    setOpen(false)
    setPlaced(null)
  }, [])

  const show = useCallback(
    (instant: boolean) => {
      if (disabled) return
      window.clearTimeout(openTimer.current)
      if (instant || warm) {
        setOpen(true)
        return
      }
      openTimer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY)
    },
    [disabled],
  )

  useEffect(() => () => window.clearTimeout(openTimer.current), [])

  useEffect(() => {
    if (disabled) hide()
  }, [disabled, hide])

  // Warming is owned by whichever tip is currently open, so the timers cannot
  // drift apart when several tooltips hand off to each other.
  useEffect(() => {
    if (!open) return
    warm = true
    window.clearTimeout(coolTimer)
    return () => {
      coolTimer = window.setTimeout(() => {
        warm = false
      }, WARM_WINDOW)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const anchor = trigger()?.getBoundingClientRect()
    const tip = tipRef.current?.getBoundingClientRect()
    if (!anchor || !tip) return

    let where: TooltipSide = side
    let top = side === 'top' ? anchor.top - tip.height - GAP : anchor.bottom + GAP
    // Flip only when the preferred side has no room and the other one does.
    if (where === 'top' && top < MARGIN && anchor.bottom + tip.height + GAP < window.innerHeight - MARGIN) {
      where = 'bottom'
      top = anchor.bottom + GAP
    } else if (
      where === 'bottom' &&
      top + tip.height > window.innerHeight - MARGIN &&
      anchor.top - tip.height - GAP > MARGIN
    ) {
      where = 'top'
      top = anchor.top - tip.height - GAP
    }

    const centre = anchor.left + anchor.width / 2
    const left = clamp(centre - tip.width / 2, MARGIN, Math.max(MARGIN, window.innerWidth - tip.width - MARGIN))
    // The caret keeps pointing at the control even after the tip is clamped.
    const caret = clamp(centre - left, 12, Math.max(12, tip.width - 12))

    setPlaced({ left, top, caret, side: where })
  }, [open, side, label, shortcut])

  // Describe the control while the tip is up. The wrapper cannot carry this —
  // it is not the control — so it goes on the child node directly and comes
  // straight back off, leaving the DOM as React expects to find it.
  useEffect(() => {
    if (!open) return
    const node = trigger()
    if (!node) return
    const had = node.getAttribute('aria-describedby')
    node.setAttribute('aria-describedby', had ? `${had} ${id}` : id)
    return () => {
      if (had) node.setAttribute('aria-describedby', had)
      else node.removeAttribute('aria-describedby')
    }
  }, [open, id])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [open, hide])

  // pointerover/out rather than enter/leave: these bubble, which is what lets
  // a wrapper with no box of its own hear about its child being entered.
  const onPointerOver = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.pointerType === 'touch') return
    show(false)
  }

  const onPointerOut = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const to = event.relatedTarget as Node | null
    if (to && event.currentTarget.contains(to)) return
    hide()
  }

  return (
    <>
      <span
        ref={wrapRef}
        className={styles.wrap}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onPointerDown={hide}
        onFocus={(event) => {
          // Only for keyboard focus. After a click the pointer is still on the
          // control and a tip would just cover what you came to press.
          if ((event.target as HTMLElement).matches?.(':focus-visible')) show(true)
        }}
        onBlur={hide}
      >
        {children}
      </span>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            className={cx(styles.tip, placed === null && styles.measuring)}
            style={{ left: placed?.left ?? 0, top: placed?.top ?? 0 }}
          >
            <span className={styles.row}>
              <span>{label}</span>
              {shortcut !== undefined && <span className={styles.kbd}>{shortcut}</span>}
            </span>
            <span
              aria-hidden
              className={cx(styles.caret, placed?.side === 'bottom' ? styles.caretBottom : styles.caretTop)}
              style={{ left: (placed?.caret ?? 0) - 4 }}
            />
          </div>,
          document.body,
        )}
    </>
  )
}
