import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import clsx from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { NumberField, clamp, decimalsOf, roundTo, usePointerDrag } from '../../primitives'

/** clsx for conditionals, tailwind-merge so a passed class always wins. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

/* ------------------------------------------------------------------ */
/* Panel shell — mirrors the inspector panels at the top of the page   */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  note,
  action,
  width = 340,
  children,
}: {
  title: string
  note?: ReactNode
  action?: ReactNode
  width?: number
  children: ReactNode
}) {
  return (
    <section
      data-tw
      style={{ width }}
      className="flex flex-none flex-col overflow-hidden rounded-panel border border-line bg-panel font-ui text-[13px] text-ink shadow-[0_18px_40px_rgb(0_0_0/0.35)]"
    >
      <header className="flex h-[42px] flex-none items-center justify-between gap-2.5 px-3.5">
        <h3 className="text-[13px] font-medium text-ink">{title}</h3>
        {note !== undefined && (
          <span className="text-[11.5px] tabular-nums text-inkdim">{note}</span>
        )}
        {action}
      </header>
      {children}
    </section>
  )
}

export function Section({
  label,
  action,
  summary,
  collapsible = false,
  defaultOpen = true,
  children,
}: {
  label: string
  action?: ReactNode
  /** shown in the header only while collapsed, so a folded section still
   *  reports what it is holding rather than hiding it */
  summary?: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  // A popover inside a section (the font Select) must not be clipped, so the
  // overflow guard is lifted once the open transition has finished. Timed
  // rather than transitionend-driven, so it still settles under reduced motion.
  const [settled, setSettled] = useState(defaultOpen)

  useEffect(() => {
    if (!open) {
      setSettled(false)
      return
    }
    const id = window.setTimeout(() => setSettled(true), 220)
    return () => window.clearTimeout(id)
  }, [open])

  // Equal 14px inset on every side, matching the panel gutter — the body
  // used to sit flush against its header with only a bottom pad.
  const body = <div className="flex flex-col gap-1.5 p-3.5">{children}</div>

  if (!collapsible) {
    return (
      <section className="border-t border-line">
        <div className="flex h-9 items-center justify-between gap-2 px-3.5">
          <h4 className="text-[13px] font-medium text-ink">{label}</h4>
          {action}
        </div>
        {body}
      </section>
    )
  }

  return (
    <section className="border-t border-line">
      {/* Only a toggling header carries the raised tone, so the colour itself
          says "this bar does something" before the chevron is even read. */}
      <div className="flex h-9 items-center gap-2 bg-head px-3.5 transition-colors hover:bg-headhi">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded text-left focus-visible:ring-1 focus-visible:ring-accent"
        >
          <ChevronRight
            size={13}
            className={cn(
              'text-inkdim transition-transform duration-200 motion-reduce:transition-none',
              open && 'rotate-90',
            )}
          />
          <span className="text-[13px] font-medium text-ink">{label}</span>
          {!open && summary !== undefined && (
            <span className="ml-auto min-w-0 truncate pl-2 text-[11px] text-inkdim">{summary}</span>
          )}
        </button>
        {action}
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className={cn('min-h-0', !(open && settled) && 'overflow-hidden')}>{body}</div>
      </div>
    </section>
  )
}

export function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'grid min-h-7 items-center gap-2.5',
        label === undefined ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[78px_minmax(0,1fr)]',
      )}
    >
      {label !== undefined && (
        <span className="truncate text-xs text-inkmute">{label}</span>
      )}
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
    </div>
  )
}

/** Value plus its plain-language consequence, above a full-width control. */
export function Readout({
  primary,
  secondary,
  children,
}: {
  primary: ReactNode
  secondary?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs tabular-nums text-ink">{primary}</span>
        {secondary !== undefined && (
          <span className="text-[11.5px] tabular-nums text-inkdim">{secondary}</span>
        )}
      </div>
      {children}
    </div>
  )
}

/** Sub-controls that only exist once their parent toggle is on. */
export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      aria-hidden={!open}
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          inert={!open || undefined}
          className="mt-1 flex flex-col gap-1.5 rounded-md border border-linesoft bg-well p-2.5"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

