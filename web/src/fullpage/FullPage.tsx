import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minus, Settings2, Sun, Upload, X } from 'lucide-react'
import { EffectsPanel } from '../demo/EffectsPanel'
import { InterpolationPanel } from '../demo/InterpolationPanel'
import { TransformPanel } from '../demo/TransformPanel'
import { cn } from '../demo/editor/ui'
import { Browser } from './Browser'
import { Details } from './Details'
import { ProgramMonitor } from './ProgramMonitor'
import { Splitter } from './Splitter'
import { Timeline } from './Timeline'
import styles from './fullpage.module.css'

/**
 * The WolfCut editor window, scaffolded on one page.
 *
 * The inspector rail renders EffectsPanel / TransformPanel / InterpolationPanel
 * straight from the index page — the point being that panels built in isolation
 * drop into a real editor shell. They are rendered *flush* (see
 * fullpage.module.css): their own border, radius, shadow and fixed width are
 * stripped so their rows sit inside the rail rather than as a card within a
 * card. The index page keeps them as standalone cards, untouched.
 *
 * Region sizes follow the reference window; every divider is draggable.
 */

const DURATION = 81
const MEDIA_COUNT = 6
const TRACK_COUNT = 4
const CLIP_COUNT = 3

const INSPECTORS = [
  { id: 'details', label: 'Details' },
  { id: 'transform', label: 'Transform' },
  { id: 'effects', label: 'Effects' },
  { id: 'ease', label: 'Ease' },
] as const

const MENUS = ['File', 'Edit', 'View']

