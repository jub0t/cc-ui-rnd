import { useMemo, useRef, useState } from 'react'
import {
  Copy,
  Eye,
  EyeOff,
  Magnet,
  Maximize2,
  MousePointer2,
  Plus,
  Scissors,
  SplitSquareHorizontal,
  Trash2,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { clamp, usePointerDrag } from '../primitives'
import { seeded, timecode } from '../demo/editor/format'
import { cn } from '../demo/editor/ui'

interface Clip {
  id: string
  name: string
  start: number
  length: number
  hue: number
  kind: 'video' | 'audio' | 'caption'
}

interface Track {
  id: string
  label: string
  clips: Clip[]
}

const TRACKS: Track[] = [
  {
    id: 't4',
    label: 'Track 4',
    clips: [{ id: 'c1', name: 'Protagonist_review_take3', start: 0, length: 12, hue: 212, kind: 'video' }],
  },
  {
    id: 'captions',
    label: 'Captions',
    clips: [{ id: 'c2', name: 'Do you really think you can…', start: 0, length: 9, hue: 348, kind: 'caption' }],
  },
  {
    id: 't2',
    label: 'Track 2',
    clips: [{ id: 'c3', name: 'speech-af_heart-1', start: 0, length: 8, hue: 28, kind: 'audio' }],
  },
  { id: 't1', label: 'Track 1', clips: [] },
]

const GUTTER = 165
const ROW = 64

const TOOLS = [
  { id: 'select', label: 'Select', Icon: MousePointer2 },
  { id: 'blade', label: 'Blade', Icon: Scissors },
  { id: 'split', label: 'Split', Icon: SplitSquareHorizontal },
  { id: 'duplicate', label: 'Duplicate', Icon: Copy },
  { id: 'delete', label: 'Delete', Icon: Trash2 },
] as const

function Waveform({ clip }: { clip: Clip }) {
  const bars = useMemo(() => {
    const random = seeded(clip.length + clip.hue)
    return Array.from({ length: 80 }, (_, i) => {
      const envelope = Math.sin((i / 79) * Math.PI) * 0.5 + 0.5
      return Math.max(0.1, random() * envelope)
    })
  }, [clip.length, clip.hue])

  return (
    <svg className="absolute inset-x-0 bottom-0 h-[58%] w-full" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden>
      {bars.map((height, index) => (
        <rect key={index} x={index * 1.25 + 0.2} y={10 - height * 9} width={0.8} height={height * 18} fill="rgb(255 255 255 / 0.45)" />
      ))}
    </svg>
  )
}

function Thumbs({ clip }: { clip: Clip }) {
  const sheet = useMemo(() => {
    const random = seeded(clip.length + clip.hue)
    return Array.from({ length: 6 }, () => `hsl(${clip.hue} 18% ${12 + Math.round(random() * 20)}%)`)
  }, [clip.length, clip.hue])

  return (
    <span className="absolute inset-x-0 bottom-0 flex h-[62%]">
      {sheet.map((color, index) => (
        <span key={index} className="flex-1" style={{ background: color }} />
      ))}
    </span>
  )
}

function IconBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick?: () => void
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
        'grid size-7 place-items-center rounded-md transition-colors focus-visible:ring-1 focus-visible:ring-accent',
        active ? 'bg-accent text-white hover:bg-accenthi' : 'text-inkmute hover:bg-field hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

export function Timeline({
  playhead,
  duration,
  onScrub,
  zoom,
  onZoomChange,
}: {
  playhead: number
  duration: number
  onScrub: (seconds: number) => void
  zoom: number
  onZoomChange: (zoom: number) => void
}) {
  const laneRef = useRef<HTMLDivElement>(null)
  const [tool, setTool] = useState<(typeof TOOLS)[number]['id']>('select')
  const [snap, setSnap] = useState(true)
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [muted, setMuted] = useState<Record<string, boolean>>({})
  const [picked, setPicked] = useState('c1')

  // One pixels-per-second scale drives the ruler, every clip and the playhead,
  // so nothing can drift out of alignment when the zoom changes.
  const pps = zoom
  const width = Math.max(duration * pps, 200)

  const seek = (clientX: number) => {
    const lane = laneRef.current
    const rect = lane?.getBoundingClientRect()
    if (!lane || !rect || rect.width === 0) return
    onScrub(clamp((clientX - rect.left + lane.scrollLeft) / pps, 0, duration))
  }

  const beginScrub = usePointerDrag({
    cursor: 'ew-resize',
    onStart: ({ x }) => seek(x),
    onMove: ({ x }) => seek(x),
  })

  const step = pps > 26 ? 2 : pps > 13 ? 5 : pps > 6 ? 15 : 30
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => i * step)

  return (
    <section
      data-tw
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-line bg-panel font-ui"
    >
      {/* Sequence tabs */}
      <div className="flex h-[30px] flex-none items-center gap-1 border-b border-line px-1.5">
        <span className="rounded bg-field px-2.5 py-1 text-[11.5px] text-ink">Timeline 1</span>
        <IconBtn label="New timeline"><Plus size={14} /></IconBtn>
      </div>

      {/* Tool row */}
      <div className="flex h-[38px] flex-none items-center gap-0.5 border-b border-line px-2">
        {TOOLS.map(({ id, label, Icon }) => (
          <IconBtn key={id} label={label} active={tool === id} onClick={() => setTool(id)}>
            <Icon size={15} />
          </IconBtn>
        ))}
        <span className="mx-1.5 h-5 w-px bg-line" />
        <IconBtn label="Snap to edges" active={snap} onClick={() => setSnap((s) => !s)}>
          <Magnet size={15} />
        </IconBtn>

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-[11px] tabular-nums text-inkdim">{timecode(playhead)}</span>
          <IconBtn label="Fit timeline" onClick={() => onZoomChange(11)}><Maximize2 size={14} /></IconBtn>
          <IconBtn label="Zoom out" onClick={() => onZoomChange(clamp(zoom - 4, 4, 40))}><ZoomOut size={15} /></IconBtn>
          <IconBtn label="Zoom in" onClick={() => onZoomChange(clamp(zoom + 4, 4, 40))}><ZoomIn size={15} /></IconBtn>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Track headers stay put while the lanes scroll. */}
        <div className="flex-none border-r border-line" style={{ width: GUTTER }}>
          <div className="h-6 border-b border-line" />
          {TRACKS.map((track) => (
            <div key={track.id} className="flex items-center gap-1 border-b border-linesoft px-3" style={{ height: ROW }}>
              <span className="flex-1 truncate text-[11.5px] text-ink">{track.label}</span>
              <IconBtn
                label="Toggle visibility"
                onClick={() => setVisible((c) => ({ ...c, [track.id]: !c[track.id] }))}
              >
                {visible[track.id] ? <EyeOff size={13} /> : <Eye size={13} />}
              </IconBtn>
              <IconBtn label="Toggle mute" onClick={() => setMuted((c) => ({ ...c, [track.id]: !c[track.id] }))}>
                {muted[track.id] ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </IconBtn>
            </div>
          ))}
        </div>

        <div ref={laneRef} className="min-w-0 flex-1 overflow-auto">
          <div className="relative" style={{ width }}>
            {/* The ruler doubles as the scrub surface — clicking the numbers is
                the gesture people reach for first. */}
            <div
              onPointerDown={beginScrub}
              className="sticky top-0 z-10 h-6 cursor-ew-resize touch-none border-b border-line bg-panel select-none"
            >
              {ticks.map((second) => (
                <span key={second} className="absolute top-0 h-full" style={{ left: second * pps }}>
                  <span className="absolute top-0 h-1.5 w-px bg-edge" />
                  <span className="absolute top-1.5 left-1 text-[9.5px] tabular-nums whitespace-nowrap text-inkdim">
                    {timecode(second)}
                  </span>
                </span>
              ))}
            </div>

            {TRACKS.map((track) => (
              <div key={track.id} className="relative border-b border-linesoft" style={{ height: ROW }}>
                {ticks.map((second) => (
                  <span key={second} className="absolute inset-y-0 w-px bg-white/[0.035]" style={{ left: second * pps }} />
                ))}

                {track.clips.map((clip) => (
                  <button
                    key={clip.id}
                    type="button"
                    aria-pressed={clip.id === picked}
                    onClick={() => setPicked(clip.id)}
                    style={{
                      left: clip.start * pps,
                      width: Math.max(clip.length * pps - 2, 8),
                      background: `hsl(${clip.hue} 32% 24%)`,
                      opacity: visible[track.id] ? 0.4 : 1,
                    }}
                    className={cn(
                      'absolute inset-y-1 overflow-hidden rounded text-left ring-inset focus-visible:ring-1 focus-visible:ring-accent',
                      clip.id === picked ? 'ring-2 ring-accent' : 'ring-1 ring-white/10 hover:ring-white/25',
                    )}
                  >
                    <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `hsl(${clip.hue} 48% 48%)` }} />
                    {clip.kind === 'audio' && <Waveform clip={clip} />}
                    {clip.kind === 'video' && <Thumbs clip={clip} />}
                    <span className="absolute top-[6px] left-1.5 truncate pr-2 text-[10.5px] text-white/85">
                      {clip.name}
                    </span>
                  </button>
                ))}
              </div>
            ))}

            {/* Playhead spans ruler and lanes so the eye reads one line. */}
            <span className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-[#ff453a]" style={{ left: playhead * pps }}>
              <span className="absolute -top-px -left-[5px] size-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-[#ff453a]" />
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
