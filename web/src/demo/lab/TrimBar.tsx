// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useMemo, useRef, useState } from 'react'
import { clamp, cx, useElementSize, usePointerDrag } from '../../primitives'
import { seeded, timecode } from '../editor/format'
import styles from './lab.module.css'

const CLIP_SECONDS = 42.5

/** Ruler steps chosen so labels never crowd at the current pixel density. */
function tickStep(pxPerSecond: number) {
  for (const step of [1, 2, 5, 10, 15, 30, 60]) {
    if (step * pxPerSecond >= 64) return step
  }
  return 60
}

/**
 * In/out trimmer. Combines a generated waveform, a ruler, two drag handles and
 * a playhead over one shared time axis — every element reads the same
 * seconds-to-pixels mapping, so they can never drift apart.
 */
export function TrimBar() {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const [inPoint, setIn] = useState(6.2)
  const [outPoint, setOut] = useState(31.4)
  const [playhead, setPlayhead] = useState(14.8)
  const grabbing = useRef<'in' | 'out' | 'playhead'>('playhead')

  const width = size.width || 640
  const toPx = (seconds: number) => (seconds / CLIP_SECONDS) * width
  const toSeconds = (px: number) => clamp((px / width) * CLIP_SECONDS, 0, CLIP_SECONDS)

  const bars = useMemo(() => {
    const random = seeded(7)
    return Array.from({ length: 200 }, (_, i) => {
      const envelope = 0.35 + Math.sin((i / 199) * Math.PI * 3.1) * 0.28
      return clamp(Math.abs(envelope) + random() * 0.5, 0.06, 1)
    })
  }, [])

  const begin = usePointerDrag({
    threshold: 0,
    onStart: ({ x }) => apply(x),
    onMove: ({ x }) => apply(x),
  })

  function apply(clientX: number) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const seconds = toSeconds(clientX - rect.left)
    if (grabbing.current === 'in') setIn(clamp(seconds, 0, outPoint - 0.4))
    else if (grabbing.current === 'out') setOut(clamp(seconds, inPoint + 0.4, CLIP_SECONDS))
    else setPlayhead(clamp(seconds, inPoint, outPoint))
  }

  const step = tickStep(width / CLIP_SECONDS)
  const ticks = Array.from({ length: Math.floor(CLIP_SECONDS / step) + 1 }, (_, i) => i * step)

  return (
    <div className={cx(styles.card, styles.wide)}>
      <header className={styles.cardHead}>
        <h3 className={styles.cardTitle}>Trim · C0211.MP4</h3>
        <span className={styles.cardNote}>drag the handles or scrub the body</span>
      </header>

      <div className={styles.cardBody}>
        <div className={styles.ruler}>
          {ticks.map((second) => (
            <span key={second}>
              <span className={cx(styles.tick, styles.tickMajor)} style={{ left: toPx(second) }} />
              <span className={styles.tickLabel} style={{ left: toPx(second) }}>
                {timecode(second)}
              </span>
            </span>
          ))}
        </div>

        <div
          ref={ref}
          className={styles.trim}
          onPointerDown={(event) => {
            grabbing.current = 'playhead'
            begin(event)
          }}
        >
          <svg className={styles.wave} viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden>
            {bars.map((height, index) => (
              <rect
                key={index}
                x={index}
                y={50 - height * 46}
                width={0.62}
                height={height * 92}
                fill="#4a4a55"
              />
            ))}
          </svg>

          <span className={styles.trimMask} style={{ left: 0, width: toPx(inPoint) }} />
          <span
            className={styles.trimMask}
            style={{ left: toPx(outPoint), right: 0, width: 'auto' }}
          />

          <span
            className={cx(styles.handle, styles.handleIn)}
            style={{ left: toPx(inPoint) }}
            role="slider"
            aria-label="In point"
            aria-valuenow={Math.round(inPoint * 10) / 10}
            aria-valuemin={0}
            aria-valuemax={outPoint}
            tabIndex={0}
            onPointerDown={(event) => {
              event.stopPropagation()
              grabbing.current = 'in'
              begin(event)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') setIn((v) => clamp(v - 0.2, 0, outPoint - 0.4))
              if (event.key === 'ArrowRight') setIn((v) => clamp(v + 0.2, 0, outPoint - 0.4))
            }}
          />
          <span
            className={cx(styles.handle, styles.handleOut)}
            style={{ left: toPx(outPoint) }}
            role="slider"
            aria-label="Out point"
            aria-valuenow={Math.round(outPoint * 10) / 10}
            aria-valuemin={inPoint}
            aria-valuemax={CLIP_SECONDS}
            tabIndex={0}
            onPointerDown={(event) => {
              event.stopPropagation()
              grabbing.current = 'out'
              begin(event)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') setOut((v) => clamp(v - 0.2, inPoint + 0.4, CLIP_SECONDS))
              if (event.key === 'ArrowRight') setOut((v) => clamp(v + 0.2, inPoint + 0.4, CLIP_SECONDS))
            }}
          />

          <span className={styles.playhead} style={{ left: toPx(playhead) }}>
            <span className={styles.playheadCap} />
          </span>
        </div>

        <div className={styles.readouts}>
          <span className={styles.readout}>
            <span className={styles.readoutKey}>In</span>
            <span className={styles.readoutValue}>{timecode(inPoint)}</span>
          </span>
          <span className={styles.readout}>
            <span className={styles.readoutKey}>Out</span>
            <span className={styles.readoutValue}>{timecode(outPoint)}</span>
          </span>
          <span className={styles.readout}>
            <span className={styles.readoutKey}>Duration</span>
            <span className={styles.readoutValue}>{timecode(outPoint - inPoint)}</span>
          </span>
          <span className={styles.readout}>
            <span className={styles.readoutKey}>Playhead</span>
            <span className={styles.readoutValue}>{timecode(playhead)}</span>
          </span>
          <span className={styles.readout}>
            <span className={styles.readoutKey}>Trimmed</span>
            <span className={styles.readoutValue}>
              {timecode(CLIP_SECONDS - (outPoint - inPoint))}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
