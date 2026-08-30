import { useMemo, useRef, useState } from 'react'
import {
  BezierEditor,
  NumberField,
  clamp,
  cx,
  useElementSize,
  usePointerDrag,
} from '../../primitives'
import type { BezierValue } from '../../primitives'
import styles from './lab.module.css'

const SPAN = 6 // seconds across the lane

interface Key {
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
  keys: Key[]
}

const EASE_OUT: BezierValue = [0.16, 0.84, 0.44, 1]
const EASE_IN_OUT: BezierValue = [0.42, 0, 0.58, 1]
const LINEAR: BezierValue = [0.25, 0.25, 0.75, 0.75]

const INITIAL: Prop[] = [
  {
    id: 'x',
    label: 'Position X',
    min: -1920,
    max: 1920,
    keys: [
      { t: 0.4, value: -420, ease: EASE_OUT },
      { t: 3.1, value: 260, ease: EASE_IN_OUT },
      { t: 5.4, value: 0, ease: LINEAR },
    ],
  },
  {
    id: 'scale',
    label: 'Scale',
    suffix: '%',
    min: 0,
    max: 400,
    keys: [
      { t: 0.4, value: 100, ease: EASE_IN_OUT },
      { t: 2.2, value: 148, ease: EASE_OUT },
      { t: 5.4, value: 112, ease: LINEAR },
    ],
  },
  {
    id: 'opacity',
    label: 'Opacity',
    suffix: '%',
    min: 0,
    max: 100,
    keys: [
      { t: 0.9, value: 0, ease: EASE_OUT },
      { t: 2.0, value: 100, ease: LINEAR },
      { t: 4.6, value: 100, ease: EASE_IN_OUT },
      { t: 5.8, value: 0, ease: LINEAR },
    ],
  },
]

/** Cubic-bezier solver: given x (0..1 of the segment), return eased y. */
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
  const first = keys[0]!
  const last = keys[keys.length - 1]!
  if (t <= first.t) return first.value
  if (t >= last.t) return last.value

  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i]!
    const b = keys[i + 1]!
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1
      const progress = easing(a.ease)((t - a.t) / span)
      return a.value + (b.value - a.value) * progress
    }
  }
  return last.value
}

/**
 * A keyframe track wired to a curve editor. Dragging the playhead evaluates
 * every property through its own easing, so the number fields are the real
 * interpolated values — not labels that happen to sit near a diamond.
 */
