import { useEffect, useState } from 'react'
import {
  CloseIcon,
  IconButton,
  Knob,
  LevelMeter,
  NumberField,
  Panel,
  PlusIcon,
  Row,
  Section,
  SparkleIcon,
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
  const of = (kind: Effect['kind']) => effects.filter((e) => e.kind === kind)

  const addButton = (kind: Effect['kind']) => (
    <IconButton label="Add effect" onClick={() => add(kind)}>
      <PlusIcon />
    </IconButton>
  )

  return (
    <Panel>
      <Section title="Effects" actions={addButton('video')}>
        {of('video').map((effect) => (
          <Row key={effect.id} label="FX">
            <EffectChip effect={effect} onRemove={() => remove(effect.id)} />
          </Row>
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
          <LevelMeter value={level} peak={peak} aria-label="Output level" />
        </Row>
      </Section>

      <Section title="Audio effects" actions={addButton('audio')}>
        {of('audio').map((effect) => (
          <Row key={effect.id} label="FX">
            <EffectChip effect={effect} onRemove={() => remove(effect.id)} />
          </Row>
        ))}
      </Section>
    </Panel>
  )
}
