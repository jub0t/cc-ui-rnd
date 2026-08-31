import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent, ReactNode } from 'react'
import { CheckIcon, ChevronDownIcon } from './icons'
import { useMenuDismiss, useMenuPlacement } from './menu-core'
import type { MenuAnchor } from './menu-core'
import { cx } from './utils'
import styles from './ContextMenu.module.css'

/**
 * The full right-click menu: submenus, checkbox rows, group labels, shortcut
 * hints, typeahead. Where it lands and what dismisses it come from
 * `menu-core`, which it shares with `MiniMenu` — reach for that one when the
 * menu is a short flat list of verbs.
 *
 *   const menu = useContextMenu()
 *
 *   <div onContextMenu={menu.onContextMenu}>…</div>
 *   <ContextMenu {...menu.props} items={ITEMS} aria-label="Clip actions" />
 */

export { useContextMenu } from './menu-core'
export type ContextMenuState = MenuAnchor

export interface ContextMenuAction {
  type?: 'item'
  label: string
  /** leading glyph. Items without one still align, the slot is always there */
  icon?: ReactNode
  /** right-aligned hint, e.g. "Ctrl+C". Display only — bind the key yourself */
  shortcut?: string
  disabled?: boolean
  /** paints the row red on hover, for the one row that destroys something */
  danger?: boolean
  /** present (true or false) turns the row into a checkbox row */
  checked?: boolean
  /** a submenu. Opens on hover, on ArrowRight, or on click */
  items?: ContextMenuItem[]
  onSelect?: () => void
}

export type ContextMenuItem =
  | ContextMenuAction
  | { type: 'separator' }
  | { type: 'label'; label: string }

const isAction = (item: ContextMenuItem): item is ContextMenuAction =>
  item.type === undefined || item.type === 'item'

const selectable = (item: ContextMenuItem) => isAction(item) && !item.disabled

/* ------------------------------------------------------------------ */
/* Surface                                                             */
/* ------------------------------------------------------------------ */

interface SurfaceProps {
  items: readonly ContextMenuItem[]
  x: number
  y: number
  /** closes the whole tree */
  onClose: () => void
  /** closes this submenu and hands focus back to its parent row */
  onDismiss?: () => void
  /** prefer opening to the left of the anchor, once a parent has flipped */
  flipped?: boolean
  label?: string
}

function Surface({ items, x, y, onClose, onDismiss, flipped = false, label }: SurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [active, setActive] = useState(-1)
  const [openSub, setOpenSub] = useState<number | null>(null)
  const hoverTimer = useRef(0)

  const placed = useMenuPlacement(surfaceRef, x, y, flipped, [items])
  const indexes = items.map((_, index) => index).filter((index) => selectable(items[index]!))

  useEffect(() => {
    surfaceRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (active < 0) return
    rowRefs.current[active]?.focus({ preventScroll: true })
  }, [active])

  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  const step = (direction: 1 | -1) => {
    if (indexes.length === 0) return
    const at = indexes.indexOf(active)
    const next =
      at < 0 ? (direction === 1 ? 0 : indexes.length - 1) : (at + direction + indexes.length) % indexes.length
    setActive(indexes[next] ?? -1)
  }

  const run = (item: ContextMenuAction, index: number) => {
    if (item.items && item.items.length > 0) {
      setOpenSub(index)
      return
    }
    item.onSelect?.()
    onClose()
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
      case 'ArrowRight': {
        const item = active >= 0 ? items[active] : undefined
        if (item && isAction(item) && item.items?.length) {
          event.preventDefault()
          setOpenSub(active)
        }
        break
      }
      case 'ArrowLeft':
        if (onDismiss) {
          event.preventDefault()
          onDismiss()
        }
        break
      case 'Escape':
        event.preventDefault()
        onClose()
        break
      case 'Tab':
        // A menu is modal enough that tabbing past it should dismiss it rather
        // than leave it hanging over a page the focus has already left.
        event.preventDefault()
        onClose()
        break
      default: {
        if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return
        const needle = event.key.toLowerCase()
        const found = indexes.find((index) => {
          const item = items[index]
          return isAction(item!) && item.label.toLowerCase().startsWith(needle)
        })
        if (found !== undefined) {
          event.preventDefault()
          setActive(found)
        }
      }
    }
  }

  const subAnchor = () => {
    if (openSub === null) return null
    const rect = rowRefs.current[openSub]?.getBoundingClientRect()
    if (!rect) return null
    return { x: placed?.flipped ? rect.left + 4 : rect.right - 4, y: rect.top - 5 }
  }

  const anchor = subAnchor()
  const sub = openSub !== null ? items[openSub] : undefined

  return (
    <>
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
        {items.map((item, index) => {
          if (item.type === 'separator') {
            return <div key={`sep-${index}`} className={styles.separator} role="separator" />
          }
          if (item.type === 'label') {
            return (
              <div key={`label-${index}`} className={styles.groupLabel}>
                {item.label}
              </div>
            )
          }

          const hasSub = Boolean(item.items && item.items.length > 0)
          const checkable = item.checked !== undefined

          return (
            <button
              key={`${item.label}-${index}`}
              ref={(element) => {
                rowRefs.current[index] = element
              }}
              type="button"
              role={checkable ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={checkable ? item.checked : undefined}
              aria-haspopup={hasSub ? 'menu' : undefined}
              aria-expanded={hasSub ? openSub === index : undefined}
              tabIndex={-1}
              disabled={item.disabled}
              className={cx(styles.item, item.danger && styles.danger)}
              onClick={() => run(item, index)}
              onPointerEnter={() => {
                if (item.disabled) return
                setActive(index)
                window.clearTimeout(hoverTimer.current)
                // A short delay lets the pointer cross a neighbouring row on
                // its way to an open submenu without slamming it shut.
                hoverTimer.current = window.setTimeout(
                  () => setOpenSub(hasSub ? index : null),
                  hasSub ? 90 : 180,
                )
              }}
            >
              <span className={styles.slot}>
                {checkable ? item.checked ? <CheckIcon size={12} /> : null : item.icon}
              </span>
              <span className={styles.label}>{item.label}</span>
              {item.shortcut !== undefined && <span className={styles.shortcut}>{item.shortcut}</span>}
              {hasSub && <ChevronDownIcon size={12} className={styles.chevron} />}
            </button>
          )
        })}
      </div>

      {sub && isAction(sub) && sub.items && anchor && (
        <Surface
          items={sub.items}
          x={anchor.x}
          y={anchor.y}
          flipped={placed?.flipped ?? false}
          onClose={onClose}
          onDismiss={() => {
            setOpenSub(null)
            rowRefs.current[openSub!]?.focus({ preventScroll: true })
          }}
          label={sub.label}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

export interface ContextMenuProps extends MenuAnchor {
  items: readonly ContextMenuItem[]
  'aria-label'?: string
}

export function ContextMenu({ open, x, y, onClose, items, 'aria-label': ariaLabel }: ContextMenuProps) {
  useMenuDismiss(open, onClose)

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <Surface items={items} x={x} y={y} onClose={onClose} label={ariaLabel} />,
    document.body,
  )
}