export function KeyframeTrack() {
  const [props, setProps] = useState(INITIAL)
  const [playhead, setPlayhead] = useState(2.4)
  const [selected, setSelected] = useState<{ prop: string; index: number }>({
    prop: 'scale',
    index: 0,
  })
  const [laneRef, laneSize] = useElementSize<HTMLDivElement>()
  const dragging = useRef<{ prop: string; index: number } | null>(null)

  const width = laneSize.width || 480
  const toPx = (t: number) => (t / SPAN) * width
  const toTime = (px: number) => clamp((px / width) * SPAN, 0, SPAN)

  const scrub = usePointerDrag({
    threshold: 0,
    onStart: ({ x }) => moveHead(x),
    onMove: ({ x }) => moveHead(x),
  })

  function moveHead(clientX: number) {
    const rect = laneRef.current?.getBoundingClientRect()
    if (rect) setPlayhead(toTime(clientX - rect.left))
  }

  const dragKey = usePointerDrag({
    threshold: 0,
    onMove: ({ x }) => {
      const grabbed = dragging.current
      const rect = laneRef.current?.getBoundingClientRect()
      if (!grabbed || !rect) return
      const t = toTime(x - rect.left)
      setProps((current) =>
        current.map((prop) => {
          if (prop.id !== grabbed.prop) return prop
          const keys = prop.keys.map((key, i) => (i === grabbed.index ? { ...key, t } : key))
          // keys stay ordered, so a dragged key cannot cross its neighbours
          const lower = keys[grabbed.index - 1]?.t ?? 0
          const upper = keys[grabbed.index + 1]?.t ?? SPAN
          keys[grabbed.index] = {
            ...keys[grabbed.index]!,
            t: clamp(t, lower + 0.08, upper - 0.08),
          }
          return { ...prop, keys }
        }),
      )
    },
  })

  const activeProp = props.find((prop) => prop.id === selected.prop) ?? props[0]!
  const activeKey = activeProp.keys[selected.index] ?? activeProp.keys[0]!
  const hasNext = selected.index < activeProp.keys.length - 1

  const setEase = (ease: BezierValue) =>
    setProps((current) =>
      current.map((prop) =>
        prop.id !== activeProp.id
          ? prop
          : {
              ...prop,
              keys: prop.keys.map((key, i) => (i === selected.index ? { ...key, ease } : key)),
            },
      ),
    )

  const liveValues = useMemo(
    () => Object.fromEntries(props.map((prop) => [prop.id, valueAt(prop, playhead)])),
    [props, playhead],
  )

  return (
    <div className={styles.card}>
      <header className={styles.cardHead}>
        <h3 className={styles.cardTitle}>Keyframes</h3>
        <span className={styles.cardNote}>{playhead.toFixed(2)}s</span>
      </header>

      <div className={styles.cardBody}>
        <div className={styles.kfRows}>
          <div className={styles.kfRow}>
            <span />
            <span />
            <div className={styles.kfScrub} onPointerDown={scrub}>
              <span className={styles.kfPlayhead} style={{ left: toPx(playhead), top: 4 }}>
                <span className={styles.playheadCap} />
              </span>
            </div>
          </div>

          {props.map((prop, rowIndex) => (
            <div key={prop.id} className={styles.kfRow}>
              <span className={styles.kfLabel}>{prop.label}</span>
              <NumberField
                value={Math.round((liveValues[prop.id] ?? 0) * 10) / 10}
                onChange={() => {}}
                suffix={prop.suffix}
                min={prop.min}
                max={prop.max}
                aria-label={`${prop.label} at playhead`}
              />
              <div
                ref={rowIndex === 0 ? laneRef : undefined}
                className={styles.kfLane}
                onPointerDown={scrub}
              >
                {prop.keys.slice(0, -1).map((key, i) => {
                  const next = prop.keys[i + 1]!
                  const isActive = selected.prop === prop.id && selected.index === i
                  return (
                    <span
                      key={`span-${i}`}
                      className={cx(styles.kfSpan, isActive && styles.kfSpanActive)}
                      style={{ left: toPx(key.t), width: toPx(next.t) - toPx(key.t) }}
                    />
                  )
                })}

                {prop.keys.map((key, i) => (
                  <button
                    key={i}
                    type="button"
                    className={cx(
                      styles.kfKey,
                      selected.prop === prop.id && selected.index === i && styles.kfKeyOn,
                    )}
                    style={{ left: toPx(key.t) }}
                    aria-label={`${prop.label} keyframe at ${key.t.toFixed(2)}s`}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      setSelected({ prop: prop.id, index: i })
                      dragging.current = { prop: prop.id, index: i }
                      dragKey(event)
                    }}
                  />
                ))}

                <span className={styles.kfPlayhead} style={{ left: toPx(playhead) }} />
              </div>
            </div>
          ))}
        </div>

        <div className={styles.easePane}>
          <div className={styles.easeMeta}>
            <span className={styles.readoutKey}>
              {activeProp.label} · key {selected.index + 1}
            </span>
            <p className={styles.easeHint}>
              {hasNext
                ? 'Drag the handles to reshape how this key eases into the next one. The value fields follow the curve as you scrub.'
                : 'The last key has nothing to ease into. Select an earlier one to edit its curve.'}
            </p>
          </div>
          <BezierEditor
            value={activeKey.ease}
            onChange={setEase}
            height={132}
            disabled={!hasNext}
          />
        </div>
      </div>
    </div>
  )
}