export const button = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-45',
  {
    variants: {
      variant: {
        default: 'border border-line bg-field text-ink hover:border-edge hover:bg-fieldhi',
        primary: 'border border-accent bg-accent text-white hover:border-accenthi hover:bg-accenthi',
        ghost: 'text-inkmute hover:bg-field hover:text-ink',
        danger: 'border border-line bg-field text-ink hover:border-[#5a2b28] hover:bg-[#2a1614]',
      },
      size: {
        sm: 'h-7 px-3 text-xs',
        md: 'h-[34px] px-4 text-[13px]',
        icon: 'size-[26px]',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'default', size: 'sm' },
  },
)

export type ButtonProps = VariantProps<typeof button> & {
  children: ReactNode
  className?: string
  title?: string
  'aria-label'?: string
  'aria-pressed'?: boolean
  disabled?: boolean
  onClick?: () => void
}

export function Button({ variant, size, block, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={cn(button({ variant, size, block }), className)} {...rest}>
      {children}
    </button>
  )
}

export function TextButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded text-xs text-accent hover:text-accenthi hover:underline focus-visible:ring-1 focus-visible:ring-accent"
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

const fieldBase =
  'w-full min-w-0 rounded-md bg-field text-xs text-ink transition-colors hover:bg-fieldhi focus:ring-1 focus:ring-accent placeholder:text-inkdim'

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
  ...rest
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  'aria-label'?: string
}) {
  return (
    <input
      value={value}
      spellCheck={false}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn(fieldBase, 'h-7 px-2.5', className)}
      {...rest}
    />
  )
}

export function TextArea({
  value,
  onChange,
  placeholder,
  ...rest
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  'aria-label'?: string
}) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn(fieldBase, 'min-h-[68px] resize-y px-2.5 py-2 text-[13px] leading-relaxed')}
      {...rest}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Slider — console fader cap, not a bead                              */
/* ------------------------------------------------------------------ */

/** Checkerboard for alpha tracks. Genuinely needs a repeating paint. */
export const CHECKER: CSSProperties = {
  backgroundColor: '#16161b',
  backgroundImage:
    'linear-gradient(45deg,#24242c 25%,transparent 25%),linear-gradient(-45deg,#24242c 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#24242c 75%),linear-gradient(-45deg,transparent 75%,#24242c 75%)',
  backgroundSize: '6px 6px',
  backgroundPosition: '0 0,0 3px,3px -3px,-3px 0',
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  bubble,
  ramp,
  'aria-label': ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  bubble?: (value: number) => string
  ramp?: string
  'aria-label'?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const digits = decimalsOf(step)

  const apply = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const fraction = clamp((clientX - rect.left) / rect.width, 0, 1)
    const raw = min + fraction * (max - min)
    onChange(roundTo(clamp(Math.round(raw / step) * step, min, max), digits))
  }

  const begin = usePointerDrag({
    threshold: 0,
    cursor: 'grabbing',
    onStart: ({ x }) => {
      setDragging(true)
      apply(x)
    },
    onMove: ({ x }) => apply(x),
    onEnd: () => setDragging(false),
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: step * 10,
      PageDown: step * -10,
    }
    if (event.key === 'Home') {
      event.preventDefault()
      onChange(min)
    } else if (event.key === 'End') {
      event.preventDefault()
      onChange(max)
    } else if (event.key in moves) {
      event.preventDefault()
      onChange(roundTo(clamp(value + (moves[event.key] ?? 0), min, max), digits))
    }
  }

  const percent = ((clamp(value, min, max) - min) / (max - min || 1)) * 100

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onKeyDown={onKeyDown}
      className="group relative flex h-6 w-full min-w-0 touch-none items-center"
    >
      <div
        ref={trackRef}
        onPointerDown={begin}
        style={ramp ? CHECKER : undefined}
        className="relative h-1 w-full cursor-pointer rounded-full bg-well ring-1 ring-line ring-inset"
      >
        {ramp ? (
          <span className="absolute inset-0 rounded-full" style={{ background: ramp }} />
        ) : (
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-accent"
            style={{ width: `${percent}%` }}
          />
        )}
        {/* fader cap: flat edges land on the track with a precision a circle never has */}
        <span
          style={{ left: `${percent}%` }}
          className={cn(
            'pointer-events-none absolute top-1/2 -ml-[5.5px] w-[11px] -translate-y-1/2 rounded-[3px] bg-[#dcdce4] shadow-[0_0_0_1px_rgb(0_0_0/0.55),0_1px_2px_rgb(0_0_0/0.4)] transition-[height,background] duration-100',
            dragging ? 'h-6 bg-white' : 'h-5 group-hover:h-[22px]',
          )}
        >
          <span
            className={cn(
              'absolute inset-x-[2.5px] top-[7px] h-px',
              dragging ? 'bg-accent' : 'bg-black/25',
            )}
          />
          <span
            className={cn(
              'absolute inset-x-[2.5px] top-[10px] h-px',
              dragging ? 'bg-accent' : 'bg-black/25',
            )}
          />
        </span>
      </div>

      {dragging && bubble && (
        <span
          style={{ left: `${percent}%` }}
          className="pointer-events-none absolute bottom-[26px] -translate-x-1/2 rounded border border-line bg-[#2c2c36] px-1.5 py-0.5 text-[11px] tabular-nums whitespace-nowrap text-ink"
        >
          {bubble(value)}
        </span>
      )}
    </div>
  )
}

