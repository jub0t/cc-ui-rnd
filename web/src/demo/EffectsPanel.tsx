// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useEffect, useRef, useState } from 'react'
import {
  CloseIcon,
  GripIcon,
  IconButton,
  Knob,
  LevelMeter,
  NumberField,
  Panel,
  PlusIcon,
  Row,
  Section,
  SparkleIcon,
  Tooltip,
  usePointerDrag,
} from '../primitives'
import styles from './panels.module.css'

interface Effect {
  id: number
  name: string
  kind: 'video' | 'audio'
}

const INITIAL: Effect[] = [
  { id: 1, name: 'Lumetri Color', kind: 'video' },
  { id: 2, name: 'Motion Blur', kind: 'video' },
  { id: 3, name: 'Glow', kind: 'video' },
  { id: 4, name: 'EQ', kind: 'audio' },
  { id: 5, name: 'Denoiser', kind: 'audio' },
]

const POOL = ['Sharpen', 'Vignette', 'Chroma Key', 'Reverb', 'Compressor', 'De-esser']

/** Row height plus the section's gap — the distance one drag step covers. */
const ROW_PITCH = 34

/**
 * An FX row, with the handle that reorders it. The chain runs top to bottom,
 * so the order is a real setting rather than a filing preference, which is why
 * it is worth being able to change without deleting and re-adding.
 *
 * Dragging is measured against the index the gesture *started* on, not the
 * current one — the list reorders live underneath the pointer, and reading the
 * moving index would make every step compound.
 */
function FxRow({
  effect,
  index,
  count,
  onMoveTo,
  onRemove,
}: {
  effect: Effect
  index: number
  count: number
  onMoveTo: (id: number, target: number) => void
  onRemove: () => void
}) {
  const origin = useRef(index)
  const [dragging, setDragging] = useState(false)

  const beginDrag = usePointerDrag({
    cursor: 'grabbing',
    onStart: () => {
      origin.current = index
      setDragging(true)
    },
    onMove: ({ dy, moved }) => {
      if (!moved) return
      onMoveTo(effect.id, origin.current + Math.round(dy / ROW_PITCH))
    },
    onEnd: () => setDragging(false),
  })

  return (
    <Row
      label="FX"
      className={dragging ? styles.rowDragging : undefined}
      lead={
        <Tooltip label="Drag to reorder, or use the arrow keys">
          <button
            type="button"
            className={styles.grip}
            aria-label={`Reorder ${effect.name} — ${index + 1} of ${count}`}
            onPointerDown={beginDrag}
            onKeyDown={(event) => {
              const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
              if (step === 0) return
              event.preventDefault()
              onMoveTo(effect.id, index + step)
            }}
          >
            <GripIcon size={13} />
          </button>
        </Tooltip>
      }
    >
      <EffectChip effect={effect} onRemove={onRemove} />
    </Row>
  )
}

function EffectChip({ effect, onRemove }: { effect: Effect; onRemove: () => void }) {
  return (
    <div className={styles.chipField}>
      <span className={effect.kind === 'audio' ? styles.chipBadgeAudio : styles.chipBadge}>
        <SparkleIcon size={11} />
      </span>
      <span className={styles.chipLabel}>{effect.name}</span>
      <IconButton label={`Remove ${effect.name}`} className={styles.chipRemove} onClick={onRemove}>
        <CloseIcon size={12} />
      </IconButton>
    </div>
  )
}

