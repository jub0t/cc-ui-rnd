// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent, PointerEvent, ReactNode } from 'react'
import {
  AudioLines,
  ChartColumn,
  Check,
  Grid2x2,
  ImageIcon,
  LayoutGrid,
  Search,
  Upload,
  Video,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { clamp } from '../../primitives'
import { Tooltip } from '../../primitives/Tooltip'
import { bytes, duration, timecode } from '../editor/format'
import { Button, TextInput, cn } from '../editor/ui'
import {
  ASSETS,
  CATEGORIES,
  EFFECTS,
  PRIMARY_ACTION,
  RAIL_TITLE,
  TABS,
  TEMPLATES,
  TITLES,
  TRANSITIONS,
} from './catalogue'
import type { Asset, MediaKind, Tab } from './catalogue'
import { EffectFilters, EffectTile, Frame, TemplateTile, TitleTile, TransitionTile, Waveform } from './previews'
import type { WaveShape } from './previews'

/**
 * The editor's top-left browser: a tab strip over a category rail and a
 * content pane, rebuilt on this repo's preset.
 *
 * Four things the reference leaves on the table, and what this does instead:
 *
 *  - every transition is drawn with the same two-circles glyph. Here each tile
 *    plays the transition it names.
 *  - a clip is a static thumbnail. Here hovering a video scrubs it.
 *  - there is no way to search a bin, and no count anywhere. Here the rail
 *    counts every category and the footer reports what the filters left.
 *  - the grid is mouse-only. Here arrow keys walk it.
 */

/* ------------------------------------------------------------------ */
/* Bin items                                                           */
/* ------------------------------------------------------------------ */

/** A catalogue asset, or a file the user actually dropped on the panel. */
interface BinItem extends Asset {
  /** set on imported files, which have no decoded frame to show yet */
  ext?: string
}

const NOUN: Record<Tab, string> = {
  Media: 'clips',
  Text: 'presets',
  Transitions: 'transitions',
  Effects: 'effects',
  Templates: 'templates',
}

/** Names for the footer's "… applied" line, for everything that is not a clip. */
const STATIC_NAMES = new Map<string, string>(
  [...TITLES, ...TRANSITIONS, ...EFFECTS, ...TEMPLATES].map((item) => [item.id, item.name]),
)

const FIRST_CATEGORY = Object.fromEntries(
  TABS.map((tab) => [tab, CATEGORIES[tab][0]?.id ?? 'all']),
) as Record<Tab, string>

const EMPTY_SELECTION = Object.fromEntries(TABS.map((tab) => [tab, [] as string[]])) as Record<Tab, string[]>

const AUDIO_EXT = /\.(wav|mp3|aac|flac|ogg|m4a|aiff?)$/i
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|tiff?|bmp|svg)$/i

function kindOf(file: File): MediaKind {
  if (file.type.startsWith('audio/') || AUDIO_EXT.test(file.name)) return 'audio'
  if (file.type.startsWith('image/') || IMAGE_EXT.test(file.name)) return 'image'
  return 'video'
}

/** Stable-ish hue per filename, so an imported file keeps one colour. */
function hueOf(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360
  return hash
}

const KIND_ICON = { video: Video, audio: AudioLines, image: ImageIcon }

/* ------------------------------------------------------------------ */
/* Tiles                                                               */
/* ------------------------------------------------------------------ */

/**
 * An imported file is deliberately NOT given a generated frame: nothing has
 * been decoded yet, and a landscape drawn from its filename would be a picture
 * of something the file does not contain.
 */
function FileTile({ item }: { item: BinItem }) {
  const Icon = KIND_ICON[item.kind]
  return (
    <span className="absolute inset-0 grid place-items-center bg-[#101014]">
      <span className="flex flex-col items-center gap-1.5">
        <Icon size={18} className="text-inkdim" />
        <span className="rounded-sm bg-field px-1.5 py-px text-[10px] font-medium tracking-wide text-inkmute uppercase">
          {item.ext}
        </span>
      </span>
    </span>
  )
}

