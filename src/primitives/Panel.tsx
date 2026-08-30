import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDownIcon } from './icons'
import { cx } from './utils'
import styles from './Panel.module.css'

export interface PanelProps {
  title?: ReactNode
  /** actions rendered on the trailing edge of the panel header */
  actions?: ReactNode
  width?: number | string
  className?: string
  children: ReactNode
}

/** The floating inspector shell. */
export function Panel({ title, actions, width = 320, className, children }: PanelProps) {
  return (
    <section className={cx(styles.panel, className)} style={{ width }}>
      {(title || actions) && (
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export interface SectionProps {
  title: ReactNode
  actions?: ReactNode
  /** adds a disclosure chevron that folds the body away */
  collapsible?: boolean
  defaultOpen?: boolean
  className?: string
  children?: ReactNode
}

/** A titled group of rows, separated from its neighbours by a hairline. */
export function Section({
  title,
  actions,
  collapsible = false,
  defaultOpen = true,
  className,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const showBody = children !== undefined && (!collapsible || open)

  return (
    <div className={cx(styles.section, className)}>
      <div className={styles.sectionHeader}>
        {collapsible ? (
          <button
            type="button"
            className={cx(styles.sectionTitle, styles.sectionToggle)}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            {title}
            <ChevronDownIcon size={12} className={cx(styles.chevron, !open && styles.chevronClosed)} />
          </button>
        ) : (
          <span className={styles.sectionTitle}>{title}</span>
        )}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {showBody && <div className={styles.sectionBody}>{children}</div>}
    </div>
  )
}

export interface RowProps {
  label?: ReactNode
  /** stack the controls instead of laying them out in one line */
  stack?: boolean
  className?: string
  children: ReactNode
}

/**
 * One line of the inspector form: muted label on the left, controls on the
 * right. Controls with `flex: 1 1 0` split the remaining width evenly, which
 * is what gives paired fields (X/Y, W/H) their equal columns.
 */
export function Row({ label, stack = false, className, children }: RowProps) {
  return (
    <div className={cx(styles.row, className)}>
      {label !== undefined && <span className={styles.label}>{label}</span>}
      <div className={cx(styles.controls, stack && styles.stacked)}>{children}</div>
    </div>
  )
}

export interface IconButtonProps {
  children: ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  /** widen past the square default, for text toggles like M / S */
  wide?: boolean
  className?: string
  onClick?: () => void
}

export function IconButton({
  children,
  label,
  active = false,
  disabled,
  wide = false,
  className,
  onClick,
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={cx(styles.iconButton, wide && styles.iconButtonWide, active && styles.iconButtonOn, className)}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
