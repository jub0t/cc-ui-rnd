import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Knob, LevelMeter, clamp, cx, useElementSize, usePointerDrag } from '../../primitives'
import styles from './lab.module.css'

const MIN_DB = -60
const MAX_DB = 12
const SCALE_TICKS = [12, 6, 0, -6, -12, -24, -48]

/*
 * Console taper: a linear fader wastes half its travel on levels nobody mixes
 * at. The exponent pushes 0 dB up to ~90% of the throw, where your hand
 * naturally sits.
 */
const TAPER = 0.55
const dbToFraction = (db: number) => Math.pow(clamp((db - MIN_DB) / (MAX_DB - MIN_DB), 0, 1), TAPER)
const fractionToDb = (f: number) => Math.pow(clamp(f, 0, 1), 1 / TAPER) * (MAX_DB - MIN_DB) + MIN_DB

const formatDb = (db: number) => (db <= MIN_DB ? '-∞' : `${db > 0 ? '+' : ''}${db.toFixed(1)}`)

function Fader({ db, onChange }: { db: number; onChange: (db: number) => void }) {
  const [ref, size] = useElementSize<HTMLDivElement>()

  const apply = (clientY: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || rect.height === 0) return
    const travel = rect.height - 12
    const fraction = clamp((rect.bottom - 6 - clientY) / travel, 0, 1)
    onChange(Math.round(fractionToDb(fraction) * 10) / 10)
  }

  const begin = usePointerDrag({
    threshold: 0,
    cursor: 'ns-resize',
    onStart: ({ y }) => apply(y),
    onMove: ({ y }) => apply(y),
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.shiftKey ? 3 : 0.5
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      onChange(clamp(Math.round((db + delta) * 10) / 10, MIN_DB, MAX_DB))
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      onChange(clamp(Math.round((db - delta) * 10) / 10, MIN_DB, MAX_DB))
    }
  }

  const fraction = dbToFraction(db)
  const travel = (size.height || 168) - 12
  const capBottom = 6 + fraction * travel

  return (
    <div
      ref={ref}
      className={styles.fader}
      role="slider"
      tabIndex={0}
      aria-label="Fader"
      aria-valuenow={db}
      aria-valuemin={MIN_DB}
      aria-valuemax={MAX_DB}
      aria-valuetext={`${formatDb(db)} dB`}
      onPointerDown={begin}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onChange(0)}
    >
      <span className={styles.faderSlot}>
        <span className={styles.faderFill} style={{ height: `${fraction * 100}%` }} />
      </span>
      <span className={styles.faderCap} style={{ bottom: capBottom }} />
    </div>
  )
}

interface Channel {
  id: string
  name: string
  db: number
  pan: number
  muted: boolean
  soloed: boolean
  /** drives the simulated meter so each strip behaves differently */
  energy: number
}

const CHANNELS: Channel[] = [
  { id: 'dlg', name: 'Dialogue', db: 0, pan: 0.5, muted: false, soloed: false, energy: 0.62 },
  { id: 'mus', name: 'Music', db: -8.5, pan: 0.5, muted: false, soloed: false, energy: 0.44 },
  { id: 'mst', name: 'Master', db: -2, pan: 0.5, muted: false, soloed: false, energy: 0.7 },
]

export function MixerStrip() {
  const [channels, setChannels] = useState(CHANNELS)
  const [levels, setLevels] = useState<Record<string, [number, number]>>({})
  const frame = useRef(0)

  // One loop drives every meter, with fast attack and slow release.
  useEffect(() => {
    const state: Record<string, [number, number]> = {}
    const tick = (now: number) => {
      const next: Record<string, [number, number]> = {}
      for (const channel of channels) {
        const gain = channel.muted ? 0 : dbToFraction(channel.db)
        const drive = channel.energy * gain
        const pair = state[channel.id] ?? [0, 0]
        const shaped: [number, number] = [0, 0]
        for (let side = 0; side < 2; side += 1) {
          const target =
            drive * (0.55 + Math.abs(Math.sin(now / (330 + side * 90 + channel.energy * 400))) * 0.5)
          const current = pair[side] ?? 0
          shaped[side] = target > current ? target : current + (target - current) * 0.1
        }
        state[channel.id] = shaped
        next[channel.id] = shaped
      }
      setLevels(next)
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [channels])

  const update = (id: string, patch: Partial<Channel>) =>
    setChannels((current) =>
      current.map((channel) => (channel.id === id ? { ...channel, ...patch } : channel)),
    )

  return (
    <div className={styles.card}>
      <header className={styles.cardHead}>
        <h3 className={styles.cardTitle}>Mixer</h3>
        <span className={styles.cardNote}>double-click a fader for 0 dB</span>
      </header>

      <div className={styles.strips}>
        {channels.map((channel) => {
          const [left = 0, right = 0] = levels[channel.id] ?? []
          return (
            <div key={channel.id} className={styles.strip}>
              <span className={styles.stripName}>{channel.name}</span>

              <Knob
                value={channel.pan}
                onChange={(pan) => update(channel.id, { pan })}
                defaultValue={0.5}
                size={38}
                aria-label={`${channel.name} pan`}
              />
              <span className={styles.stripSub}>
                {channel.pan === 0.5
                  ? 'C'
                  : `${channel.pan < 0.5 ? 'L' : 'R'}${Math.round(Math.abs(channel.pan - 0.5) * 200)}`}
              </span>

              <div className={styles.faderRow}>
                <div className={styles.scale}>
                  {SCALE_TICKS.map((db) => (
                    <span
                      key={db}
                      className={styles.scaleTick}
                      style={{ bottom: `${dbToFraction(db) * 100}%` }}
                    >
                      {db > 0 ? `+${db}` : db}
                    </span>
                  ))}
                </div>

                <Fader db={channel.db} onChange={(db) => update(channel.id, { db })} />

                <div className={styles.meters}>
                  <LevelMeter
                    value={left}
                    orientation="vertical"
                    thickness={5}
                    aria-label={`${channel.name} left`}
                  />
                  <LevelMeter
                    value={right}
                    orientation="vertical"
                    thickness={5}
                    aria-label={`${channel.name} right`}
                  />
                </div>
              </div>

              <span className={styles.stripValue}>{formatDb(channel.db)} dB</span>

              <div className={styles.stripButtons}>
                <button
                  type="button"
                  className={cx(styles.stripButton, channel.muted && styles.stripButtonMute)}
                  aria-pressed={channel.muted}
                  aria-label={`Mute ${channel.name}`}
                  onClick={() => update(channel.id, { muted: !channel.muted })}
                >
                  M
                </button>
                <button
                  type="button"
                  className={cx(styles.stripButton, channel.soloed && styles.stripButtonSolo)}
                  aria-pressed={channel.soloed}
                  aria-label={`Solo ${channel.name}`}
                  onClick={() => update(channel.id, { soloed: !channel.soloed })}
                >
                  S
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
