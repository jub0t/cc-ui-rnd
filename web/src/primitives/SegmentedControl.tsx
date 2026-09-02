// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useElementSize } from './useElementSize'
import { cx } from './utils'
import styles from './SegmentedControl.module.css'

export interface SegmentedOption<T> {
  value: T
  label: ReactNode
  title?: string
  disabled?: boolean
}

export interface SegmentedControlProps<T> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

/** Single-select tab row with a thumb that slides to the active segment. */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null)
  const index = options.findIndex((option) => option.value === value)

  useLayoutEffect(() => {
    const el = index >= 0 ? buttons.current[index] : null
    setThumb(el ? { left: el.offsetLeft, width: el.offsetWidth } : null)
  }, [index, options, size.width])

  const move = (direction: 1 | -1) => {
    const count = options.length
    let cursor = index < 0 ? (direction === 1 ? -1 : 0) : index
    for (let hop = 0; hop < count; hop += 1) {
      cursor = (cursor + direction + count) % count
      const option = options[cursor]
      if (option && !option.disabled) {
        onChange(option.value)
        buttons.current[cursor]?.focus()
        return
      }
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    }
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx(styles.group, disabled && styles.disabled, className)}
      onKeyDown={onKeyDown}
    >
      {thumb && (
        <span
          className={styles.thumb}
          aria-hidden
          style={{ transform: `translateX(${thumb.left}px)`, width: thumb.width }}
        />
      )}
      {options.map((option, i) => {
        const active = option.value === value
        return (
          <button
            key={String(option.value)}
            ref={(el) => {
              buttons.current[i] = el
            }}
            type="button"
            role="radio"
            title={option.title}
            aria-checked={active}
            disabled={disabled || option.disabled}
            // roving tabindex keeps the group a single tab stop
            tabIndex={active || (index < 0 && i === 0) ? 0 : -1}
            className={cx(styles.segment, active && styles.active)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
