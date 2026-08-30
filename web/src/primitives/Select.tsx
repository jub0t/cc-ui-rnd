import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { CheckIcon, ChevronDownIcon } from './icons'
import { cx } from './utils'
import styles from './Select.module.css'

export interface SelectOption<T> {
  value: T
  label: string
  icon?: ReactNode
  disabled?: boolean
}

export interface SelectProps<T> {
  options: readonly SelectOption<T>[]
  value: T
  onChange: (value: T) => void
  /** leading adornment on the trigger */
  icon?: ReactNode
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

const TYPEAHEAD_WINDOW = 600
const OPEN_KEYS = ['ArrowDown', 'ArrowUp', 'Enter', ' ']

/**
 * Custom listbox dropdown: no native select, so options can carry icons and
 * match the panel styling. Keyboard-complete (arrows, Home/End, typeahead,
 * Escape) and flips above the trigger when there is no room below.
 */
export function Select<T extends string | number>({
  options,
  value,
  onChange,
  icon,
  placeholder = 'Select',
  disabled,
  className,
  'aria-label': ariaLabel,
}: SelectProps<T>) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeahead = useRef({ query: '', at: 0 })

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [dropUp, setDropUp] = useState(false)

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const enabledFrom = (from: number, direction: 1 | -1) => {
    const count = options.length
    let cursor = from
    for (let hop = 0; hop < count; hop += 1) {
      cursor = (cursor + direction + count) % count
      if (!options[cursor]?.disabled) return cursor
    }
    return from
  }

  const openList = () => {
    if (disabled) return
    setActive(selectedIndex >= 0 ? selectedIndex : enabledFrom(-1, 1))
    setOpen(true)
  }

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  const commit = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    close(true)
  }

  // Place the list and hand it focus once it is in the DOM but before paint.
  useLayoutEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const list = listRef.current
    if (!trigger || !list) return
    const rect = trigger.getBoundingClientRect()
    const needed = list.offsetHeight + 8
    setDropUp(rect.bottom + needed > window.innerHeight && rect.top > needed)
    list.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  useEffect(() => {
    if (!open) return
    const activeEl = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (OPEN_KEYS.includes(event.key)) {
      event.preventDefault()
      openList()
    }
  }

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive((current) => enabledFrom(current, 1))
        return
      case 'ArrowUp':
        event.preventDefault()
        setActive((current) => enabledFrom(current, -1))
        return
      case 'Home':
        event.preventDefault()
        setActive(enabledFrom(-1, 1))
        return
      case 'End':
        event.preventDefault()
        setActive(enabledFrom(options.length, -1))
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        commit(active)
        return
      case 'Escape':
        event.preventDefault()
        close(true)
        return
      case 'Tab':
        close(false)
        return
      default:
        break
    }

    // typeahead: printable keys jump to the first option with that prefix
    if (event.key.length !== 1 || event.metaKey || event.ctrlKey) return
    const now = Date.now()
    const state = typeahead.current
    state.query = now - state.at > TYPEAHEAD_WINDOW ? event.key : state.query + event.key
    state.at = now
    const query = state.query.toLowerCase()
    const match = options.findIndex(
      (option) => !option.disabled && option.label.toLowerCase().startsWith(query),
    )
    if (match >= 0) setActive(match)
  }

  return (
    <div ref={rootRef} className={cx(styles.root, className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={cx(styles.trigger, open && styles.open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close(true) : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={cx(styles.label, !selected && styles.placeholder)}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDownIcon size={12} className={styles.chevron} />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={id + '-option-' + active}
          className={cx(styles.list, dropUp && styles.dropUp)}
          onKeyDown={onListKeyDown}
        >
          {options.map((option, index) => (
            <li
              key={String(option.value)}
              id={id + '-option-' + index}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled}
              data-active={index === active}
              className={cx(styles.option, option.disabled && styles.optionDisabled)}
              onPointerEnter={() => !option.disabled && setActive(index)}
              onClick={() => commit(index)}
            >
              {option.icon && <span className={styles.icon}>{option.icon}</span>}
              <span className={styles.optionLabel}>{option.label}</span>
              {option.value === value && <CheckIcon size={12} className={styles.check} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
