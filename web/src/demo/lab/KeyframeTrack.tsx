// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { BezierEditor, NumberField, clamp, usePointerDrag } from '../../primitives'
import type { BezierValue } from '../../primitives'
import { cn } from '../editor/ui'

const SPAN = 6 // seconds across a lane
const SNAP = 0.05 // seconds; also the tolerance for "the playhead is on this key"

interface Key {
  id: string
  t: number
  value: number
  /** easing applied on the way *out* of this key, toward the next one */
  ease: BezierValue
}

interface Prop {
  id: string
  label: string
  suffix?: string
  min: number
  max: number
  step: number
  keys: Key[]
}

const LINEAR: BezierValue = [0.25, 0.25, 0.75, 0.75]
const EASE_IN: BezierValue = [0.42, 0, 1, 1]
const EASE_OUT: BezierValue = [0, 0, 0.58, 1]
const EASE_IN_OUT: BezierValue = [0.42, 0, 0.58, 1]

const PRESETS = [
  { label: 'Linear', value: LINEAR },
  { label: 'In', value: EASE_IN },
  { label: 'Out', value: EASE_OUT },
  { label: 'In · Out', value: EASE_IN_OUT },
]

let seq = 0
const nextId = () => `k${(seq += 1)}`

const INITIAL: Prop[] = [
  {
    id: 'x',
    label: 'Position X',
    min: -1920,
    max: 1920,
    step: 1,
    keys: [
      { id: nextId(), t: 0.4, value: -420, ease: EASE_OUT },
      { id: nextId(), t: 3.1, value: 260, ease: EASE_IN_OUT },
      { id: nextId(), t: 5.4, value: 0, ease: LINEAR },
    ],
  },
  {
    id: 'scale',
    label: 'Scale',
    suffix: '%',
    min: 0,
    max: 400,
    step: 1,
    keys: [
      { id: nextId(), t: 0.4, value: 100, ease: EASE_IN_OUT },
      { id: nextId(), t: 2.2, value: 148, ease: EASE_OUT },
      { id: nextId(), t: 5.4, value: 112, ease: LINEAR },
    ],
  },
  {
    id: 'opacity',
    label: 'Opacity',
    suffix: '%',
    min: 0,
    max: 100,
    step: 1,
    keys: [
      { id: nextId(), t: 0.9, value: 0, ease: EASE_OUT },
      { id: nextId(), t: 2.0, value: 100, ease: LINEAR },
      { id: nextId(), t: 4.6, value: 100, ease: EASE_IN_OUT },
      { id: nextId(), t: 5.8, value: 0, ease: LINEAR },
    ],
  },
]

/** Cubic-bezier solver: given x (0..1 across the segment), return eased y. */
function easing([x1, y1, x2, y2]: BezierValue) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  return (x: number) => {
    let t = clamp(x, 0, 1)
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x
      if (Math.abs(error) < 1e-5) break
      const slope = slopeX(t)
      if (Math.abs(slope) < 1e-6) break
      t -= error / slope
    }
    t = clamp(t, 0, 1)
    return ((ay * t + by) * t + cy) * t
  }
}

/** Value of an animated property at time `t`, honouring each segment's ease. */
function valueAt(prop: Prop, t: number): number {
  const { keys } = prop
  const first = keys[0]
  const last = keys[keys.length - 1]
  if (!first || !last) return 0
  if (t <= first.t) return first.value
  if (t >= last.t) return last.value

  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i]!
    const b = keys[i + 1]!
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1
      return a.value + (b.value - a.value) * easing(a.ease)((t - a.t) / span)
    }
  }
  return last.value
}

/** The animation drawn as a curve, normalised to the keys' own value range. */
function curvePath(prop: Prop, samples = 72): string {
  const values = prop.keys.map((key) => key.value)
  const low = Math.min(...values)
  const high = Math.max(...values)
  const range = high - low || 1
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = (i / samples) * SPAN
    const y = 88 - ((valueAt(prop, t) - low) / range) * 76
    return `${((t / SPAN) * 100).toFixed(3)},${y.toFixed(2)}`
  }).join(' ')
}

const pct = (t: number) => `${(t / SPAN) * 100}%`

