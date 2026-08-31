/**
 * The sequence model. Everything is in frames — a timeline that stores
 * seconds has to round somewhere, and wherever it rounds is where two clips
 * that look flush turn out to have a gap.
 */

export const FPS = 30

/** Nothing can be trimmed shorter than this. */
export const MIN_LENGTH = 3

export type ClipKind = 'video' | 'audio' | 'image'

export interface Clip {
  id: string
  name: string
  kind: ClipKind
  track: string
  /** first frame on the sequence */
  start: number
  length: number
  /** frames into the source the clip begins at. Trimming the head moves this,
   *  which is what lets the waveform slide under the edge instead of being
   *  redrawn as if the audio itself had changed. */
  offset: number
  hue: number
}

export interface Track {
  id: string
  name: string
  hidden: boolean
  muted: boolean
}

export interface Sequence {
  id: string
  name: string
  /** top to bottom, the way they are drawn */
  tracks: Track[]
  clips: Clip[]
}

const track = (id: string, name: string): Track => ({ id, name, hidden: false, muted: false })

export const SEQUENCES: Sequence[] = [
  {
    id: 'seq1',
    name: 'Timeline 1',
    tracks: [track('v2', 'Track 4'), track('v1', 'Track 3'), track('a2', 'Track 2'), track('a1', 'Track 1')],
    clips: [
      {
        id: 'c1',
        name: 'Protagonist_reviewing_reports_2K.jpeg',
        kind: 'image',
        track: 'v2',
        start: 0,
        length: 52,
        offset: 0,
        hue: 212,
      },
      { id: 'c2', name: 'B_roll_city_dusk.mp4', kind: 'video', track: 'v2', start: 74, length: 116, offset: 0, hue: 334 },
      { id: 'c3', name: 'Drone_pullback_4k.mp4', kind: 'video', track: 'v1', start: 30, length: 120, offset: 0, hue: 194 },
      { id: 'c4', name: 'speech-af_heart-1.wav', kind: 'audio', track: 'a2', start: 0, length: 58, offset: 0, hue: 28 },
      { id: 'c5', name: 'speech-af_heart-2.wav', kind: 'audio', track: 'a2', start: 96, length: 74, offset: 0, hue: 36 },
      { id: 'c6', name: 'room_tone_bar.wav', kind: 'audio', track: 'a1', start: 0, length: 230, offset: 0, hue: 258 },
    ],
  },
  {
    id: 'seq2',
    name: 'Timeline 2',
    tracks: [track('b2', 'Track 2'), track('b1', 'Track 1')],
    clips: [
      { id: 'd1', name: 'Interview_wide_A.mp4', kind: 'video', track: 'b2', start: 12, length: 150, offset: 0, hue: 152 },
      { id: 'd2', name: 'speech-af_heart-1.wav', kind: 'audio', track: 'b1', start: 12, length: 150, offset: 0, hue: 28 },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const pad = (value: number) => String(Math.floor(value)).padStart(2, '0')

/** frames -> hh:mm:ss:ff */
export function timecode(frames: number): string {
  const whole = Math.max(0, Math.round(frames))
  const seconds = Math.floor(whole / FPS)
  return [pad(seconds / 3600), pad((seconds % 3600) / 60), pad(seconds % 60), pad(whole % FPS)].join(':')
}

/**
 * Frames between ruler labels. Steps are whole halves and seconds so the
 * numbers stay round as you zoom — a ruler ticking every 7 frames is a ruler
 * nobody can read a position off.
 */
const STEPS = [1, 2, 5, 10, 15, FPS, FPS * 2, FPS * 5, FPS * 10, FPS * 15, FPS * 30, FPS * 60, FPS * 300]

export function labelStep(pxPerFrame: number, minGap = 92): number {
  return STEPS.find((step) => step * pxPerFrame >= minGap) ?? STEPS[STEPS.length - 1]!
}

/* ------------------------------------------------------------------ */
/* Snapping                                                            */
/* ------------------------------------------------------------------ */

export interface SnapResult {
  /** the value to use, already snapped if anything was in range */
  value: number
  /** the frame that was snapped to, for drawing the indicator */
  line: number | null
}

/**
 * Snaps a clip whose leading edge wants to be at `start`. Both of its edges
 * are candidates, because lining a clip's tail up with the next one's head is
 * the same gesture as lining up its head.
 */
export function snapMove(start: number, length: number, targets: number[], tolerance: number): SnapResult {
  let best: SnapResult = { value: start, line: null }
  let closest = tolerance

  for (const target of targets) {
    for (const offset of [0, length]) {
      const distance = Math.abs(start + offset - target)
      if (distance <= closest) {
        closest = distance
        best = { value: target - offset, line: target }
      }
    }
  }
  return best
}

/** Snaps a single edge being dragged, which has no second candidate. */
export function snapEdge(frame: number, targets: number[], tolerance: number): SnapResult {
  let best: SnapResult = { value: frame, line: null }
  let closest = tolerance

  for (const target of targets) {
    const distance = Math.abs(frame - target)
    if (distance <= closest) {
      closest = distance
      best = { value: target, line: target }
    }
  }
  return best
}

/** Every edge worth landing on, minus the clip doing the moving. */
export function snapTargets(clips: Clip[], exclude: string, playhead: number): number[] {
  const edges = [0, playhead]
  for (const clip of clips) {
    if (clip.id === exclude) continue
    edges.push(clip.start, clip.start + clip.length)
  }
  return edges
}