/** Simulated programme level so the meter has something to show. */
function useSimulatedLevel(muted: boolean) {
  const [level, setLevel] = useState(0)
  const [peak, setPeak] = useState(0)

  useEffect(() => {
    if (muted) {
      setLevel(0)
      setPeak(0)
      return
    }
    let raf = 0
    let current = 0
    let held = 0
    let heldUntil = 0
    const tick = (now: number) => {
      const target = 0.45 + Math.sin(now / 420) * 0.2 + Math.random() * 0.25
      // fast attack, slow release, the way a real programme meter behaves
      current = target > current ? target : current + (target - current) * 0.08
      if (current > held || now > heldUntil) {
        held = current
        heldUntil = now + 900
      }
      setLevel(current)
      setPeak(held)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [muted])

  return { level, peak }
}

export function EffectsPanel() {
  const [effects, setEffects] = useState(INITIAL)
  const [volume, setVolume] = useState(3)
  const [trim, setTrim] = useState(0.62)
  const [volumeKeyed, setVolumeKeyed] = useState(true)
  const [muted, setMuted] = useState(false)
  const [soloed, setSoloed] = useState(false)
  const { level, peak } = useSimulatedLevel(muted)

  const add = (kind: Effect['kind']) =>
    setEffects((current) => [
      ...current,
      { id: Date.now(), name: POOL[current.length % POOL.length] ?? 'Effect', kind },
    ])

  const remove = (id: number) => setEffects((current) => current.filter((e) => e.id !== id))

  /** Reorder within the kind, leaving the other kind's slots where they are. */
  const moveTo = (id: number, target: number) =>
    setEffects((current) => {
      const moving = current.find((e) => e.id === id)
      if (!moving) return current
      const group = current.filter((e) => e.kind === moving.kind)
      const from = group.findIndex((e) => e.id === id)
      const to = Math.max(0, Math.min(group.length - 1, target))
      if (from < 0 || to === from) return current

      const reordered = [...group]
      const [pulled] = reordered.splice(from, 1)
      if (pulled) reordered.splice(to, 0, pulled)

      let cursor = 0
      return current.map((e) => (e.kind === moving.kind ? reordered[cursor++]! : e))
    })
  const of = (kind: Effect['kind']) => effects.filter((e) => e.kind === kind)

  const addButton = (kind: Effect['kind']) => (
    <IconButton label="Add effect" onClick={() => add(kind)}>
      <PlusIcon />
    </IconButton>
  )

  return (
    <Panel>
      <Section title="Effects" actions={addButton('video')}>
        {of('video').map((effect, index, all) => (
          <FxRow
            key={effect.id}
            effect={effect}
            index={index}
            count={all.length}
            onMoveTo={moveTo}
            onRemove={() => remove(effect.id)}
          />
        ))}
      </Section>

      <Section title="Animation" actions={addButton('video')} />
      <Section title="Transition" actions={addButton('video')} />
      <Section title="Mask" actions={addButton('video')} />

      <Section title="Audio">
        <Row label="Volume" className={styles.volumeRow}>
          <div className={styles.volumeStack}>
            <NumberField
              value={volume}
              onChange={setVolume}
              min={-60}
              max={12}
              aria-label="Volume"
              format={(v) => `${v > 0 ? '+' : ''}${v} dB`}
              parse={(text) => Number.parseFloat(text)}
              keyframe
              keyframed={volumeKeyed}
              onKeyframedChange={setVolumeKeyed}
            />
            <div className={styles.msGroup}>
              <IconButton label="Mute" wide active={muted} onClick={() => setMuted((m) => !m)}>
                M
              </IconButton>
              <IconButton label="Solo" wide active={soloed} onClick={() => setSoloed((s) => !s)}>
                S
              </IconButton>
            </div>
          </div>
          <div className={styles.knobWell}>
            <Knob value={trim} onChange={setTrim} defaultValue={0.5} aria-label="Input trim" />
          </div>
        </Row>
        <Row>
          <LevelMeter value={level} peak={peak} thickness={9} aria-label="Output level" />
        </Row>
      </Section>

      <Section title="Audio effects" actions={addButton('audio')}>
        {of('audio').map((effect, index, all) => (
          <FxRow
            key={effect.id}
            effect={effect}
            index={index}
            count={all.length}
            onMoveTo={moveTo}
            onRemove={() => remove(effect.id)}
          />
        ))}
      </Section>
    </Panel>
  )
}
