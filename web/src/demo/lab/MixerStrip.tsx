// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { NumberField, clamp, useElementSize, usePointerDrag } from '../../primitives'
import { cn } from '../editor/ui'

/*
 * One dB axis for the whole strip.
 *
 * +12 at the top down to -42 at the floor, in nine even 6 dB steps, with the
 * bottom stop reading as -infinity. The fader, the meter fill, the colour
 * bands and the printed scale all derive their geometry from `dbToFraction`,
 * so a tick label always lines up with the level it names.
 */
const TOP_DB = 12
const FLOOR_DB = -42
const SCALE = [12, 6, 0, -6, -12, -18, -24, -30, -36]

const dbToFraction = (db: number) => clamp((db - FLOOR_DB) / (TOP_DB - FLOOR_DB), 0, 1)
const fractionToDb = (fraction: number) => clamp(fraction, 0, 1) * (TOP_DB - FLOOR_DB) + FLOOR_DB

const formatDb = (db: number) => {
  if (db <= FLOOR_DB) return '-∞ dB'
  const rounded = Math.round(db * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${rounded > 0 ? '+' : ''}${text} dB`
}

/* Colour bands pinned to real levels: amber from -6, red from 0. */
const AMBER_AT = dbToFraction(-6) * 100
const RED_AT = dbToFraction(0) * 100
const METER_RAMP = `linear-gradient(to top,
  #21c452 0%, #21c452 ${AMBER_AT}%,
  #e8c020 ${AMBER_AT}%, #e8c020 ${RED_AT}%,
  #e0442f ${RED_AT}%, #e0442f 100%)`

function Meter({ db }: { db: number }) {
  return (
    <span className="relative h-full w-[6px] overflow-hidden rounded-[1px] bg-[#0a0a0a] ring-1 ring-[#232323] ring-inset">
      <span
        className="absolute inset-x-0 bottom-0 w-full"
        style={{ height: '100%', background: METER_RAMP, clipPath: `inset(${(1 - dbToFraction(db)) * 100}% 0 0 0)` }}
      />
    </span>
  )
}

function Fader({ db, onChange }: { db: number; onChange: (db: number) => void }) {
  const [ref, size] = useElementSize<HTMLDivElement>()

  const apply = (clientY: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || rect.height === 0) return
    const travel = rect.height - 8
    onChange(Math.round(fractionToDb((rect.bottom - 4 - clientY) / travel) * 10) / 10)
  }

  const begin = usePointerDrag({
    threshold: 0,
    cursor: 'ns-resize',
    onStart: ({ y }) => apply(y),
    onMove: ({ y }) => apply(y),
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.shiftKey ? 6 : 1
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      onChange(clamp(db + delta, FLOOR_DB, TOP_DB))
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      onChange(clamp(db - delta, FLOOR_DB, TOP_DB))
    }
  }

  const travel = (size.height || 190) - 8
  const capBottom = 4 + dbToFraction(db) * travel

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Fader"
      aria-valuenow={db}
      aria-valuemin={FLOOR_DB}
      aria-valuemax={TOP_DB}
      aria-valuetext={formatDb(db)}
      onPointerDown={begin}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onChange(0)}
      className="group relative h-full w-[18px] flex-none cursor-ns-resize touch-none"
    >
      {/* slot */}
      <span className="absolute inset-y-1 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-[#0a0a0a] ring-1 ring-[#232323] ring-inset" />
      {/* cap: a wide flat blade, the way a console fader reads */}
      <span
        style={{ bottom: capBottom }}
        className="pointer-events-none absolute left-0 h-[7px] w-[18px] -translate-y-1/2 rounded-[2px] bg-white shadow-[0_1px_3px_rgb(0_0_0/0.7)] transition-[height] duration-100 group-hover:h-[9px] group-focus-visible:ring-2 group-focus-visible:ring-accent"
      />
    </div>
  )
}

interface Channel {
  id: string
  name: string
  db: number
  muted: boolean
  /** drives the simulated programme level */
  energy: number
}

const CHANNELS: Channel[] = [
  { id: 'a2', name: 'Audio 2', db: -5, muted: false, energy: 0.34 },
  { id: 'a1', name: 'Audio 1', db: 3, muted: false, energy: 0.92 },
  { id: 'mst', name: 'Master', db: -1, muted: false, energy: 0.78 },
]

