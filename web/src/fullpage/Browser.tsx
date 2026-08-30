import { useMemo, useState } from 'react'
import { AudioLines, ImageIcon, Search, Upload, Video } from 'lucide-react'
import { duration, seeded } from '../demo/editor/format'
import { TextInput, cn } from '../demo/editor/ui'

/**
 * Left browser: a tab strip over a category rail and a content pane, matching
 * the arrangement in the reference window. The asset cards are adapted from
 * demo/editor/MediaPanel rather than imported, so the index page's copy is left
 * untouched — a 417px column with a 97px rail cannot host a 520px card.
 */

const TABS = ['Media', 'Text', 'Transitions', 'Effects', 'Templates'] as const
type Tab = (typeof TABS)[number]

type Kind = 'video' | 'audio' | 'image'

interface Asset {
  id: string
  name: string
  kind: Kind
  seconds: number
  hue: number
}

const ASSETS: Asset[] = [
  { id: 'a1', name: 'speech-af_heart-1.wav', kind: 'audio', seconds: 41, hue: 28 },
  { id: 'a2', name: 'Protagonist_review_take3.mp4', kind: 'video', seconds: 184, hue: 212 },
  { id: 'a3', name: 'B_roll_city_dusk.mp4', kind: 'video', seconds: 96, hue: 336 },
  { id: 'a4', name: 'Interview_wide_A.mp4', kind: 'video', seconds: 452, hue: 152 },
  { id: 'a5', name: 'room_tone_bar.wav', kind: 'audio', seconds: 128, hue: 250 },
  { id: 'a6', name: 'poster_frame.png', kind: 'image', seconds: 0, hue: 190 },
]

const CATEGORIES = [
  { id: 'all', label: 'All media' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'image', label: 'Images' },
] as const

function Waveform({ asset }: { asset: Asset }) {
  const bars = useMemo(() => {
    const random = seeded(asset.seconds + asset.hue)
    return Array.from({ length: 26 }, (_, i) => {
      const envelope = Math.sin((i / 25) * Math.PI) * 0.5 + 0.5
      return Math.max(0.12, random() * envelope)
    })
  }, [asset.seconds, asset.hue])

  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
      {bars.map((height, index) => (
        <rect
          key={index}
          x={index * 3.85 + 0.7}
          y={20 - height * 16}
          width={2.2}
          height={height * 32}
          fill="rgb(255 255 255 / 0.5)"
        />
      ))}
    </svg>
  )
}

function AssetCard({ asset, selected, onSelect }: { asset: Asset; selected: boolean; onSelect: () => void }) {
  const sheet = useMemo(() => {
    const random = seeded(asset.seconds + asset.hue)
    return Array.from({ length: 6 }, () => `hsl(${asset.hue} 16% ${11 + Math.round(random() * 22)}%)`)
  }, [asset.seconds, asset.hue])

  const Badge = asset.kind === 'audio' ? AudioLines : asset.kind === 'image' ? ImageIcon : Video

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="group min-w-0 rounded-md text-left focus-visible:ring-1 focus-visible:ring-accent"
    >
      <div
        className={cn(
          'relative aspect-[16/11] overflow-hidden rounded bg-[#0a0a0c] ring-inset transition-shadow',
          selected ? 'ring-2 ring-accent' : 'ring-1 ring-line group-hover:ring-edge',
        )}
      >
        {asset.kind === 'audio' ? (
          <>
            <span className="absolute inset-0" style={{ background: `hsl(${asset.hue} 16% 13%)` }} />
            <Waveform asset={asset} />
          </>
        ) : (
          <span className="absolute inset-0 flex">
            {sheet.map((color, index) => (
              <span key={index} className="flex-1" style={{ background: color }} />
            ))}
          </span>
        )}

        <span
          className={cn(
            'absolute top-1.5 left-1.5 grid size-[19px] place-items-center rounded-sm text-white',
            asset.kind === 'audio' ? 'bg-warn' : 'bg-accent',
          )}
        >
          <Badge size={12} />
        </span>

        <span className="absolute right-1.5 bottom-1.5 rounded-sm bg-black/70 px-1.5 py-px text-[10px] tabular-nums text-white">
          {asset.kind === 'image' ? 'still' : duration(asset.seconds)}
        </span>
      </div>
      <span className="mt-1.5 block truncate text-[11px] text-ink">{asset.name}</span>
    </button>
  )
}