export function KeyframeTrack() {
  const [props, setProps] = useState(INITIAL)
  const [playhead, setPlayhead] = useState(2.4)
  const [selectedId, setSelectedId] = useState<string | null>('k4')
  const axisRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ prop: string; id: string } | null>(null)

  /** All lanes share one x-axis, so one rect converts pointer to time. */
  const timeAt = (clientX: number) => {
    const rect = axisRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    const raw = ((clientX - rect.left) / rect.width) * SPAN
    return clamp(Math.round(raw / SNAP) * SNAP, 0, SPAN)
  }

  const scrub = usePointerDrag({
    threshold: 0,
    onStart: ({ x }) => setPlayhead(timeAt(x)),
    onMove: ({ x }) => setPlayhead(timeAt(x)),
  })

  const dragKey = usePointerDrag({
    threshold: 0,
    onMove: ({ x }) => {
      const grabbed = dragging.current
      if (!grabbed) return
      const t = timeAt(x)
      setProps((current) =>
        current.map((prop) => {
          if (prop.id !== grabbed.prop) return prop
          const index = prop.keys.findIndex((key) => key.id === grabbed.id)
          if (index < 0) return prop
          // keys stay ordered, so a dragged key cannot cross its neighbours
          const lower = prop.keys[index - 1]?.t ?? 0
          const upper = prop.keys[index + 1]?.t ?? SPAN
          const keys = [...prop.keys]
          keys[index] = { ...keys[index]!, t: clamp(t, lower + 0.1, upper - 0.1) }
          return { ...prop, keys }
        }),
      )
    },
  })

  const keyAt = (prop: Prop, t: number) => prop.keys.find((key) => Math.abs(key.t - t) <= SNAP)

  /** Editing a value writes to the key under the playhead, or creates one. */
  const setValue = (propId: string, value: number) =>
    setProps((current) =>
      current.map((prop) => {
        if (prop.id !== propId) return prop
        const existing = keyAt(prop, playhead)
        if (existing) {
          return {
            ...prop,
            keys: prop.keys.map((key) => (key.id === existing.id ? { ...key, value } : key)),
          }
        }
        const inherited = [...prop.keys].reverse().find((key) => key.t < playhead)?.ease
        const keys = [...prop.keys, { id: nextId(), t: playhead, value, ease: inherited ?? EASE_IN_OUT }]
        keys.sort((a, b) => a.t - b.t)
        return { ...prop, keys }
      }),
    )

  const toggleKey = (propId: string, on: boolean) =>
    setProps((current) =>
      current.map((prop) => {
        if (prop.id !== propId) return prop
        const existing = keyAt(prop, playhead)
        if (on && !existing) {
          const inherited = [...prop.keys].reverse().find((key) => key.t < playhead)?.ease
          const keys = [
            ...prop.keys,
            { id: nextId(), t: playhead, value: valueAt(prop, playhead), ease: inherited ?? EASE_IN_OUT },
          ]
          keys.sort((a, b) => a.t - b.t)
          return { ...prop, keys }
        }
        // a property needs two keys to still be an animation
        if (!on && existing && prop.keys.length > 2) {
          return { ...prop, keys: prop.keys.filter((key) => key.id !== existing.id) }
        }
        return prop
      }),
    )

  const selection = useMemo(() => {
    for (const prop of props) {
      const index = prop.keys.findIndex((key) => key.id === selectedId)
      if (index >= 0) return { prop, index, key: prop.keys[index]! }
    }
    return null
  }, [props, selectedId])

  const hasNext = selection !== null && selection.index < selection.prop.keys.length - 1

  const setEase = (ease: BezierValue) =>
    setProps((current) =>
      current.map((prop) =>
        prop.id !== selection?.prop.id
          ? prop
          : { ...prop, keys: prop.keys.map((key) => (key.id === selectedId ? { ...key, ease } : key)) },
      ),
    )

  const deleteSelected = () => {
    if (!selection || selection.prop.keys.length <= 2) return
    setProps((current) =>
      current.map((prop) =>
        prop.id !== selection.prop.id
          ? prop
          : { ...prop, keys: prop.keys.filter((key) => key.id !== selectedId) },
      ),
    )
    setSelectedId(null)
  }

  const ticks = Array.from({ length: SPAN + 1 }, (_, i) => i)
  const grid = 'grid grid-cols-[76px_112px_minmax(0,1fr)] items-center gap-2.5'

  return (
    <div
      data-tw
      className="overflow-hidden rounded-xl border border-[#232323] bg-[#0d0d0d] font-ui text-[#ededed]"
    >
      <header className="flex h-10 items-center justify-between gap-2.5 border-b border-[#232323] px-3.5">
        <h3 className="text-[13px] font-medium">Keyframes</h3>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] tabular-nums text-[#8b8b8b]">{playhead.toFixed(2)}s</span>
          <button
            type="button"
            disabled={!selection || selection.prop.keys.length <= 2}
            onClick={deleteSelected}
            aria-label="Delete selected keyframe"
            className="grid size-[26px] place-items-center rounded text-[#8b8b8b] transition-colors hover:bg-[#1f1f1f] hover:text-[#ededed] disabled:opacity-35 disabled:hover:bg-transparent"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-1.5 p-3.5">
        {/* ruler: the shared time axis every lane and the playhead read from */}
        <div className={grid}>
          <span />
          <span />
          <div
            ref={axisRef}
            onPointerDown={scrub}
            className="relative h-5 cursor-ew-resize touch-none border-b border-[#232323]"
          >
            {ticks.map((second) => (
              <span key={second} className="absolute bottom-0 flex flex-col items-center" style={{ left: pct(second) }}>
                <span className="-translate-x-1/2 text-[9px] tabular-nums text-[#5c5c5c]">{second}s</span>
                <span className="h-1 w-px bg-[#333]" />
              </span>
            ))}
            <span className="pointer-events-none absolute -bottom-1 top-2 w-px bg-white" style={{ left: pct(playhead) }}>
              <span
                className="absolute -left-[6px] top-0 h-2.5 w-3 bg-white"
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)' }}
              />
            </span>
          </div>
        </div>

        {props.map((prop) => {
          const live = valueAt(prop, playhead)
          const onKey = keyAt(prop, playhead)
          return (
            <div key={prop.id} className={grid}>
              <span className="truncate text-xs text-[#8b8b8b]">{prop.label}</span>

              {/* a real field: typing or scrubbing writes the key under the
                  playhead, and the diamond adds or removes one */}
              <NumberField
                value={Math.round(live * 10) / 10}
                onChange={(value) => setValue(prop.id, value)}
                suffix={prop.suffix}
                min={prop.min}
                max={prop.max}
                step={prop.step}
                keyframe
                keyframed={onKey !== undefined}
                onKeyframedChange={(on) => toggleKey(prop.id, on)}
                aria-label={`${prop.label} at playhead`}
              />

              <div
                onPointerDown={scrub}
                className="relative h-11 cursor-ew-resize touch-none rounded bg-[#111] ring-1 ring-[#232323] ring-inset"
              >
                {/* the animation itself, not just its markers */}
                <svg
                  className="absolute inset-0 size-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <polyline
                    points={curvePath(prop)}
                    fill="none"
                    stroke="var(--cp-accent)"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                {prop.keys.map((key) => (
                  <button
                    key={key.id}
                    type="button"
                    style={{ left: pct(key.t) }}
                    aria-label={`${prop.label} keyframe at ${key.t.toFixed(2)}s`}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      setSelectedId(key.id)
                      setPlayhead(key.t)
                      dragging.current = { prop: prop.id, id: key.id }
                      dragKey(event)
                    }}
                    className={cn(
                      'absolute top-1/2 z-10 size-[11px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1.5px] transition-colors',
                      key.id === selectedId
                        ? 'scale-[1.15] bg-accent'
                        : 'bg-[#8b8b8b] hover:bg-[#ededed]',
                    )}
                  />
                ))}

                <span className="pointer-events-none absolute inset-y-0 w-px bg-white" style={{ left: pct(playhead) }} />
              </div>
            </div>
          )
        })}

        {/* easing for the selected key's outgoing segment */}
        <div className="mt-2 grid grid-cols-[190px_minmax(0,1fr)] items-center gap-3.5 border-t border-[#232323] pt-3.5">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="truncate text-[10.5px] font-semibold uppercase tracking-wider text-[#5c5c5c]">
              {selection ? `${selection.prop.label} · key ${selection.index + 1}` : 'No key selected'}
            </span>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((preset) => {
                const active =
                  selection !== null &&
                  preset.value.every((n, i) => Math.abs(n - selection.key.ease[i]!) < 0.005)
                return (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={!hasNext}
                    onClick={() => setEase(preset.value)}
                    className={cn(
                      'h-6 rounded border px-2 text-[11px] transition-colors disabled:opacity-35',
                      active
                        ? 'border-accent bg-accent/15 text-[#ededed]'
                        : 'border-[#232323] bg-[#1f1f1f] text-[#8b8b8b] hover:enabled:text-[#ededed]',
                    )}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
            <p className="m-0 text-[11px] leading-snug text-[#5c5c5c]">
              {hasNext ? 'Shapes the run into the next key.' : 'The last key has nothing to ease into.'}
            </p>
          </div>

          <BezierEditor
            value={selection?.key.ease ?? EASE_IN_OUT}
            onChange={setEase}
            height={128}
            disabled={!hasNext}
          />
        </div>
      </div>
    </div>
  )
}