function MediaThumb({ item, wave }: { item: BinItem; wave: WaveShape }) {
  const box = useRef<HTMLSpanElement>(null)
  const [scrub, setScrub] = useState<number | null>(null)
  const scrubbable = item.kind === 'video' && item.seconds > 0 && item.ext === undefined

  // Hovering scrubs: the playhead follows the cursor, the badge reports the
  // timecode under it, and the frame itself changes — a scrub that leaves the
  // picture alone is just a moving line.
  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    setScrub(clamp((event.clientX - rect.left) / rect.width, 0, 1))
  }

  const badge = item.seconds > 0 ? duration(item.seconds) : item.kind === 'image' ? 'Still' : '--:--'

  return (
    <span
      ref={box}
      className="absolute inset-0"
      onPointerMove={scrubbable ? onPointerMove : undefined}
      onPointerLeave={() => setScrub(null)}
    >
      {item.ext !== undefined ? (
        <FileTile item={item} />
      ) : item.kind === 'audio' ? (
        <Waveform hue={item.hue} seed={item.seconds + item.hue} shape={wave} />
      ) : (
        <Frame hue={item.hue} seed={item.seconds + item.hue} t={scrub ?? 0.42} />
      )}

      {/* Video is the default in a bin, so badging it marks the norm rather
          than the exception. Only the other two kinds carry a chip. */}
      {item.kind !== 'video' && (
        <span
          className={cn(
            'absolute top-1.5 left-1.5 grid size-[19px] place-items-center rounded-sm',
            // the audio plate is bright now, so its badge has to be the dark
            // thing on it rather than another warm colour that vanishes
            item.kind === 'audio' ? 'bg-black/45 text-white' : 'bg-accent text-onaccent',
          )}
        >
          {item.kind === 'audio' ? <AudioLines size={12} /> : <ImageIcon size={12} />}
        </span>
      )}

      {scrub === null ? (
        <span className="absolute right-1.5 bottom-1.5 rounded-sm bg-black/70 px-1.5 py-px text-[10px] tabular-nums text-white">
          {badge}
        </span>
      ) : (
        <>
          <span
            className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_4px_rgb(0_0_0/0.8)]"
            style={{ left: `${scrub * 100}%` }}
          />
          <span className="absolute bottom-1.5 left-1.5 rounded-sm bg-accent px-1.5 py-px text-[10px] tabular-nums text-onaccent">
            {timecode(item.seconds * scrub)}
          </span>
        </>
      )}
    </span>
  )
}

/** A tiny segmented row of icon toggles. Each one is a Tooltip rather than a
 *  native title: four of them sit side by side, which is exactly the case the
 *  native delay makes unusable. */
