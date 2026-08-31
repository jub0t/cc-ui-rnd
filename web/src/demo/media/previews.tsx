import { useMemo } from 'react'
import { Play } from 'lucide-react'
import { seeded } from '../editor/format'
import { cn } from '../editor/ui'
import type { Effect, TemplateLayout, TitlePreset, TransitionKind } from './catalogue'

/**
 * Every tile a card can hold. They are drawn, not shipped: a bin full of
 * stock JPEGs would weigh more than the whole app and would still be lying
 * about what the clip contains. Generated frames are deterministic, so a clip
 * looks the same on every render, and scrubbing can actually change the frame.
 */

/* ------------------------------------------------------------------ */
/* Frame — the generated "footage" every visual tile is built from      */
/* ------------------------------------------------------------------ */

export function Frame({ hue, seed, t = 0.42 }: { hue: number; seed: number; t?: number }) {
  const ridge = useMemo(() => {
    const random = seeded(seed)
    return Array.from({ length: 9 }, () => 0.26 + random() * 0.64)
  }, [seed])

  // `t` is the position in the clip. A frame at 0:00 and one at the end must
  // not look identical or scrubbing would be theatre, so the sun arcs across
  // and the sky lifts with it — the cheapest honest way to make time visible.
  const clamped = Math.min(1, Math.max(0, t))
  const day = Math.sin(clamped * Math.PI)
  const sunX = 12 + clamped * 74
  const sunY = 62 - day * 42

  return (
    <span className="absolute inset-0 overflow-hidden">
      <span
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, hsl(${hue} 52% ${6 + day * 14}%) 0%, hsl(${hue + 14} 48% ${13 + day * 22}%) 48%, hsl(${hue + 34} 62% ${24 + day * 32}%) 100%)`,
        }}
      />
      <span
        className="absolute size-[30%] rounded-full"
        style={{
          left: `${sunX}%`,
          top: `${sunY}%`,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, hsl(${hue + 46} 95% ${70 + day * 20}%) 0%, hsl(${hue + 40} 92% 62% / 0.5) 42%, transparent 70%)`,
        }}
      />
      <span className="absolute inset-x-0 bottom-[24%] flex h-[48%] items-end">
        {ridge.map((height, index) => (
          <span
            key={index}
            className="flex-1"
            style={{ height: `${height * 100}%`, background: `hsl(${hue} 36% ${4 + day * 5}%)` }}
          />
        ))}
      </span>
      <span
        className="absolute inset-x-0 bottom-0 h-[24%]"
        style={{ background: `linear-gradient(180deg, hsl(${hue} 30% ${7 + day * 5}%), hsl(${hue} 26% 3%))` }}
      />
      {/* no lens lights its corners as brightly as its middle */}
      <span
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 45%, transparent 38%, rgb(0 0 0 / 0.5) 100%)' }}
      />
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Waveform — two card designs                                         */
/* ------------------------------------------------------------------ */

export type WaveShape = 'centred' | 'floored'

/** Deterministic samples. Density belongs to each design, so it is a param. */
function useSamples(seed: number, count: number) {
  return useMemo(() => {
    const random = seeded(seed)
    return Array.from({ length: count }, (_, index) => {
      // a speech-shaped envelope: quiet at the head and tail, busy through
      // the middle, so the two designs are drawing something plausible
      const envelope = Math.sin((index / (count - 1)) * Math.PI) * 0.55 + 0.45
      return Math.max(0.08, random() * envelope)
    })
  }, [seed, count])
}

/**
 * The old audio card was a dark plate under a light trace, which put the
 * loudest part of the clip on the darkest pixels and made a bin full of audio
 * look like a power cut. Both designs below invert that: a saturated plate
 * carries the clip's identity, and the signal is cut into it in a deep ink of
 * the same hue, the way a printed waveform reads.
 */
export function Waveform({ hue, seed, shape }: { hue: number; seed: number; shape: WaveShape }) {
  return shape === 'centred' ? <WaveCentred hue={hue} seed={seed} /> : <WaveFloored hue={hue} seed={seed} />
}

/** Design one: a single filled envelope mirrored about the midline. It is
 *  continuous, which is what makes it read as a signal rather than a chart. */
