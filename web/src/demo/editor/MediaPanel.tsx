import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { AudioLines, Check, Search, Upload } from 'lucide-react'
import { SegmentedControl, clamp } from '../../primitives'
import { duration, seeded, timecode } from './format'
import { Button, Panel, Section, TextInput, cn } from './ui'

type Kind = 'video' | 'audio'

interface Asset {
  id: string
  name: string
  kind: Kind
  seconds: number
  /** base hue for the flat contact-sheet bands */
  hue: number
}

const ASSETS: Asset[] = [
  { id: 'a1', name: 'Protagonist_review_take3.mp4', kind: 'video', seconds: 184, hue: 212 },
  { id: 'a2', name: 'speech-af_heart-1.wav', kind: 'audio', seconds: 41, hue: 28 },
  { id: 'a3', name: 'B_roll_city_dusk.mp4', kind: 'video', seconds: 96, hue: 336 },
  { id: 'a4', name: 'Interview_wide_A.mp4', kind: 'video', seconds: 452, hue: 152 },
  { id: 'a5', name: 'room_tone_bar.wav', kind: 'audio', seconds: 128, hue: 250 },
  { id: 'a6', name: 'Drone_pullback_4k.mp4', kind: 'video', seconds: 63, hue: 190 },
]

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
] as const

/** Deterministic, so a clip always draws the same bands and waveform. */
function useSheet(asset: Asset) {
  return useMemo(() => {
    const random = seeded(asset.seconds + asset.hue)
    return Array.from({ length: 8 }, () => `hsl(${asset.hue} 16% ${11 + Math.round(random() * 22)}%)`)
  }, [asset.seconds, asset.hue])
}

function Waveform({ asset }: { asset: Asset }) {
  const bars = useMemo(() => {
    const random = seeded(asset.seconds)
    return Array.from({ length: 34 }, (_, i) => {
      const envelope = Math.sin((i / 33) * Math.PI) * 0.55 + 0.45
      return Math.max(0.12, random() * envelope)
    })
  }, [asset.seconds])

  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
      {bars.map((height, index) => (
        <rect
          key={index}
          x={index * 2.94 + 0.6}
          y={20 - height * 17}
          width={1.7}
          height={height * 34}
          fill="rgb(255 255 255 / 0.45)"
        />
      ))}
    </svg>
  )
}

function AssetCard({ asset, selected, onToggle }: { asset: Asset; selected: boolean; onToggle: () => void }) {
  const thumbRef = useRef<HTMLDivElement>(null)
  const [scrub, setScrub] = useState<number | null>(null)
  const sheet = useSheet(asset)
  const isVideo = asset.kind === 'video'

  // Hovering scrubs the clip: the playhead follows the cursor and the badge
  // reports the timecode under it.
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = thumbRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    setScrub(clamp((event.clientX - rect.left) / rect.width, 0, 1))
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className="group min-w-0 rounded-md text-left focus-visible:ring-1 focus-visible:ring-accent"
    >
      <div
        ref={thumbRef}
        onPointerMove={isVideo ? onPointerMove : undefined}
        onPointerLeave={() => setScrub(null)}
        className={cn(
          'relative aspect-[16/10] overflow-hidden rounded bg-[#0a0a0c] ring-inset transition-shadow',
          selected ? 'ring-2 ring-accent' : 'ring-1 ring-line group-hover:ring-edge',
        )}
      >
        {isVideo ? (
          <div className="absolute inset-0 flex">
            {sheet.map((color, index) => (
              <span key={index} className="flex-1" style={{ background: color }} />
            ))}
          </div>
        ) : (
          <>
            <span className="absolute inset-0" style={{ background: `hsl(${asset.hue} 16% 13%)` }} />
            <Waveform asset={asset} />
          </>
        )}

        {/* Only audio is badged. Video is the default in a bin and its duration
            already says the clip is temporal, so a badge on every video marks
            the norm rather than the exception — pure noise. */}
        {!isVideo && (
          <span className="absolute top-1.5 left-1.5 grid size-[19px] place-items-center rounded-sm bg-warn text-white">
            <AudioLines size={12} />
          </span>
        )}

        {selected && (
          <span className="absolute top-1.5 right-1.5 grid size-[18px] place-items-center rounded-full bg-accent text-white">
            <Check size={12} strokeWidth={2.8} />
          </span>
        )}

        {scrub === null ? (
          <span className="absolute right-1.5 bottom-1.5 rounded-sm bg-black/70 px-1.5 py-px text-[10px] tabular-nums text-white">
            {duration(asset.seconds)}
          </span>
        ) : (
          <>
            <span className="pointer-events-none absolute inset-y-0 w-px bg-white" style={{ left: `${scrub * 100}%` }} />
            <span className="absolute bottom-1.5 left-1.5 rounded-sm bg-accent px-1.5 py-px text-[10px] tabular-nums text-white">
              {timecode(asset.seconds * scrub)}
            </span>
          </>
        )}
      </div>

      <span className="mt-1.5 block truncate text-[11.5px] text-ink">{asset.name}</span>
      <span className="mt-px block text-[10.5px] tabular-nums text-inkdim">
        {isVideo ? '1920 × 1080 · 30 fps' : '48 kHz · stereo'}
      </span>
    </button>
  )
}

export function MediaPanel() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('all')
  const [selected, setSelected] = useState<string[]>(['a1'])
  const [dragOver, setDragOver] = useState(false)

  const visible = ASSETS.filter(
    (asset) =>
      (filter === 'all' || asset.kind === filter) &&
      asset.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const selectedSeconds = ASSETS.filter((a) => selected.includes(a.id)).reduce(
    (total, a) => total + a.seconds,
    0,
  )

  return (
    <Panel title="Media" note={`${ASSETS.length} items`} width={520}>
      <Section label="Library">
        <div className="flex items-center gap-1.5">
          <div className="relative flex min-w-0 flex-1 items-center">
            <Search size={14} className="pointer-events-none absolute left-2.5 text-inkdim" />
            <TextInput
              value={query}
              onChange={setQuery}
              placeholder="Search media"
              aria-label="Search media"
              className="pl-[30px]"
            />
          </div>
          <div className="w-[176px] flex-none">
            <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} aria-label="Filter by type" />
          </div>
        </div>

        {/* the drag target has to announce itself, or the gesture feels dead */}
        <button
          type="button"
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(false)
          }}
          className={cn(
            'flex h-[58px] w-full items-center justify-center gap-2 rounded-md border border-dashed text-xs transition-colors focus-visible:ring-1 focus-visible:ring-accent',
            dragOver
              ? 'border-solid border-accent bg-accent/15 text-ink'
              : 'border-line bg-well text-inkmute hover:border-edge hover:text-ink',
          )}
        >
          <Upload size={15} />
          {dragOver ? 'Release to import' : 'Drop files here, or click to browse'}
        </button>
      </Section>

      <Section label="Clips">
        <div className="grid grid-cols-3 gap-2.5">
          {visible.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              selected={selected.includes(asset.id)}
              onToggle={() =>
                setSelected((current) =>
                  current.includes(asset.id)
                    ? current.filter((id) => id !== asset.id)
                    : [...current, asset.id],
                )
              }
            />
          ))}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2.5 text-[11.5px] tabular-nums text-inkmute">
          <span>
            {visible.length} of {ASSETS.length} shown
            {selected.length > 0 && ` · ${selected.length} selected · ${duration(selectedSeconds)}`}
          </span>
          {selected.length > 0 && (
            <Button variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          )}
        </div>
      </Section>
    </Panel>
  )
}