export function MixerStrip() {
  const [channels, setChannels] = useState(CHANNELS)
  const [levels, setLevels] = useState<Record<string, [number, number]>>({})
  const frame = useRef(0)

  // One loop drives every meter: fast attack, slow release.
  useEffect(() => {
    const state: Record<string, [number, number]> = {}
    const tick = (now: number) => {
      const next: Record<string, [number, number]> = {}
      for (const channel of channels) {
        const pair = state[channel.id] ?? [FLOOR_DB, FLOOR_DB]
        const shaped: [number, number] = [FLOOR_DB, FLOOR_DB]
        for (let side = 0; side < 2; side += 1) {
          const swing = Math.abs(Math.sin(now / (300 + side * 70 + channel.energy * 420)))
          // programme sits a few dB under the fader, dipping with the envelope
          const target = channel.muted
            ? FLOOR_DB
            : channel.db - 3 - (1 - channel.energy) * 12 - (1 - swing) * 16
          const current = pair[side] ?? FLOOR_DB
          shaped[side] = target > current ? target : current + (target - current) * 0.12
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
    setChannels((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  return (
    <div
      data-tw
      className="overflow-hidden rounded-xl border border-[#232323] bg-[#0d0d0d] font-ui text-[#ededed]"
    >
      <header className="flex h-10 items-center justify-between gap-2.5 border-b border-[#232323] px-3.5">
        <h3 className="text-[13px] font-medium">Mixer</h3>
        <span className="text-[11.5px] tabular-nums text-[#5c5c5c]">double-click a fader for 0 dB</span>
      </header>

      <div className="flex gap-px bg-[#1b1b1b]">
        {channels.map((channel) => {
          const [left = FLOOR_DB, right = FLOOR_DB] = levels[channel.id] ?? []
          return (
            <div key={channel.id} className="flex min-w-0 flex-1 flex-col gap-2.5 bg-[#0d0d0d] px-2 py-3">
              {/* value and mute lead the strip, the way the reference reads */}
              <div className="flex items-center gap-1">
                <NumberField
                  value={channel.db}
                  onChange={(db) => update(channel.id, { db: clamp(db, FLOOR_DB, TOP_DB) })}
                  min={FLOOR_DB}
                  max={TOP_DB}
                  step={0.5}
                  pxPerStep={3}
                  format={formatDb}
                  parse={(text) => Number.parseFloat(text)}
                  aria-label={`${channel.name} gain`}
                />
                <button
                  type="button"
                  aria-pressed={channel.muted}
                  aria-label={`Mute ${channel.name}`}
                  onClick={() => update(channel.id, { muted: !channel.muted })}
                  className={cn(
                    'h-7 w-7 flex-none rounded-md text-[11px] font-semibold transition-colors',
                    channel.muted
                      ? 'bg-[#d0453c] text-white'
                      : 'bg-[#1f1f1f] text-[#8b8b8b] hover:bg-[#272727] hover:text-[#ededed]',
                  )}
                >
                  M
                </button>
              </div>

              <div className="flex h-[190px] items-stretch gap-1.5">
                <Fader db={channel.db} onChange={(db) => update(channel.id, { db })} />

                <div className="flex flex-none gap-px">
                  <Meter db={left} />
                  <Meter db={right} />
                </div>

                {/* the printed scale, positioned by the same dB mapping */}
                <div className="relative flex-1 text-[9px] tabular-nums text-[#5c5c5c]">
                  {SCALE.map((db) => (
                    <span
                      key={db}
                      style={{ bottom: `${dbToFraction(db) * 100}%` }}
                      className="absolute left-0 flex translate-y-1/2 items-center gap-1 before:h-px before:w-1 before:bg-[#333]"
                    >
                      {db > 0 ? `+${db}` : db}
                    </span>
                  ))}
                  <span className="absolute bottom-0 left-0 flex translate-y-1/2 items-center gap-1 before:h-px before:w-1 before:bg-[#333]">
                    -∞
                  </span>
                </div>
              </div>

              <span className="truncate text-center text-[11px] text-[#8b8b8b]">{channel.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
