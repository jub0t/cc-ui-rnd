// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, FolderOpen, Loader2, Upload, X } from 'lucide-react'
import { Select, clamp } from '../../primitives'
import { bytes, duration, eta, midTruncate } from './format'
import { Button, Panel, Progress, Row, Section, TextInput, cn } from './ui'

const RESOLUTIONS = [
  { value: 2160, label: '3840 × 2160 (4K)' },
  { value: 1440, label: '2560 × 1440' },
  { value: 1080, label: '1920 × 1080' },
  { value: 720, label: '1280 × 720' },
]

const FPS = [
  { value: 24, label: '24 fps' },
  { value: 30, label: '30 fps' },
  { value: 60, label: '60 fps' },
]

/** Video bitrate in Mbps at 1080p30, scaled by pixel count and frame rate. */
const TIERS = [
  { value: 'high', label: 'High', note: 'Master', mbps: 16 },
  { value: 'balanced', label: 'Balanced', note: 'Recommended', mbps: 8 },
  { value: 'small', label: 'Small', note: 'Share', mbps: 4 },
] as const

type Tier = (typeof TIERS)[number]['value']

const AUDIO_BPS = 192_000
const PROJECT_SECONDS = 154
const FOLDER = 'C:\\Users\\Editor\\Documents\\Relay'

/** The size the export will actually be — the number the choice hinges on. */
function estimate(mbps: number, height: number, fps: number) {
  const pixelScale = (height * height * (16 / 9)) / (1080 * 1920)
  const videoBps = mbps * 1_000_000 * pixelScale * (fps / 30)
  return ((videoBps + AUDIO_BPS) * PROJECT_SECONDS) / 8
}

const PHASES = [
  { until: 0.68, label: 'Rendering video' },
  { until: 0.88, label: 'Encoding audio' },
  { until: 1, label: 'Finalising file' },
]

export function ExportPanel() {
  const [tier, setTier] = useState<Tier>('balanced')
  const [height, setHeight] = useState(1080)
  const [fps, setFps] = useState(30)
  const [filename, setFilename] = useState('Monaco_cut_v4')
  const [progress, setProgress] = useState<number | null>(null)
  const [complete, setComplete] = useState(false)

  const frame = useRef(0)
  const lastAt = useRef(0)
  const exporting = progress !== null

  useEffect(() => {
    if (!exporting) {
      lastAt.current = 0
      return
    }
    const tick = (now: number) => {
      const dt = Math.min((now - (lastAt.current || now)) / 1000, 0.1)
      lastAt.current = now
      setProgress((current) => {
        if (current === null) return current
        // encode passes are not linear; the audio pass runs quicker
        const speed = current < 0.68 ? 0.16 : current < 0.88 ? 0.42 : 0.22
        return clamp(current + speed * dt, 0, 1)
      })
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [exporting])

  useEffect(() => {
    if (progress !== null && progress >= 1) {
      setProgress(null)
      setComplete(true)
    }
  }, [progress])

  const size = estimate(TIERS.find((t) => t.value === tier)?.mbps ?? 8, height, fps)
  const phase = PHASES.find((p) => (progress ?? 0) < p.until) ?? PHASES[PHASES.length - 1]!

  return (
    <Panel title="Export" width={380}>
      <Section label="Summary">
        <div className="grid gap-px overflow-hidden rounded-md bg-line">
          {[
            ['Format', `${Math.round((height * 16) / 9)} × ${height} · ${fps} fps · H.264`],
            ['Duration', duration(PROJECT_SECONDS)],
            ['Contents', '8 clips · 3 titles · 2 audio'],
          ].map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-3 bg-raised px-3 py-2.5 text-[11.5px]">
              <span className="text-inkmute">{key}</span>
              <span className="tabular-nums text-ink">{value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Destination">
        <div className="flex w-full items-center gap-1.5">
          <TextInput value={filename} onChange={setFilename} aria-label="File name" />
          <Button className="flex-none">
            <FolderOpen size={14} />
            Browse
          </Button>
        </div>
        {/* full path sits under the field, so the editable filename is never
            the part that gets truncated away */}
        <span className="block truncate text-[11px] text-inkdim">
          {midTruncate(`${FOLDER}\\${filename}.mp4`, 52)}
        </span>
      </Section>

      <Section label="Output">
        <Row label="Resolution">
          <Select options={RESOLUTIONS} value={height} onChange={setHeight} aria-label="Resolution" />
        </Row>
        <Row label="Frame rate">
          <Select options={FPS} value={fps} onChange={setFps} aria-label="Frame rate" />
        </Row>
      </Section>

      <Section label="Quality">
        <div className="grid w-full grid-cols-3 gap-1.5" role="radiogroup" aria-label="Quality">
          {TIERS.map((option) => {
            const selected = option.value === tier
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTier(option.value)}
                className={cn(
                  'flex min-w-0 flex-col gap-0.5 rounded-md border p-2.5 text-left transition-colors focus-visible:ring-1 focus-visible:ring-accent',
                  selected ? 'border-accent bg-accent/15' : 'border-line bg-raised hover:border-edge',
                )}
              >
                <span className="text-xs font-semibold text-ink">{option.label}</span>
                <span className="truncate text-[10.5px] text-inkdim">{option.note}</span>
                {/* the deciding number, on the card instead of nowhere */}
                <span
                  className={cn(
                    'mt-1 text-xs font-semibold tabular-nums',
                    selected ? 'text-accent' : 'text-ink',
                  )}
                >
                  ~{bytes(estimate(option.mbps, height, fps))}
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      <div className="border-t border-line p-3.5">
        {exporting ? (
          <div className="flex w-full flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2.5 text-xs">
              <span className="flex items-center gap-2 text-ink">
                <Loader2 size={14} className="animate-spin" />
                {phase.label}
                <span className="text-inkmute">{Math.round((progress ?? 0) * 100)}%</span>
              </span>
              <span className="tabular-nums text-inkmute">
                {eta(((1 - (progress ?? 0)) / 0.2) * 1.4)}
              </span>
            </div>
            <Progress value={progress ?? 0} />
            <Button variant="ghost" className="self-start" onClick={() => setProgress(null)}>
              <X size={14} />
              Cancel export
            </Button>
          </div>
        ) : complete ? (
          <div className="flex w-full flex-col gap-2.5">
            <span className="flex items-center gap-2 text-[12.5px] font-medium text-success">
              <CheckCircle2 size={16} />
              Exported · {bytes(size)}
            </span>
            <div className="flex gap-1.5">
              <Button>
                <FolderOpen size={14} />
                Show in folder
              </Button>
              <Button variant="ghost" onClick={() => setComplete(false)}>
                Export again
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="primary"
            size="md"
            block
            onClick={() => {
              setComplete(false)
              setProgress(0)
            }}
          >
            <Upload size={15} />
            Export · ~{bytes(size)}
          </Button>
        )}
      </div>
    </Panel>
  )
}
