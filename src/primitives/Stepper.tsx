import { useCallback, useEffect, useRef } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { MinusIcon, PlusIcon } from './icons'
import { cx } from './utils'
import styles from './Stepper.module.css'

export interface StepModifiers {
  shiftKey: boolean
  altKey: boolean
}

export interface StepperProps {
  onStep: (direction: 1 | -1, modifiers: StepModifiers) => void
  disabled?: boolean
  /** ms held before the press starts repeating. Default 380 */
  repeatDelay?: number
  /** ms between repeats once held. Default 55 */
  repeatInterval?: number
  className?: string
  'aria-label'?: string
}

/** The minus/plus pair that sits beside a NumberField. Holding repeats. */
export function Stepper({
  onStep,
  disabled,
  repeatDelay = 380,
  repeatInterval = 55,
  className,
  'aria-label': ariaLabel,
}: StepperProps) {
  const latest = useRef(onStep)
  latest.current = onStep
  const timers = useRef<{ delay?: number; repeat?: number }>({})

  const stop = useCallback(() => {
    window.clearTimeout(timers.current.delay)
    window.clearInterval(timers.current.repeat)
    timers.current = {}
  }, [])

  useEffect(() => stop, [stop])

  const press = (direction: 1 | -1) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const modifiers = { shiftKey: event.shiftKey, altKey: event.altKey }
    latest.current(direction, modifiers)
    stop()
    timers.current.delay = window.setTimeout(() => {
      timers.current.repeat = window.setInterval(() => latest.current(direction, modifiers), repeatInterval)
    }, repeatDelay)
  }

  const key = (direction: 1 | -1) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    latest.current(direction, { shiftKey: event.shiftKey, altKey: event.altKey })
  }

  const common = {
    type: 'button' as const,
    className: styles.button,
    disabled,
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
  }

  return (
    <div className={cx(styles.group, className)} role="group" aria-label={ariaLabel}>
      <button {...common} aria-label="Decrease" onPointerDown={press(-1)} onKeyDown={key(-1)}>
        <MinusIcon size={12} />
      </button>
      <span className={styles.divider} aria-hidden />
      <button {...common} aria-label="Increase" onPointerDown={press(1)} onKeyDown={key(1)}>
        <PlusIcon size={12} />
      </button>
    </div>
  )
}
