import { useMemo } from 'react'
import {
  ChevronDown,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
} from 'lucide-react'
import { LevelMeter, Select } from '../primitives'
import { seeded, timecode } from '../demo/editor/format'
import { cn } from '../demo/editor/ui'

const ZOOM = [
  { value: 50, label: '1:2' },
  { value: 100, label: '1:1' },
  { value: 200, label: '2:1' },
]

interface MonitorProps {
  playhead: number
  duration: number
  playing: boolean
  onScrub: (seconds: number) => void
  onTogglePlay: () => void
  guides: boolean
  onGuidesChange: (on: boolean) => void
  zoom: number
  onZoomChange: (zoom: number) => void
  level: number
  peak: number
}

/**
 * Stand-in for decoded video. Flat vertical bands keyed off the playhead, so
 * the frame visibly changes as you scrub without pretending to be footage —
 * the same contact-sheet trick the browser uses for thumbnails.
 */
function PreviewFrame({ playhead }: { playhead: number }) {
  const bands = useMemo(() => {
    // Quantised so the picture holds for a beat instead of strobing per frame.
    const random = seeded(Math.floor(playhead / 2) + 7)
    const hue = 200 + Math.floor(playhead / 2) * 13
    return Array.from({ length: 9 }, () => ({
      color: `hsl(${(hue + random() * 40) % 360} 16% ${8 + Math.round(random() * 20)}%)`,
      flex: 0.6 + random(),
    }))
  }, [playhead])

  return (
    <div className="absolute inset-0 flex">
      {bands.map((band, index) => (
        <span key={index} style={{ background: band.color, flex: band.flex }} />
      ))}
    </div>
  )
}

function TransportButton({
  label,
  onClick,
  active,
  primary,
  children,
}: {
  label: string
  onClick?: () => void
  active?: boolean
  primary?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'grid place-items-center rounded-md transition-colors focus-visible:ring-1 focus-visible:ring-accent',
        primary ? 'size-8 text-ink hover:bg-field' : 'size-7 text-inkmute hover:bg-field hover:text-ink',
        active && 'bg-accent text-white hover:bg-accenthi',
      )}
    >
      {children}
    </button>
  )
}

export function ProgramMonitor({
  playhead,
  duration,
  playing,
  onScrub,
  onTogglePlay,
  guides,
  onGuidesChange,
  zoom,
  onZoomChange,
  level,
  peak,
}: MonitorProps) {
  const frame = 1 / 30

  return (
    <section
      data-tw
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-panel border border-line bg-panel font-ui"
    >
      <header className="flex h-[34px] flex-none items-center gap-2 border-b border-line px-3">
        <span className="text-[10.5px] font-medium tracking-wide text-inkmute uppercase">Preview</span>
        <div className="ml-auto flex items-center gap-1">
          <TransportButton label="Toggle safe guides" active={guides} onClick={() => onGuidesChange(!guides)}>
            <Maximize2 size={13} />
          </TransportButton>
        </div>
      </header>

      {/* The stage is darker than the panel so the frame reads as the lit
          object in the room rather than another surface. */}
      <div className="grid min-h-0 flex-1 place-items-center overflow-hidden bg-[#080809] p-4">
        <div className="relative aspect-video max-h-full w-full max-w-full overflow-hidden bg-black ring-1 ring-line">
          <PreviewFrame playhead={playhead} />

          {guides && (
            <>
              {/* 90% action safe / 80% title safe, the broadcast convention */}
              <span className="pointer-events-none absolute inset-[5%] border border-dashed border-white/20" />
              <span className="pointer-events-none absolute inset-[10%] border border-dashed border-white/12" />
            </>
          )}

          <span className="pointer-events-none absolute inset-x-0 bottom-[12%] px-8 text-center text-[22px] font-semibold text-white drop-shadow-[0_2px_6px_rgb(0_0_0/0.8)]">
            Do you really think you can do that?
          </span>
        </div>
      </div>

      <footer className="relative flex h-[42px] flex-none items-center gap-2 border-t border-line px-3">
        <span className="text-[11px] tabular-nums text-inkmute">
          <span className="text-ink">{timecode(playhead)}</span> / {timecode(duration)}
        </span>

        {/* Transport is centred on the panel, not on the space left over after
            the readouts — so it stays put as the timecode digits change. */}
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1">
          <TransportButton label="Go to start" onClick={() => onScrub(0)}>
            <SkipBack size={14} />
          </TransportButton>
          <TransportButton label="Previous frame" onClick={() => onScrub(Math.max(0, playhead - frame))}>
            <StepBack size={14} />
          </TransportButton>
          <TransportButton label={playing ? 'Pause' : 'Play'} primary onClick={onTogglePlay}>
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </TransportButton>
          <TransportButton label="Next frame" onClick={() => onScrub(Math.min(duration, playhead + frame))}>
            <StepForward size={14} />
          </TransportButton>
          <TransportButton label="Go to end" onClick={() => onScrub(duration)}>
            <SkipForward size={14} />
          </TransportButton>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="w-[86px]">
            <LevelMeter value={level} peak={peak} aria-label="Programme level" />
          </div>
          <span className="flex items-center gap-1 text-[11px] text-inkdim">
            16:9 <ChevronDown size={11} />
          </span>
          <div className="w-[72px]">
            <Select options={ZOOM} value={zoom} onChange={onZoomChange} aria-label="Preview zoom" />
          </div>
        </div>
      </footer>
    </section>
  )
}
