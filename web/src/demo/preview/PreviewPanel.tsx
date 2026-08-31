import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Film, Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react'
import { IconButton, NumberField, Panel, Select, clamp, useElementSize } from '../../primitives'
import styles from './preview.module.css'

/**
 * The programme monitor.
 *
 * Time is held in frames, not seconds — a monitor that cannot land on a frame
 * is not a monitor, and every rounding question disappears once the unit is
 * the frame. The readout is a NumberField, so the same drag-to-scrub gesture
 * that moves a position field moves the playhead.
 */

const FPS = 30

interface Segment {
  id: string
  name: string
  /** seconds on the programme timeline */
  start: number
  end: number
  hue: number
  caption?: string
}

/* Two clips with a hole between them and a tail after them, because "nothing
   under the playhead" is a real state a monitor has to render, not a
   placeholder for one. */
const PROGRAMME: Segment[] = [
  { id: 'a', name: 'Drone_pullback_4k.mp4', start: 0, end: 3.2, hue: 208 },
  { id: 'b', name: 'B_roll_city_dusk.mp4', start: 4.4, end: 9.6, hue: 26, caption: 'Do you really think you can do that?' },
]

const DURATION = 11
const TOTAL_FRAMES = Math.round(DURATION * FPS)

const RATIOS = [
  { value: '16x9', label: '16:9 — 1920 × 1080', w: 1920, h: 1080 },
  { value: '4k', label: '16:9 · 4K — 3840 × 2160', w: 3840, h: 2160 },
  { value: '9x16', label: '9:16 — 1080 × 1920', w: 1080, h: 1920 },
  { value: '1x1', label: '1:1 — 1080 × 1080', w: 1080, h: 1080 },
  { value: '4x3', label: '4:3 — 1440 × 1080', w: 1440, h: 1080 },
  { value: '21x9', label: '21:9 — 2560 × 1080', w: 2560, h: 1080 },
] as const

const ZOOMS = [
  { value: 0, label: 'Fit' },
  { value: 0.125, label: '1:8' },
  { value: 0.25, label: '1:4' },
  { value: 0.5, label: '1:2' },
] as const

const pad = (value: number) => String(Math.floor(value)).padStart(2, '0')

/** frames -> hh:mm:ss:ff */
function timecode(frames: number): string {
  const whole = Math.max(0, Math.round(frames))
  const seconds = Math.floor(whole / FPS)
  return [pad(seconds / 3600), pad((seconds % 3600) / 60), pad(seconds % 60), pad(whole % FPS)].join(':')
}

function fromTimecode(text: string): number {
  const parts = text.split(':').map((part) => Number.parseFloat(part) || 0)
  while (parts.length < 4) parts.unshift(0)
  const [hours = 0, minutes = 0, seconds = 0, frames = 0] = parts.slice(-4)
  return (hours * 3600 + minutes * 60 + seconds) * FPS + frames
}

/** A ratio drawn at ratio, capped to a 14px slot so the rows stay aligned. */
function RatioGlyph({ w, h }: { w: number; h: number }) {
  const scale = 14 / Math.max(w, h)
  return <span className={styles.glyph} style={{ width: Math.round(w * scale), height: Math.round(h * scale) }} />
}

/** The clip under the playhead, drawn rather than shipped. `t` is 0..1 across
 *  the clip, so playing it actually moves the picture. */
function Scene({ segment, t, height }: { segment: Segment; t: number; height: number }) {
  const day = Math.sin(clamp(t, 0, 1) * Math.PI)
  const { hue } = segment
  const ridge = [0.42, 0.68, 0.35, 0.86, 0.5, 0.74, 0.3, 0.62, 0.44]

  return (
    <div className={styles.scene}>
      <div
        className={styles.scene}
        style={{
          background: `linear-gradient(180deg, hsl(${hue} 52% ${6 + day * 14}%) 0%, hsl(${hue + 14} 48% ${13 + day * 22}%) 48%, hsl(${hue + 34} 62% ${24 + day * 32}%) 100%)`,
        }}
      />
      <div
        className={styles.sun}
        style={{
          left: `${12 + t * 74}%`,
          top: `${62 - day * 42}%`,
          background: `radial-gradient(circle, hsl(${hue + 46} 95% ${70 + day * 20}%) 0%, hsl(${hue + 40} 92% 62% / 0.5) 42%, transparent 70%)`,
        }}
      />
      <div className={styles.ridge}>
        {ridge.map((peak, index) => (
          <span
            key={index}
            style={{ height: `${peak * 100}%`, background: `hsl(${hue} 36% ${4 + day * 5}%)` }}
          />
        ))}
      </div>
      <div
        className={styles.ground}
        style={{ background: `linear-gradient(180deg, hsl(${hue} 30% ${7 + day * 5}%), hsl(${hue} 26% 3%))` }}
      />
      <div className={styles.vignette} />
      {segment.caption !== undefined && (
        <div className={styles.caption} style={{ fontSize: Math.max(9, height * 0.055) }}>
          {segment.caption}
        </div>
      )}
    </div>
  )
}