function WaveCentred({ hue, seed }: { hue: number; seed: number }) {
  const samples = useSamples(seed, 64)
  const ink = `hsl(${hue} 92% 18%)`

  const path = useMemo(() => {
    const last = samples.length - 1
    const stepX = 100 / last
    const top = samples.map((height, index) => `${(index * stepX).toFixed(2)} ${(20 - height * 16.5).toFixed(2)}`)
    const bottom: string[] = []
    for (let index = last; index >= 0; index -= 1) {
      bottom.push(`${(index * stepX).toFixed(2)} ${(20 + (samples[index] ?? 0) * 16.5).toFixed(2)}`)
    }
    return `M ${top.join(' L ')} L ${bottom.join(' L ')} Z`
  }, [samples])

  return (
    <>
      <span
        className="absolute inset-0"
        style={{
          background: `linear-gradient(145deg, hsl(${hue} 96% 64%), hsl(${hue + 10} 90% 53%) 58%, hsl(${hue + 16} 86% 46%))`,
        }}
      />
      {/* a sheen off the top edge, so the plate reads as lit rather than flat */}
      <span
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgb(255 255 255 / 0.22), transparent 42%)' }}
      />
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
        {/* edge to edge, so a quiet head and tail still show a line */}
        <line x1="0" y1="20" x2="100" y2="20" stroke={ink} strokeOpacity="0.45" strokeWidth="0.5" />
        <path d={path} fill={ink} fillOpacity="0.88" />
      </svg>
    </>
  )
}

/** Design two: discrete pillars standing on a floor. Every bar starts from the
 *  same line, which makes levels easier to compare across clips. */