function ChromeButton({
  label,
  accent,
  children,
}: {
  label: string
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'grid size-7 place-items-center rounded-md transition-colors focus-visible:ring-1 focus-visible:ring-accent',
        accent ? 'text-ink hover:bg-field' : 'text-inkmute hover:bg-field hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

/** Simulated programme level, so the monitor's meter has something to show. */
function useLevel(playing: boolean) {
  const [level, setLevel] = useState(0)
  const [peak, setPeak] = useState(0)

  useEffect(() => {
    if (!playing) {
      setLevel(0)
      setPeak(0)
      return
    }
    let raf = 0
    let current = 0
    let held = 0
    let heldUntil = 0
    const tick = (now: number) => {
      const target = 0.42 + Math.sin(now / 380) * 0.2 + Math.random() * 0.22
      // fast attack, slow release, the way a programme meter behaves
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
  }, [playing])

  return { level, peak }
}

export function FullPage() {
  const [inspector, setInspector] = useState<(typeof INSPECTORS)[number]['id']>('details')
  const [playhead, setPlayhead] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [guides, setGuides] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [timelineZoom, setTimelineZoom] = useState(11)

  // Pane sizes live here so every divider is a controlled drag.
  const [browserWidth, setBrowserWidth] = useState(416)
  const [inspectorWidth, setInspectorWidth] = useState(300)
  const [timelineHeight, setTimelineHeight] = useState(342)

  const { level, peak } = useLevel(playing)

  // Playback advances the playhead in real time; the timeline and the monitor
  // read the same value, so they cannot disagree.
  const last = useRef(0)
  useEffect(() => {
    if (!playing) return
    let raf = 0
    last.current = performance.now()
    const tick = (now: number) => {
      const delta = (now - last.current) / 1000
      last.current = now
      setPlayhead((current) => {
        const next = current + delta
        if (next < DURATION) return next
        setPlaying(false)
        return DURATION
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  return (
    <div data-tw className="flex h-screen flex-col overflow-hidden bg-[#0c0c0c] font-ui text-ink">
      {/* Title bar ---------------------------------------------------- */}
      <header className="relative flex h-[30px] flex-none items-center gap-3 px-2.5">
        <span className="flex items-center gap-1.5">
          <span className="grid size-[15px] place-items-center rounded-[4px] bg-accent text-[9px] font-bold text-white">
            W
          </span>
          <span className="text-[12px] font-semibold tracking-tight">WolfCut</span>
        </span>

        <nav className="flex items-center gap-0.5">
          {MENUS.map((menu) => (
            <button
              key={menu}
              type="button"
              className="rounded px-2 py-0.5 text-[11.5px] text-inkmute transition-colors hover:bg-field hover:text-ink focus-visible:ring-1 focus-visible:ring-accent"
            >
              {menu}
            </button>
          ))}
        </nav>

        {/* Centred on the window, not on the space between the neighbours. */}
        <span className="absolute left-1/2 flex -translate-x-1/2 items-baseline gap-1.5">
          <span className="text-[12px] text-ink">Untitled project</span>
          <span className="text-[10px] text-inkdim">saved</span>
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          <ChromeButton label="Settings"><Settings2 size={14} /></ChromeButton>
          <ChromeButton label="Appearance"><Sun size={14} /></ChromeButton>
          <button
            type="button"
            className="mx-1.5 inline-flex h-[26px] items-center gap-1.5 rounded-md bg-accent px-2.5 text-[11.5px] font-medium text-white transition-colors hover:bg-accenthi focus-visible:ring-1 focus-visible:ring-accent"
          >
            <Upload size={13} />
            Export
          </button>
          <ChromeButton label="Minimise"><Minus size={14} /></ChromeButton>
          <ChromeButton label="Maximise"><Maximize2 size={12} /></ChromeButton>
          <ChromeButton label="Close"><X size={14} /></ChromeButton>
        </div>
      </header>

      {/* Upper half: browser | monitor | inspector -------------------- */}
      <div className="flex min-h-0 flex-1 px-1.5 pt-1.5">
        <div style={{ width: browserWidth }} className="flex min-h-0 flex-none">
          <Browser />
        </div>

        <Splitter
          axis="x"
          value={browserWidth}
          min={260}
          max={620}
          onChange={setBrowserWidth}
          aria-label="Resize media browser"
        />

        <ProgramMonitor
          playhead={playhead}
          duration={DURATION}
          playing={playing}
          onScrub={setPlayhead}
          onTogglePlay={() => setPlaying((p) => !p)}
          guides={guides}
          onGuidesChange={setGuides}
          zoom={zoom}
          onZoomChange={setZoom}
          level={level}
          peak={peak}
        />

        <Splitter
          axis="x"
          value={inspectorWidth}
          min={240}
          max={520}
          invert
          onChange={setInspectorWidth}
          aria-label="Resize inspector"
        />

        <aside
          style={{ width: inspectorWidth }}
          className="flex min-h-0 flex-none flex-col overflow-hidden rounded-panel border border-line bg-panel"
        >
          <div className="flex h-[34px] flex-none items-center gap-0.5 border-b border-line px-1.5">
            {INSPECTORS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={inspector === id}
                onClick={() => setInspector(id)}
                className={cn(
                  'rounded px-2 py-1 text-[11.5px] transition-colors focus-visible:ring-1 focus-visible:ring-accent',
                  inspector === id ? 'bg-field text-ink' : 'text-inkmute hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {inspector === 'details' ? (
            <Details duration={DURATION} tracks={TRACK_COUNT} clips={CLIP_COUNT} media={MEDIA_COUNT} />
          ) : (
            /* `flush` strips each panel's standalone card chrome so its rows
               sit directly in this rail. */
            <div className={cn(styles.flush, 'min-h-0 flex-1 overflow-y-auto')}>
              {inspector === 'transform' && <TransformPanel />}
              {inspector === 'effects' && <EffectsPanel />}
              {inspector === 'ease' && <InterpolationPanel />}
            </div>
          )}
        </aside>
      </div>

      {/* Sits in the same 6px gutter as the panels, so the gap between the
          monitor and the timeline matches every other gap. */}
      <div className="px-1.5">
        <Splitter
          axis="y"
          value={timelineHeight}
          min={180}
          max={620}
          invert
          onChange={setTimelineHeight}
          aria-label="Resize timeline"
        />
      </div>

      {/* Timeline ----------------------------------------------------- */}
      <div style={{ height: timelineHeight }} className="flex min-h-0 flex-none px-1.5 pb-1.5">
        <Timeline
          playhead={playhead}
          duration={DURATION}
          onScrub={setPlayhead}
          zoom={timelineZoom}
          onZoomChange={setTimelineZoom}
        />
      </div>
    </div>
  )
}
