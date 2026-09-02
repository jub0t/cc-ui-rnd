// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

/**
 * Filter and effect presets, and the parameters each one exposes. Data only:
 * the stack renders whatever params a preset declares, so adding a processor
 * is one entry here and no change to the panel.
 */

export interface ParamSpec {
  id: string
  label: string
  min: number
  max: number
  step: number
  /** the value a fresh instance starts at, and what double-click restores */
  value: number
  /** the readout beside the label, in the unit a person actually thinks in */
  format: (value: number) => string
}

export interface Preset {
  id: string
  name: string
  group: string
  params: ParamSpec[]
}

export interface Group {
  id: string
  label: string
}

/* --- parameter factories ------------------------------------------------ */

const percent = (id: string, label: string, value: number): ParamSpec => ({
  id,
  label,
  min: 0,
  max: 100,
  step: 1,
  value,
  format: (v) => `${Math.round(v)}%`,
})

const amount = (value: number) => percent('amount', 'Amount', value)

/**
 * Zero is not "no pitch shift is happening", it is "let the filter pick" — so
 * the readout says auto rather than a number that would read as an edit.
 */
const pitch = (): ParamSpec => ({
  id: 'pitch',
  label: 'Pitch',
  min: 0,
  max: 12,
  step: 1,
  value: 0,
  format: (v) => (v === 0 ? 'auto' : `+${v} st`),
})

const seconds = (id: string, label: string, value: number, max: number): ParamSpec => ({
  id,
  label,
  min: 0,
  max,
  step: 0.1,
  value,
  format: (v) => (v === 0 ? 'off' : `${v.toFixed(1)} s`),
})

const millis = (id: string, label: string, value: number, max: number): ParamSpec => ({
  id,
  label,
  min: 0,
  max,
  step: 5,
  value,
  format: (v) => (v === 0 ? 'off' : `${Math.round(v)} ms`),
})

const hertz = (id: string, label: string, value: number, min: number, max: number): ParamSpec => ({
  id,
  label,
  min,
  max,
  step: 10,
  value,
  format: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`),
})

const decibels = (id: string, label: string, value: number, min: number, max: number): ParamSpec => ({
  id,
  label,
  min,
  max,
  step: 0.5,
  value,
  format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`,
})

const times = (id: string, label: string, value: number, max: number): ParamSpec => ({
  id,
  label,
  min: 1,
  max,
  step: 0.5,
  value,
  format: (v) => `${v.toFixed(1)} : 1`,
})

const rateHz = (id: string, label: string, value: number, max: number): ParamSpec => ({
  id,
  label,
  min: 0.1,
  max,
  step: 0.1,
  value,
  format: (v) => `${v.toFixed(1)} Hz`,
})

const steps = (id: string, label: string, value: number, min: number, max: number): ParamSpec => ({
  id,
  label,
  min,
  max,
  step: 1,
  value,
  format: (v) => `${Math.round(v)}`,
})

/* --- filters ------------------------------------------------------------ */

export const FILTER_GROUPS: readonly Group[] = [
  { id: 'voice', label: 'Voice' },
  { id: 'tone', label: 'Tone' },
  { id: 'space', label: 'Space' },
]

export const FILTERS: readonly Preset[] = [
  { id: 'sweet', name: 'Sweet', group: 'voice', params: [amount(65), pitch()] },
  { id: 'deep', name: 'Deep', group: 'voice', params: [amount(70), pitch()] },
  { id: 'chipmunk', name: 'Chipmunk', group: 'voice', params: [amount(80), pitch()] },
  { id: 'robot', name: 'Robot', group: 'voice', params: [amount(60), hertz('carrier', 'Carrier', 120, 40, 400)] },

  { id: 'warm', name: 'Warm', group: 'tone', params: [amount(50), decibels('tilt', 'Tilt', -2, -12, 12)] },
  { id: 'bright', name: 'Bright', group: 'tone', params: [amount(45), decibels('tilt', 'Tilt', 3, -12, 12)] },
  { id: 'telephone', name: 'Telephone', group: 'tone', params: [amount(100), hertz('band', 'Band', 1800, 300, 4000)] },
  { id: 'radio', name: 'Radio', group: 'tone', params: [amount(75), percent('noise', 'Noise', 12)] },

  { id: 'room', name: 'Room', group: 'space', params: [amount(30), seconds('decay', 'Decay', 0.6, 8)] },
  { id: 'hall', name: 'Hall', group: 'space', params: [amount(40), seconds('decay', 'Decay', 2.2, 8)] },
  { id: 'plate', name: 'Plate', group: 'space', params: [amount(35), seconds('decay', 'Decay', 1.4, 8)] },
  { id: 'cathedral', name: 'Cathedral', group: 'space', params: [amount(55), seconds('decay', 'Decay', 5, 8)] },
]

/* --- effects ------------------------------------------------------------ */

export const EFFECT_GROUPS: readonly Group[] = [
  { id: 'dynamics', label: 'Dynamics' },
  { id: 'time', label: 'Time' },
  { id: 'colour', label: 'Colour' },
]

export const EFFECTS: readonly Preset[] = [
  {
    id: 'compressor',
    name: 'Compressor',
    group: 'dynamics',
    params: [decibels('threshold', 'Threshold', -18, -60, 0), times('ratio', 'Ratio', 4, 20)],
  },
  {
    id: 'limiter',
    name: 'Limiter',
    group: 'dynamics',
    params: [decibels('ceiling', 'Ceiling', -1, -12, 0), millis('release', 'Release', 60, 500)],
  },
  {
    id: 'gate',
    name: 'Noise gate',
    group: 'dynamics',
    params: [decibels('threshold', 'Threshold', -42, -80, 0), millis('hold', 'Hold', 120, 1000)],
  },
  {
    id: 'deesser',
    name: 'De-esser',
    group: 'dynamics',
    params: [amount(45), hertz('centre', 'Centre', 6500, 2000, 12000)],
  },

  {
    id: 'delay',
    name: 'Delay',
    group: 'time',
    params: [millis('time', 'Time', 320, 1500), percent('feedback', 'Feedback', 28)],
  },
  {
    id: 'echo',
    name: 'Echo',
    group: 'time',
    params: [millis('time', 'Time', 500, 2000), steps('repeats', 'Repeats', 3, 1, 12)],
  },
  {
    id: 'stutter',
    name: 'Stutter',
    group: 'time',
    params: [rateHz('rate', 'Rate', 8, 24), percent('depth', 'Depth', 70)],
  },
  {
    id: 'reverse',
    name: 'Reverse',
    group: 'time',
    params: [amount(100), millis('crossfade', 'Crossfade', 40, 400)],
  },

  {
    id: 'saturator',
    name: 'Saturator',
    group: 'colour',
    params: [percent('drive', 'Drive', 35), percent('mix', 'Mix', 100)],
  },
  {
    id: 'bitcrush',
    name: 'Bitcrush',
    group: 'colour',
    params: [steps('bits', 'Bits', 12, 2, 16), percent('mix', 'Mix', 60)],
  },
  {
    id: 'chorus',
    name: 'Chorus',
    group: 'colour',
    params: [rateHz('rate', 'Rate', 1.2, 8), percent('depth', 'Depth', 40)],
  },
  {
    id: 'flanger',
    name: 'Flanger',
    group: 'colour',
    params: [rateHz('rate', 'Rate', 0.4, 8), percent('feedback', 'Feedback', 55)],
  },
]