export function PreviewPanel() {
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [ratioId, setRatioId] = useState<(typeof RATIOS)[number]['value']>('16x9')
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]['value']>(0)
  const [viewportRef, viewport] = useElementSize<HTMLDivElement>()

  const ratio = RATIOS.find((entry) => entry.value === ratioId) ?? RATIOS[0]

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const delta = (now - last) / 1000
      last = now
      setFrame((current) => Math.min(TOTAL_FRAMES, current + delta * FPS))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  // Stopping at the tail is its own effect rather than a branch inside the
  // frame updater: an updater that also flips other state runs twice under
  // StrictMode and stops being a pure function of its input.
  useEffect(() => {
    if (frame >= TOTAL_FRAMES) setPlaying(false)
  }, [frame])

  const seek = (next: number) => {
    setPlaying(false)
    setFrame(clamp(Math.round(next), 0, TOTAL_FRAMES))
  }

  const seconds = frame / FPS
  const segment = PROGRAMME.find((entry) => seconds >= entry.start && seconds < entry.end) ?? null

  /* --- stage geometry --------------------------------------------------- */

  // useElementSize reports the content box, so the viewport's padding is
  // already out of these numbers — subtracting it again would shrink the
  // stage by the gutter twice.
  const fitted = Math.min(viewport.width / ratio.w, viewport.height / ratio.h)
  const scale = zoom === 0 ? (Number.isFinite(fitted) && fitted > 0 ? fitted : 0) : zoom
  const stage = { width: Math.round(ratio.w * scale), height: Math.round(ratio.h * scale) }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? FPS : 1
    switch (event.key) {
      case ' ':
        event.preventDefault()
        setPlaying((on) => !on)
        break
      case 'ArrowLeft':
        event.preventDefault()
        seek(frame - step)
        break
      case 'ArrowRight':
        event.preventDefault()
        seek(frame + step)
        break
      case 'Home':
        event.preventDefault()
        seek(0)
        break
      case 'End':
        event.preventDefault()
        seek(TOTAL_FRAMES)
        break
      default:
        break
    }
  }

  return (
    <Panel
      title="Preview"
      width={860}
      className={styles.panel}
      actions={
        <span className={styles.note}>
          {ratio.w} × {ratio.h} · {FPS} fps
        </span>
      }
    >
      <div
        ref={viewportRef}
        className={styles.viewport}
        tabIndex={0}
        role="group"
        aria-label="Programme monitor. Space plays, arrows step a frame, shift steps a second."
        onKeyDown={onKeyDown}
      >
        <div className={styles.stage} style={stage}>
          {segment ? (
            <Scene
              segment={segment}
              t={(seconds - segment.start) / (segment.end - segment.start)}
              height={stage.height}
            />
          ) : (
            <div className={styles.empty}>
              <Film size={22} strokeWidth={1.6} aria-hidden />
              Nothing under the playhead
            </div>
          )}
        </div>
      </div>

      <div className={styles.transport}>
        <div className={styles.timecode}>
          <div className={styles.tcField}>
            <NumberField
              value={frame}
              onChange={seek}
              min={0}
              max={TOTAL_FRAMES}
              step={1}
              format={timecode}
              parse={fromTimecode}
              aria-label="Playhead"
            />
          </div>
          <span className={styles.tcTotal}>/ {timecode(TOTAL_FRAMES)}</span>
        </div>

        <div className={styles.buttons}>
          <IconButton label="Go to start" shortcut="Home" disabled={frame === 0} onClick={() => seek(0)}>
            <SkipBack size={14} />
          </IconButton>
          <IconButton label="Previous frame" shortcut="←" disabled={frame === 0} onClick={() => seek(frame - 1)}>
            <StepBack size={14} />
          </IconButton>
          <IconButton
            label={playing ? 'Pause' : 'Play'}
            shortcut="Space"
            className={styles.play}
            onClick={() => {
              // Playing from the tail would sit there doing nothing, so the
              // button rewinds first — the same thing every editor does.
              if (frame >= TOTAL_FRAMES) setFrame(0)
              setPlaying((on) => !on)
            }}
          >
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </IconButton>
          <IconButton
            label="Next frame"
            shortcut="→"
            disabled={frame >= TOTAL_FRAMES}
            onClick={() => seek(frame + 1)}
          >
            <StepForward size={14} />
          </IconButton>
          <IconButton
            label="Go to end"
            shortcut="End"
            disabled={frame >= TOTAL_FRAMES}
            onClick={() => seek(TOTAL_FRAMES)}
          >
            <SkipForward size={14} />
          </IconButton>
        </div>

        <div className={styles.pickers}>
          <div className={styles.ratioPicker}>
            <Select
              options={RATIOS.map((entry) => ({
                value: entry.value,
                label: entry.label,
                icon: <RatioGlyph w={entry.w} h={entry.h} />,
              }))}
              value={ratioId}
              onChange={setRatioId}
              icon={<RatioGlyph w={ratio.w} h={ratio.h} />}
              aria-label="Output size"
            />
          </div>
          <div className={styles.zoomPicker}>
            <Select options={ZOOMS} value={zoom} onChange={setZoom} aria-label="Preview zoom" />
          </div>
        </div>
      </div>
    </Panel>
  )
}

export function PreviewSection() {
  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <h2>Preview</h2>
        <p>
          A programme monitor that counts in frames. Drag the timecode to scrub, or focus the stage
          and press space — arrows step a frame, shift-arrows a second. The output picker really
          reshapes the stage, and the zoom really overflows it, because a monitor that lies about
          the frame is worse than none.
        </p>
      </header>

      <div className={styles.centre}>
        <PreviewPanel />
      </div>
    </section>
  )
}