/**
 * A slider paired with a numeric field. The slider is for finding a value,
 * the field is for landing on an exact one — neither can do the other's job.
 *
 * `scale` lets the field speak a friendlier unit than the stored value: a
 * 0..1 opacity shows as 0..100 %, a 0..2 em padding as 0..200 % of text size.
 */
export function SliderField({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  scale = 1,
  precision = 0,
  suffix,
  ramp,
  bubble,
  'aria-label': ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** multiplier applied for display in the field, e.g. 100 to show a percent */
  scale?: number
  precision?: number
  suffix?: string
  ramp?: string
  bubble?: (value: number) => string
  'aria-label'?: string
}) {
  const out = (v: number) => roundTo(v * scale, precision)

  return (
    <div className="flex items-center gap-2">
      <Slider
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        ramp={ramp}
        bubble={bubble}
        aria-label={ariaLabel}
      />
      <div className="w-[66px] flex-none">
        <NumberField
          value={out(value)}
          onChange={(v) => onChange(clamp(v / scale, min, max))}
          min={out(min)}
          max={out(max)}
          step={roundTo(step * scale, 3)}
          precision={precision}
          suffix={suffix}
          aria-label={ariaLabel ? `${ariaLabel} value` : undefined}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Toggle / ColorField / Progress                                      */
/* ------------------------------------------------------------------ */

export function Toggle({
  checked,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        // pushed to the trailing edge: a switch reads as the row's answer, so
        // it belongs opposite its label rather than crowded up against it
        'relative ml-auto h-5 w-[34px] flex-none rounded-full transition-colors focus-visible:ring-1 focus-visible:ring-accent',
        checked ? 'bg-accent ring-1 ring-accent ring-inset' : 'bg-field ring-1 ring-line ring-inset hover:bg-fieldhi',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] left-[3px] size-3.5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.4)] transition-transform duration-150 motion-reduce:transition-none',
          checked && 'translate-x-3.5',
        )}
      />
    </button>
  )
}

const HEX = /^#[0-9a-f]{6}$/i

export function ColorField({
  value,
  onChange,
  alpha = 1,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  alpha?: number
  'aria-label'?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span
        style={CHECKER}
        className="relative size-7 flex-none overflow-hidden rounded ring-1 ring-white/15 ring-inset"
      >
        <span className="absolute inset-0" style={{ background: value, opacity: alpha }} />
        <input
          type="color"
          value={value}
          aria-label={ariaLabel ? `${ariaLabel} swatch` : 'Colour swatch'}
          onChange={(event) => onChange(event.target.value)}
          className="absolute -inset-1 size-[calc(100%+8px)] cursor-pointer opacity-0"
        />
      </span>
      <input
        value={draft ?? value}
        spellCheck={false}
        aria-label={ariaLabel}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          const text = event.target.value.trim().replace(/^#?/, '#')
          if (HEX.test(text)) onChange(text.toLowerCase())
          setDraft(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            setDraft(null)
            event.currentTarget.blur()
          }
        }}
        className={cn(fieldBase, 'h-7 px-2.5 lowercase tabular-nums')}
      />
    </div>
  )
}

export function Progress({ value, done = false }: { value: number; done?: boolean }) {
  const percent = clamp(value, 0, 1) * 100
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1 w-full overflow-hidden rounded-full bg-well ring-1 ring-line ring-inset"
    >
      <span
        style={{ width: `${percent}%` }}
        className={cn(
          'block h-full rounded-full transition-[width] duration-150 ease-linear',
          done ? 'bg-success' : 'bg-accent',
        )}
      />
    </div>
  )
}
