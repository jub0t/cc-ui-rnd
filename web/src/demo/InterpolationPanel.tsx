// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useEffect, useState } from 'react'
import {
  BezierEditor,
  NumberField,
  Panel,
  Row,
  Section,
  SegmentedControl,
  Select,
  Stepper,
  useElementSize,
} from '../primitives'
import type { BezierValue } from '../primitives'
import { AlignToolbar, EditorHeader } from './EditorChrome'
import styles from './panels.module.css'

type Mode = 'hold' | 'ease' | 'spring'

const MODES = [
  { value: 'hold', label: 'Hold' },
  { value: 'ease', label: 'Ease' },
  { value: 'spring', label: 'Spring' },
] as const

const EASE_PRESETS: Array<{ value: string; label: string; curve: BezierValue }> = [
  { value: 'linear', label: 'Linear', curve: [0, 0, 1, 1] },
  { value: 'in', label: 'Ease In', curve: [0.42, 0, 1, 1] },
  { value: 'out', label: 'Ease Out', curve: [0, 0, 0.58, 1] },
  { value: 'in-out', label: 'Ease In & Out', curve: [0.42, 0, 0.58, 1] },
  { value: 'back', label: 'Back Out', curve: [0.34, 1.26, 0.64, 1] },
  { value: 'custom', label: 'Custom', curve: [0.42, 0, 0.58, 1] },
]

const same = (a: BezierValue, b: BezierValue) => a.every((n, i) => Math.abs(n - b[i]!) < 0.005)
const formatCurve = (curve: BezierValue) =>
  curve.map((n) => n.toFixed(2).replace(/^0\./, '.').replace(/^-0\./, '-.')).join(', ')

/** Runs a dot across the row using the live curve as its timing function. */
function EasePreview({ curve, enabled }: { curve: BezierValue; enabled: boolean }) {
  const [track, size] = useElementSize<HTMLDivElement>()
  const [at, setAt] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setAt((current) => !current), 1500)
    return () => window.clearInterval(id)
  }, [enabled])

  const travel = Math.max(size.width - 10, 0)
  const timing = enabled ? `cubic-bezier(${curve.join(', ')})` : 'linear'

  return (
    <div ref={track} className={styles.previewTrack}>
      <span
        className={styles.previewDot}
        style={{
          transform: `translateX(${at ? travel : 0}px)`,
          transitionTimingFunction: timing,
        }}
      />
    </div>
  )
}

export function InterpolationPanel() {
  const [mode, setMode] = useState<Mode>('ease')
  const [curve, setCurve] = useState<BezierValue>([0.42, 0, 0.58, 1])
  const [text, setText] = useState<string | null>(null)
  const [stiffness, setStiffness] = useState(180)
  const [damping, setDamping] = useState(22)

  const preset = EASE_PRESETS.find((p) => p.curve && same(p.curve, curve) && p.value !== 'custom')
  const presetValue = preset?.value ?? 'custom'

  const commitText = (raw: string) => {
    const parts = raw.split(',').map((part) => Number.parseFloat(part.trim()))
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      setCurve([parts[0]!, parts[1]!, parts[2]!, parts[3]!])
    }
    setText(null)
  }

  return (
    <Panel>
      <EditorHeader />
      <AlignToolbar />

      <Section title="Interpolation">
        <Row>
          <SegmentedControl
            options={MODES}
            value={mode}
            onChange={setMode}
            aria-label="Interpolation mode"
          />
        </Row>

        {mode === 'hold' && (
          <Row>
            <p className={styles.note}>
              The value snaps at the keyframe and holds until the next one.
            </p>
          </Row>
        )}

        {mode === 'ease' && (
          <>
            <Row>
              <BezierEditor value={curve} onChange={setCurve} />
            </Row>
            <Row label="Ease">
              <Select
                options={EASE_PRESETS.map(({ value, label }) => ({ value, label }))}
                value={presetValue}
                onChange={(next) => {
                  const chosen = EASE_PRESETS.find((p) => p.value === next)
                  if (chosen && next !== 'custom') setCurve(chosen.curve)
                }}
                aria-label="Ease preset"
              />
            </Row>
            <Row label="Bezier">
              <input
                className={styles.textField}
                value={text ?? formatCurve(curve)}
                spellCheck={false}
                aria-label="Bezier control points"
                onChange={(event) => setText(event.target.value)}
                onBlur={(event) => commitText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') {
                    setText(null)
                    event.currentTarget.blur()
                  }
                }}
              />
            </Row>
          </>
        )}

        {mode === 'spring' && (
          <>
            <Row label="Stiffness">
              <NumberField value={stiffness} onChange={setStiffness} min={1} max={1000} aria-label="Stiffness" />
              <Stepper
                aria-label="Stiffness"
                onStep={(direction) => setStiffness((current) => Math.max(1, current + direction * 10))}
              />
            </Row>
            <Row label="Damping">
              <NumberField value={damping} onChange={setDamping} min={1} max={100} aria-label="Damping" />
              <Stepper
                aria-label="Damping"
                onStep={(direction) => setDamping((current) => Math.max(1, current + direction))}
              />
            </Row>
          </>
        )}

        <Row label="Preview">
          <EasePreview curve={curve} enabled={mode === 'ease'} />
        </Row>
      </Section>
    </Panel>
  )
}