function WaveFloored({ hue, seed }: { hue: number; seed: number }) {
  const samples = useSamples(seed, 28)
  const ink = `hsl(${hue} 94% 16%)`
  const slot = 100 / samples.length
  const width = slot * 0.56
  const floor = 36.5

  return (
    <>
      <span
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, hsl(${hue} 97% 67%), hsl(${hue + 8} 89% 49%))` }}
      />
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
        {samples.map((height, index) => {
          const tall = Math.max(1.6, height * 31)
          return (
            <rect
              key={index}
              x={index * slot + (slot - width) / 2}
              y={floor - tall}
              width={width}
              height={tall}
              rx="0.4"
              fill={ink}
              fillOpacity="0.86"
            />
          )
        })}
        {/* the floor they stand on: without it the pillars just hang there */}
        <line x1="0" y1={floor + 0.7} x2="100" y2={floor + 0.7} stroke={ink} strokeOpacity="0.5" strokeWidth="0.9" />
      </svg>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Title                                                               */
/* ------------------------------------------------------------------ */

export function TitleTile({ preset }: { preset: TitlePreset }) {
  const left = preset.align === 'left'

  const line = (text: string, size: number, weight: number, dim = false) => (
    <span
      className="max-w-full truncate"
      style={{
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.3,
        color: preset.color,
        opacity: dim ? 0.72 : 1,
        letterSpacing: preset.tracking,
        textTransform: preset.uppercase ? 'uppercase' : undefined,
        background: preset.chip,
        padding: preset.chip ? '1px 5px' : undefined,
        borderRadius: preset.chip ? 3 : undefined,
        // without a plate the text has to survive whatever frame is under it
        textShadow: preset.chip ? undefined : '0 1px 4px rgb(0 0 0 / 0.65)',
      }}
    >
      {text}
    </span>
  )

  return (
    <span
      className={cn('absolute inset-0 flex flex-col justify-center gap-[3px] px-3', left ? 'items-start' : 'items-center')}
      style={{ background: preset.plate ?? 'linear-gradient(180deg, #15151b, #0a0a0d)' }}
    >
      {line(preset.sample, preset.size, preset.weight)}
      {preset.sub !== undefined && line(preset.sub, Math.max(8, preset.size * 0.62), 400, true)}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Transition                                                          */
/* ------------------------------------------------------------------ */

/**
 * The reference draws every transition with the same two-overlapping-circles
 * glyph, which means the card tells you nothing you did not already read in
 * the label. Here the tile plays the actual transition on hover between two
 * deliberately unalike frames, so a wipe and a slide are distinguishable
 * without reading either name.
 */
export function TransitionTile({ kind }: { kind: TransitionKind }) {
  const veil = kind === 'black' ? '#000' : kind === 'white' ? '#fff' : null

  const motion =
    kind === 'cross'
      ? 'opacity-0 group-hover:opacity-100'
      : kind === 'wipe'
        ? '[clip-path:inset(0_100%_0_0)] group-hover:[clip-path:inset(0_0_0_0)]'
        : kind === 'slide'
          ? 'translate-x-full group-hover:translate-x-0'
          : 'scale-[1.7] opacity-0 group-hover:scale-100 group-hover:opacity-100'

  return (
    <>
      <Frame hue={210} seed={11} t={0.28} />

      {veil !== null ? (
        <span
          className="absolute inset-0 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 motion-reduce:transition-none"
          style={{ background: veil }}
        />
      ) : (
        <span
          className={cn(
            'absolute inset-0 transition-all duration-500 ease-out motion-reduce:transition-none',
            motion,
          )}
        >
          <Frame hue={30} seed={5} t={0.66} />
        </span>
      )}

      {/* the tile does something on hover, so it has to say so before you hover */}
      <span className="absolute inset-0 grid place-items-center transition-opacity duration-200 group-hover:opacity-0">
        <span className="grid size-[26px] place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/25 ring-inset">
          <Play size={11} fill="currentColor" />
        </span>
      </span>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Effect                                                              */
/* ------------------------------------------------------------------ */

export interface FilterIds {
  sharpen: string
  wave: string
}

/**
 * Two of these cannot be written as a CSS filter function, so the panel ships
 * the SVG for them. A real convolve kernel is a truer preview of Sharpen than
 * a contrast bump pretending to be one.
 */
export function EffectFilters({ ids }: { ids: FilterIds }) {
  return (
    <svg className="pointer-events-none absolute size-0" aria-hidden focusable="false">
      <defs>
        <filter id={ids.sharpen}>
          <feConvolveMatrix order="3" preserveAlpha="true" kernelMatrix="0 -1 0  -1 5 -1  0 -1 0" />
        </filter>
        <filter id={ids.wave}>
          <feTurbulence type="turbulence" baseFrequency="0.014 0.05" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  )
}

export function EffectTile({ effect, ids }: { effect: Effect; ids: FilterIds }) {
  // One frame for every card: when the source is held constant the only thing
  // that differs between two tiles is the effect, which is the whole point.
  return (
    <span
      className="absolute inset-0"
      style={{ filter: effect.svg ? `url(#${ids[effect.svg]})` : effect.filter, transform: effect.transform }}
    >
      <Frame hue={198} seed={23} t={0.5} />
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Template                                                            */
/* ------------------------------------------------------------------ */

const PLATE = 'rounded-[3px] bg-[#23232b]'
const HERO = 'rounded-[3px] bg-accent/35 ring-1 ring-accent/50 ring-inset'

export function TemplateTile({ layout }: { layout: TemplateLayout }) {
  const body = () => {
    switch (layout) {
      case 'split':
        return (
          <div className="grid size-full grid-cols-2 gap-1.5">
            <span className={HERO} />
            <span className={PLATE} />
          </div>
        )
      case 'pip':
        return (
          <div className="relative size-full">
            <span className={cn(HERO, 'absolute inset-0')} />
            <span className={cn(PLATE, 'absolute right-1.5 bottom-1.5 h-[38%] w-[32%] ring-1 ring-black/50')} />
          </div>
        )
      case 'title-card':
        return (
          <div className="relative size-full">
            <span className={cn(PLATE, 'absolute inset-0')} />
            <span className={cn(HERO, 'absolute top-[38%] left-[14%] h-[13%] w-[52%]')} />
            <span className={cn(PLATE, 'absolute top-[58%] left-[14%] h-[9%] w-[34%] bg-[#33333d]')} />
          </div>
        )
      case 'three-up':
        return (
          <div className="grid size-full grid-cols-3 gap-1.5">
            <span className={PLATE} />
            <span className={HERO} />
            <span className={PLATE} />
          </div>
        )
      case 'reel':
        return (
          <div className="grid size-full place-items-center">
            <div className="relative h-full aspect-[9/16]">
              <span className={cn(HERO, 'absolute inset-0')} />
              <span className={cn(PLATE, 'absolute inset-x-1 bottom-1.5 h-[12%] bg-black/70')} />
            </div>
          </div>
        )
      case 'grid4':
        return (
          <div className="grid size-full grid-cols-2 grid-rows-2 gap-1.5">
            <span className={HERO} />
            <span className={PLATE} />
            <span className={PLATE} />
            <span className={PLATE} />
          </div>
        )
    }
  }

  return <span className="absolute inset-0 bg-[#0e0e12] p-2.5">{body()}</span>
}
