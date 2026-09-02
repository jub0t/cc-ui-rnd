// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useMemo } from 'react'
import { clamp } from '../../primitives'
import type { WaveShape } from '../media/previews'

/**
 * The waveform drawn on a timeline clip.
 *
 * The bin's card waveform is the wrong tool here and looked it: a fixed 64
 * samples stretched across whatever width the clip happened to be, in a
 * viewBox that did not match its aspect, so the shape smeared into blobs and
 * the detail went with it. Two things fix that.
 *
 * First, density follows the pixels — roughly one sample every 2.5px, so a
 * clip has as much detail as there is room to show, at any zoom.
 *
 * Second, and the part that actually matters: amplitude is a function of the
 * *source* frame, not of the clip. Trim a clip's head and the wave slides
 * under the edge instead of regenerating; split one and the halves still line
 * up. A waveform that reshuffles while you drag its edge is worse than no
 * waveform, because it looks like the audio changed.
 */

/** Deterministic 0..1 from a seed and a position. */
function hash(seed: number, n: number): number {
  let x = (Math.round(n) + seed * 374761393) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

/** Speech-ish: phrases that swell and drop, syllables inside them, grain on top. */
function amplitude(seed: number, frame: number): number {
  const phase = seed * 0.017
  const phrase = Math.sin(frame * 0.021 + phase) * 0.5 + 0.5
  // near-silence between phrases, so the clip has breathing room in it
  const gate = phrase < 0.18 ? phrase / 0.18 : 1
  const syllable = Math.sin(frame * 0.34 + phase * 5) * 0.5 + 0.5
  return clamp(gate * (0.25 + 0.75 * syllable) * (0.45 + 0.75 * hash(seed, frame)), 0.02, 1)
}

export function TimelineWave({
  hue,
  seed,
  offset,
  length,
  width,
  height,
  shape,
}: {
  hue: number
  seed: number
  /** frames into the source that this clip starts at */
  offset: number
  length: number
  width: number
  height: number
  shape: WaveShape
}) {
  const ink = `hsl(${hue} 74% 24%)`

  const path = useMemo(() => {
    if (width < 2 || height < 2) return ''
    const count = clamp(Math.round(width / 2.5), 6, 1200)
    const perSample = length / count

    // Peak over a few sub-samples: at a low zoom one pixel covers many frames,
    // and picking one of them at random is how a waveform gets the shimmer.
    const peak = (index: number) => {
      const from = offset + index * perSample
      let top = 0
      for (let k = 0; k < 3; k += 1) top = Math.max(top, amplitude(seed, from + perSample * (k / 3)))
      return top
    }

    if (shape === 'floored') {
      const slot = width / count
      const bar = Math.max(1, slot * 0.62)
      let d = ''
      for (let index = 0; index < count; index += 1) {
        const tall = Math.max(1, peak(index) * (height - 2))
        const x = index * slot + (slot - bar) / 2
        d += `M${x.toFixed(1)} ${height}v${-tall.toFixed(1)}h${bar.toFixed(1)}V${height}z`
      }
      return d
    }

    const middle = height / 2
    const reach = height / 2 - 1
    const top: string[] = []
    const bottom: string[] = []
    for (let index = 0; index <= count; index += 1) {
      const x = ((index / count) * width).toFixed(1)
      const a = peak(Math.min(index, count - 1)) * reach
      top.push(`${x} ${(middle - a).toFixed(1)}`)
      bottom.unshift(`${x} ${(middle + a).toFixed(1)}`)
    }
    return `M${top.join('L')}L${bottom.join('L')}Z`
  }, [width, height, length, offset, seed, shape])

  return (
    <>
      <span
        className="cp-wave-plate"
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, hsl(${hue} 84% 58%), hsl(${hue} 78% 47%))`,
        }}
      />
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        viewBox={`0 0 ${Math.max(2, width)} ${Math.max(2, height)}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {shape === 'centred' && (
          <line
            x1="0"
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke={ink}
            strokeOpacity="0.4"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path d={path} fill={ink} fillOpacity="0.9" />
      </svg>
    </>
  )
}