function EmptyTab({ tab }: { tab: Tab }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <p className="text-[11.5px] leading-relaxed text-inkdim">
        {tab} library is scaffolding only — the browser shell, tabs and rail are wired, the
        contents are not.
      </p>
    </div>
  )
}

export function Browser() {
  const [tab, setTab] = useState<Tab>('Media')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('a2')
  const [dragOver, setDragOver] = useState(false)

  const counts = {
    all: ASSETS.length,
    video: ASSETS.filter((a) => a.kind === 'video').length,
    audio: ASSETS.filter((a) => a.kind === 'audio').length,
    image: ASSETS.filter((a) => a.kind === 'image').length,
  }

  const visible = ASSETS.filter(
    (asset) =>
      (category === 'all' || asset.kind === category) &&
      asset.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <section
      data-tw
      className="flex min-h-0 w-full flex-col overflow-hidden rounded-panel border border-line bg-panel font-ui"
    >
      <div className="flex h-[34px] flex-none items-center gap-0.5 border-b border-line px-1.5">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={tab === name}
            onClick={() => setTab(name)}
            className={cn(
              'rounded px-2.5 py-1 text-[11.5px] transition-colors focus-visible:ring-1 focus-visible:ring-accent',
              tab === name ? 'bg-field text-ink' : 'text-inkmute hover:text-ink',
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Category rail — narrow, and it stays put while the pane scrolls. */}
        <nav className="w-[97px] flex-none border-r border-line py-2">
          <p className="px-3 pb-1 text-[10.5px] tracking-wide text-inkdim uppercase">{tab}</p>
          {tab === 'Media' &&
            CATEGORIES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={category === id}
                onClick={() => setCategory(id)}
                className={cn(
                  'flex w-full items-center justify-between gap-1 px-3 py-1 text-left text-[11.5px] transition-colors focus-visible:ring-1 focus-visible:ring-accent',
                  category === id ? 'bg-field text-ink' : 'text-inkmute hover:text-ink',
                )}
              >
                <span className="truncate">{label}</span>
                <span className="tabular-nums text-inkdim">{counts[id]}</span>
              </button>
            ))}
        </nav>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {tab === 'Media' ? (
            <>
              <div className="flex-none space-y-2 p-2.5">
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
                    'flex h-[38px] w-full items-center justify-center gap-2 rounded-md border border-dashed text-[11.5px] transition-colors focus-visible:ring-1 focus-visible:ring-accent',
                    dragOver
                      ? 'border-solid border-accent bg-accent/15 text-ink'
                      : 'border-line bg-well text-inkmute hover:border-edge hover:text-ink',
                  )}
                >
                  <Upload size={14} />
                  {dragOver ? 'Release to import' : 'Import media'}
                </button>

                <div className="relative flex min-w-0 items-center">
                  <Search size={14} className="pointer-events-none absolute left-2.5 text-inkdim" />
                  <TextInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Search media"
                    aria-label="Search media"
                    className="pl-[30px]"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  {visible.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      selected={asset.id === selected}
                      onSelect={() => setSelected(asset.id)}
                    />
                  ))}
                </div>
                {visible.length === 0 && (
                  <p className="py-8 text-center text-[11.5px] text-inkdim">Nothing matches that search.</p>
                )}
              </div>
            </>
          ) : (
            <EmptyTab tab={tab} />
          )}
        </div>
      </div>
    </section>
  )
}
