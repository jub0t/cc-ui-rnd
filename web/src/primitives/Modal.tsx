import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent, ReactNode } from 'react'
import { CloseIcon } from './icons'
import styles from './Modal.module.css'

/**
 * Modal dialog over a blurred page.
 *
 * The blur is not decoration. A dimmed page still reads, so it still invites
 * you to try the controls underneath; a blurred one says the page is not
 * available right now, which is exactly what a modal means.
 *
 * Everything a dialog has to do and a positioned div does not: it traps Tab,
 * locks the page behind it without the scrollbar jumping, restores focus on
 * the way out, and is announced as a dialog.
 */

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  open: boolean
  /** Escape, the backdrop and the close button all route here. */
  onClose: () => void
  title: ReactNode
  /** shown under the title and wired to aria-describedby */
  description?: ReactNode
  /**
   * Off for a dialog that must be answered rather than waved away. The close
   * button disappears with it, so there is no control that quietly does
   * nothing — a running task is cancelled from its own button, not by
   * dismissing the window that reports it.
   */
  dismissible?: boolean
  width?: number
  footer?: ReactNode
  children?: ReactNode
}

export function Modal({
  open,
  onClose,
  title,
  description,
  dismissible = true,
  width = 420,
  footer,
  children,
}: ModalProps) {
  const id = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreTo.current = document.activeElement as HTMLElement | null

    // Lock the page, and pay back the width the scrollbar was taking so the
    // layout behind the blur does not jump sideways as the dialog opens.
    const { body, documentElement } = document
    const gap = window.innerWidth - documentElement.clientWidth
    const overflow = body.style.overflow
    const padding = body.style.paddingRight
    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${gap}px`

    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? dialogRef.current)?.focus({ preventScroll: true })

    return () => {
      body.style.overflow = overflow
      body.style.paddingRight = padding
      restoreTo.current?.focus?.({ preventScroll: true })
    }
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && dismissible) {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    // Trap: focus must not walk out into a page nobody can see.
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (focusable.length === 0) {
      event.preventDefault()
      return
    }
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    const active = document.activeElement

    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description === undefined ? undefined : `${id}-description`}
        tabIndex={-1}
        style={{ maxWidth: width }}
        className={styles.dialog}
        onKeyDown={onKeyDown}
      >
        <div className={styles.header}>
          <h2 id={`${id}-title`} className={styles.title}>
            {title}
          </h2>
          {dismissible && (
            <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
              <CloseIcon size={13} />
            </button>
          )}
        </div>

        <div className={styles.body}>
          {description !== undefined && <div id={`${id}-description`}>{description}</div>}
          {children}
        </div>

        {footer !== undefined && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
