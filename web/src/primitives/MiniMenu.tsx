// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent, ReactNode } from 'react'
import { useMenuDismiss, useMenuPlacement } from './menu-core'
import type { MenuAnchor } from './menu-core'
import { cx } from './utils'
import styles from './MiniMenu.module.css'

/**
 * The small right-click menu: a flat list of verbs, an optional separator,
 * and nothing else.
 *
 * Deliberately narrower than `ContextMenu` — no submenus, no checkbox rows,
 * no group labels, no typeahead. Three items do not need a search affordance,
 * and every feature a menu carries is one more thing to read past. What it
 * does keep is everything that makes a menu usable at all: it is portalled,
 * it clamps inside the viewport, arrows and Escape work, and focus goes back
 * where it came from. Those come from `menu-core`, shared with ContextMenu.
 *
 *   const menu = useContextMenu()
 *
 *   <div onContextMenu={menu.onContextMenu}>…</div>
 *   <MiniMenu {...menu.props} items={ITEMS} aria-label="Clip actions" />
 */

export interface MiniMenuAction {
  label: string
  /** leading glyph. Items without one still align, the slot is always there */
  icon?: ReactNode
  /** right-aligned hint, e.g. "Del". Display only — bind the key yourself */
  shortcut?: string
  /** red at rest, for the row that destroys something */
  danger?: boolean
  disabled?: boolean
  onSelect?: () => void
}

/** A bare string for the divider: the only non-item this menu has. */
export type MiniMenuItem = MiniMenuAction | 'separator'

const isAction = (item: MiniMenuItem): item is MiniMenuAction => typeof item !== 'string'

function Surface({
  items,
  x,
  y,
  onClose,
  label,
}: {
  items: readonly MiniMenuItem[]
  x: number
  y: number
  onClose: () => void
  label?: string
}) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [active, setActive] = useState(-1)

  const placed = useMenuPlacement(surfaceRef, x, y, false, [items])
  const indexes = items
    .map((_, index) => index)
    .filter((index) => {
      const item = items[index]
      return item !== undefined && isAction(item) && !item.disabled
    })

  useEffect(() => {
    surfaceRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (active < 0) return
    rowRefs.current[active]?.focus({ preventScroll: true })
  }, [active])

  const step = (direction: 1 | -1) => {
    if (indexes.length === 0) return
    const at = indexes.indexOf(active)
    const next =
      at < 0 ? (direction === 1 ? 0 : indexes.length - 1) : (at + direction + indexes.length) % indexes.length
    setActive(indexes[next] ?? -1)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        step(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        step(-1)
        break
      case 'Home':
        event.preventDefault()
        setActive(indexes[0] ?? -1)
        break
      case 'End':
        event.preventDefault()
        setActive(indexes[indexes.length - 1] ?? -1)
        break
      case 'Escape':
      case 'Tab':
        event.preventDefault()
        onClose()
        break
      default:
        break
    }
  }

  return (
    <div
      ref={surfaceRef}
      data-cp-menu
      role="menu"
      aria-label={label}
      tabIndex={-1}
      className={cx(styles.surface, placed === null && styles.measuring)}
      style={{ left: placed?.left ?? x, top: placed?.top ?? y }}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) =>
        isAction(item) ? (
          <button
            key={`${item.label}-${index}`}
            ref={(element) => {
              rowRefs.current[index] = element
            }}
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={item.disabled}
            className={cx(styles.item, item.danger && styles.danger)}
            onPointerEnter={() => !item.disabled && setActive(index)}
            onClick={() => {
              item.onSelect?.()
              onClose()
            }}
          >
            <span className={styles.slot}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
            {item.shortcut !== undefined && <span className={styles.shortcut}>{item.shortcut}</span>}
          </button>
        ) : (
          <div key={`sep-${index}`} className={styles.separator} role="separator" />
        ),
      )}
    </div>
  )
}

export interface MiniMenuProps extends MenuAnchor {
  items: readonly MiniMenuItem[]
  'aria-label'?: string
}

export function MiniMenu({ open, x, y, onClose, items, 'aria-label': ariaLabel }: MiniMenuProps) {
  useMenuDismiss(open, onClose)

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <Surface items={items} x={x} y={y} onClose={onClose} label={ariaLabel} />,
    document.body,
  )
}