function ToggleGroup<T>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; icon: LucideIcon }[]
}) {
  return (
    <div className="flex flex-none items-center gap-px rounded-md bg-well p-0.5 ring-1 ring-line ring-inset">
      {options.map(({ value: option, label, icon: Icon }) => {
        const on = option === value
        return (
          <Tooltip key={label} label={label}>
            <button
              type="button"
              aria-label={label}
              aria-pressed={on}
              onClick={() => onChange(option)}
              className={cn(
                'grid size-6 place-items-center rounded transition-colors focus-visible:ring-1 focus-visible:ring-accent',
                on ? 'bg-field text-ink' : 'text-inkdim hover:text-ink',
              )}
            >
              <Icon size={13} />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}

function Card({
  name,
  meta,
  selected,
  onSelect,
  children,
}: {
  name: string
  meta?: string
  selected: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      data-cell
      title={name}
      aria-pressed={selected}
      onClick={onSelect}
      className="group min-w-0 rounded-md text-left focus-visible:ring-1 focus-visible:ring-accent"
    >
      <div
        className={cn(
          'relative aspect-[16/10] overflow-hidden rounded-md bg-[#08080a] ring-inset transition-shadow',
          selected ? 'ring-2 ring-accent' : 'ring-1 ring-line group-hover:ring-edge',
        )}
      >
        {children}
        {selected && (
          <span className="absolute top-1.5 right-1.5 grid size-[18px] place-items-center rounded-full bg-accent text-onaccent shadow-[0_1px_3px_rgb(0_0_0/0.5)]">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </div>
      <span className="mt-1.5 block truncate text-[11.5px] text-ink">{name}</span>
      {meta !== undefined && (
        <span className="mt-px block truncate text-[10.5px] tabular-nums text-inkdim">{meta}</span>
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

/** Unique per mounted panel: two on one page must not share one <defs>. */
let filterSeq = 0
const makeFilterIds = () => {
  filterSeq += 1
  return { sharpen: `cp-fx-sharpen-${filterSeq}`, wave: `cp-fx-wave-${filterSeq}` }
}

interface Row {
  id: string
  name: string
  meta?: string
  tile: ReactNode
}

export function MediaBrowser() {
  const [tab, setTab] = useState<Tab>('Media')
  const [category, setCategory] = useState<Record<Tab, string>>(FIRST_CATEGORY)
  const [selection, setSelection] = useState<Record<Tab, string[]>>({ ...EMPTY_SELECTION, Media: ['m1'] })
  const [query, setQuery] = useState('')
  const [dense, setDense] = useState(false)
  const [wave, setWave] = useState<WaveShape>('centred')
  const [dragOver, setDragOver] = useState(false)
  const [imported, setImported] = useState<BinItem[]>([])
  const [flash, setFlash] = useState<string | null>(null)
  const [ids] = useState(makeFilterIds)
  const picker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (flash === null) return
    const id = window.setTimeout(() => setFlash(null), 2400)
    return () => window.clearTimeout(id)
  }, [flash])

  const bin = useMemo<BinItem[]>(() => [...imported, ...ASSETS], [imported])
  const active = category[tab]
  const chosen = selection[tab] ?? []
  const cols = dense ? 4 : 3

  const total = tab === 'Media' ? bin.length : tab === 'Text' ? TITLES.length
    : tab === 'Transitions' ? TRANSITIONS.length : tab === 'Effects' ? EFFECTS.length : TEMPLATES.length

  const rows = useMemo<Row[]>(() => {
    const needle = query.trim().toLowerCase()
    const keep = (cat: string, name: string) =>
      (active === 'all' || cat === active) && name.toLowerCase().includes(needle)

    switch (tab) {
      case 'Media':
        return bin
          .filter((item) => keep(item.kind, item.name))
          .map((item) => ({ id: item.id, name: item.name, meta: item.meta, tile: <MediaThumb item={item} wave={wave} /> }))
      case 'Text':
        return TITLES.filter((preset) => keep(preset.category, preset.name)).map((preset) => ({
          id: preset.id,
          name: preset.name,
          meta: preset.meta,
          tile: <TitleTile preset={preset} />,
        }))
      case 'Transitions':
        return TRANSITIONS.filter((item) => keep(item.category, item.name)).map((item) => ({
          id: item.id,
          name: item.name,
          meta: `Default ${item.seconds.toFixed(2)} s`,
          tile: <TransitionTile kind={item.kind} />,
        }))
      case 'Effects':
        return EFFECTS.filter((item) => keep(item.category, item.name)).map((item) => ({
          id: item.id,
          name: item.name,
          meta: item.meta,
          tile: <EffectTile effect={item} ids={ids} />,
        }))
      case 'Templates':
        return TEMPLATES.filter((item) => keep(item.category, item.name)).map((item) => ({
          id: item.id,
          name: item.name,
          meta: item.meta,
          tile: <TemplateTile layout={item.layout} />,
        }))
    }
  }, [tab, active, query, bin, ids, wave])

  const countIn = (id: string) => {
    switch (tab) {
      case 'Media':
        return bin.filter((item) => id === 'all' || item.kind === id).length
      case 'Text':
        return TITLES.filter((item) => item.category === id).length
      case 'Transitions':
        return TRANSITIONS.filter((item) => item.category === id).length
      case 'Effects':
        return EFFECTS.filter((item) => item.category === id).length
      case 'Templates':
        return TEMPLATES.filter((item) => item.category === id).length
    }
  }

  const goToTab = (next: Tab) => {
    setTab(next)
    setFlash(null)
    // A query typed against clips means nothing against effects, and leaving it
    // in place would greet the new tab with an empty grid it did not earn.
    setQuery('')
  }

  const toggle = (id: string) => {
    setFlash(null)
    setSelection((current) => {
      const list = current[tab] ?? []
      const next =
        tab === 'Media'
          ? list.includes(id)
            ? list.filter((entry) => entry !== id)
            : [...list, id]
          : // a clip can take many sources, but only one transition or one
            // template at a time, so those tabs are single-pick
            list.includes(id)
            ? []
            : [id]
      return { ...current, [tab]: next }
    })
  }

  const ingest = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const added: BinItem[] = Array.from(files).map((file, index) => ({
      id: `f${Date.now()}-${index}`,
      name: file.name,
      kind: kindOf(file),
      seconds: 0,
      meta: `${bytes(file.size)} · not decoded`,
      hue: hueOf(file.name),
      ext: (file.name.split('.').pop() ?? 'file').slice(0, 5),
    }))
    setImported((current) => [...added, ...current])
    setCategory((current) => ({ ...current, Media: 'all' }))
    setQuery('')
    setFlash(`Imported ${added.length} file${added.length === 1 ? '' : 's'}`)
  }

  const apply = () => {
    if (chosen.length === 0) return
    if (tab === 'Media') {
      const seconds = chosen.reduce((sum, id) => sum + (bin.find((item) => item.id === id)?.seconds ?? 0), 0)
      setFlash(`${chosen.length} clip${chosen.length === 1 ? '' : 's'} added · ${duration(seconds)}`)
      return
    }
    setFlash(`${STATIC_NAMES.get(chosen[0] ?? '') ?? 'Preset'} applied`)
  }

  const selectedSeconds = chosen.reduce(
    (sum, id) => sum + (bin.find((item) => item.id === id)?.seconds ?? 0),
    0,
  )

  const status =
    flash ??
    (tab === 'Media'
      ? `${rows.length} of ${total} shown${
          chosen.length > 0 ? ` · ${chosen.length} selected · ${duration(selectedSeconds)}` : ''
        }`
      : `${rows.length} of ${total} ${NOUN[tab]}${
          chosen.length > 0 ? ` · ${STATIC_NAMES.get(chosen[0] ?? '') ?? ''} selected` : ''
        }`)

  /** Arrow keys walk the grid. A bin is a grid, so it should behave like one. */
  const onGridKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }
    const step = steps[event.key]
    if (step === undefined && event.key !== 'Home' && event.key !== 'End') return

    const cells = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-cell]'))
    const current = cells.indexOf(document.activeElement as HTMLElement)
    if (current < 0 || cells.length === 0) return

    event.preventDefault()
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? cells.length - 1
      : clamp(current + (step ?? 0), 0, cells.length - 1)
    cells[next]?.focus()
  }

  const onTabKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (direction === 0) return
    event.preventDefault()
    const index = (TABS.indexOf(tab) + direction + TABS.length) % TABS.length
    const next = TABS[index]
    if (next === undefined) return
    goToTab(next)
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus()
  }

  return (
    <section
      data-tw
      className="flex h-[576px] w-full max-w-[880px] flex-col overflow-hidden rounded-panel border border-line bg-panel font-ui text-[13px] text-ink shadow-[0_18px_40px_rgb(0_0_0/0.35)]"
    >
      <EffectFilters ids={ids} />

      {/* Tab strip ---------------------------------------------------- */}
      <div
        role="tablist"
        aria-label="Library"
        onKeyDown={onTabKeys}
        className="relative flex h-[38px] flex-none items-center gap-0.5 border-b border-line px-1.5"
      >
        {TABS.map((name) => {
          const on = name === tab
          return (
            <button
              key={name}
              type="button"
              role="tab"
              id={`cp-lib-tab-${name}`}
              aria-selected={on}
              aria-controls="cp-lib-pane"
              tabIndex={on ? 0 : -1}
              onClick={() => goToTab(name)}
              className={cn(
                'relative h-[26px] rounded px-2.5 text-[11.5px] transition-colors focus-visible:ring-1 focus-visible:ring-accent',
                on ? 'bg-field text-ink' : 'text-inkmute hover:bg-head hover:text-ink',
              )}
            >
              {name}
              {/* the underline stitches the active tab to the pane below it */}
              {on && <span aria-hidden className="absolute inset-x-2.5 -bottom-[7px] h-0.5 rounded-full bg-accent" />}
            </button>
          )
        })}
      </div>

      <div id="cp-lib-pane" role="tabpanel" aria-labelledby={`cp-lib-tab-${tab}`} className="flex min-h-0 flex-1">
        {/* Rail ------------------------------------------------------- */}
        <nav className="flex w-[150px] flex-none flex-col overflow-y-auto border-r border-line py-2">
          <p className="px-3 pb-1.5 text-[10px] font-medium tracking-[0.09em] text-inkdim uppercase">
            {RAIL_TITLE[tab]}
          </p>
          {CATEGORIES[tab].map(({ id, label }) => {
            const on = id === active
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setCategory((current) => ({ ...current, [tab]: id }))}
                className={cn(
                  'relative flex w-full items-center justify-between gap-2 px-3 py-[5px] text-left text-[11.5px] transition-colors focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-inset',
                  on ? 'bg-field text-ink' : 'text-inkmute hover:bg-head hover:text-ink',
                )}
              >
                {on && <span aria-hidden className="absolute inset-y-[3px] left-0 w-0.5 rounded-r-full bg-accent" />}
                <span className="truncate">{label}</span>
                <span className="flex-none tabular-nums text-inkdim">{countIn(id)}</span>
              </button>
            )
          })}
        </nav>

        {/* Content ---------------------------------------------------- */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex-none space-y-2 border-b border-linesoft p-2.5">
            {tab === 'Media' && (
              <>
                <input
                  ref={picker}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    ingest(event.target.files)
                    event.target.value = ''
                  }}
                />
                {/* A drop target that does nothing on drop teaches the user the
                    gesture is dead. This one really takes the files. */}
                <button
                  type="button"
                  onClick={() => picker.current?.click()}
                  onDragOver={(event: DragEvent<HTMLButtonElement>) => {
                    event.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(event: DragEvent<HTMLButtonElement>) => {
                    event.preventDefault()
                    setDragOver(false)
                    ingest(event.dataTransfer.files)
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
              </>
            )}

            <div className="flex items-center gap-1.5">
              <div className="relative flex min-w-0 flex-1 items-center">
                <Search size={14} className="pointer-events-none absolute left-2.5 text-inkdim" />
                <TextInput
                  value={query}
                  onChange={setQuery}
                  placeholder={`Search ${NOUN[tab]}`}
                  aria-label={`Search ${NOUN[tab]}`}
                  className={cn('pl-[30px]', query !== '' && 'pr-7')}
                />
                {query !== '' && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setQuery('')}
                    className="absolute right-1.5 grid size-5 place-items-center rounded text-inkdim hover:text-ink focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {tab === 'Media' && (
                <ToggleGroup
                  value={wave}
                  onChange={setWave}
                  options={[
                    { value: 'centred', label: 'Centred waveform', icon: AudioLines },
                    { value: 'floored', label: 'Floored waveform', icon: ChartColumn },
                  ]}
                />
              )}

              {/* Density, not zoom: a bin is browsed at two speeds — reading
                  names, and recognising pictures. */}
              <ToggleGroup
                value={dense}
                onChange={setDense}
                options={[
                  { value: false, label: 'Comfortable grid', icon: Grid2x2 },
                  { value: true, label: 'Compact grid', icon: LayoutGrid },
                ]}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            {rows.length === 0 ? (
              <div className="grid h-full place-items-center px-6 text-center">
                <div>
                  <p className="text-[11.5px] text-inkmute">Nothing here matches those filters.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setCategory((current) => ({ ...current, [tab]: FIRST_CATEGORY[tab] }))
                    }}
                    className="mt-1.5 rounded text-[11.5px] text-accent hover:underline focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    Reset the search and category
                  </button>
                </div>
              </div>
            ) : (
              <div
                onKeyDown={onGridKeys}
                className={cn('grid gap-2.5', dense ? 'grid-cols-4' : 'grid-cols-3')}
              >
                {rows.map((row) => (
                  <Card
                    key={row.id}
                    name={row.name}
                    meta={row.meta}
                    selected={chosen.includes(row.id)}
                    onSelect={() => toggle(row.id)}
                  >
                    {row.tile}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer --------------------------------------------------------- */}
      <footer className="flex h-[42px] flex-none items-center justify-between gap-3 border-t border-line px-2.5">
        <span
          className={cn(
            'min-w-0 truncate text-[11.5px] tabular-nums',
            flash !== null ? 'text-success' : 'text-inkmute',
          )}
        >
          {status}
        </span>
        <div className="flex flex-none items-center gap-1.5">
          {chosen.length > 0 && (
            <Button variant="ghost" onClick={() => setSelection((current) => ({ ...current, [tab]: [] }))}>
              Clear
            </Button>
          )}
          <Button variant="primary" disabled={chosen.length === 0} onClick={apply}>
            {PRIMARY_ACTION[tab]}
          </Button>
        </div>
      </footer>
    </section>
  )
}
