// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

/**
 * The catalogue behind the browser. Data only — nothing in here knows how an
 * item is drawn, so adding a tab is one array plus one preview renderer, and
 * the shell keeps working untouched.
 */

export const TABS = ['Media', 'Text', 'Transitions', 'Effects', 'Templates'] as const
export type Tab = (typeof TABS)[number]

export interface Category {
  id: string
  label: string
}

/** The rail's group heading. The reference names it after the tab, not the app. */
export const RAIL_TITLE: Record<Tab, string> = {
  Media: 'Media',
  Text: 'Text',
  Transitions: 'Transitions',
  Effects: 'Video effects',
  Templates: 'Templates',
}

/**
 * Only Media carries an "all" row. Everywhere else the categories partition a
 * small, closed set, and a catch-all row there would just be the whole list
 * filed under a second name.
 */
export const CATEGORIES: Record<Tab, readonly Category[]> = {
  Media: [
    { id: 'all', label: 'All media' },
    { id: 'video', label: 'Video' },
    { id: 'audio', label: 'Audio' },
    { id: 'image', label: 'Images' },
  ],
  Text: [
    { id: 'titles', label: 'Titles' },
    { id: 'lower-thirds', label: 'Lower thirds' },
    { id: 'captions', label: 'Captions' },
  ],
  Transitions: [
    { id: 'basic', label: 'Basic' },
    { id: 'motion', label: 'Motion' },
  ],
  Effects: [
    { id: 'basic', label: 'Basic' },
    { id: 'blur', label: 'Blur' },
    { id: 'color', label: 'Color' },
    { id: 'stylize', label: 'Stylize' },
    { id: 'distort', label: 'Distort' },
  ],
  Templates: [
    { id: 'layouts', label: 'Layouts' },
    { id: 'social', label: 'Social' },
  ],
}

/** What the footer's primary action does, per tab. */
export const PRIMARY_ACTION: Record<Tab, string> = {
  Media: 'Add to timeline',
  Text: 'Insert title',
  Transitions: 'Apply to cut',
  Effects: 'Apply to clip',
  Templates: 'Build timeline',
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

export type MediaKind = 'video' | 'audio' | 'image'

export interface Asset {
  id: string
  name: string
  kind: MediaKind
  /** 0 for stills, which is what makes them stills */
  seconds: number
  meta: string
  /** base hue for the generated frame or waveform — a clip always draws itself */
  hue: number
}

export const ASSETS: readonly Asset[] = [
  { id: 'm1', name: 'Protagonist_review_take3.mp4', kind: 'video', seconds: 184, meta: '1920 x 1080 · 30 fps', hue: 212 },
  { id: 'm2', name: 'speech-af_heart-1.wav', kind: 'audio', seconds: 41, meta: '48 kHz · stereo', hue: 28 },
  { id: 'm3', name: 'speech-af_heart-2.wav', kind: 'audio', seconds: 27, meta: '48 kHz · stereo', hue: 36 },
  { id: 'm4', name: 'B_roll_city_dusk.mp4', kind: 'video', seconds: 96, meta: '3840 x 2160 · 24 fps', hue: 334 },
  { id: 'm5', name: 'Interview_wide_A.mp4', kind: 'video', seconds: 452, meta: '1920 x 1080 · 25 fps', hue: 152 },
  { id: 'm6', name: 'room_tone_bar.wav', kind: 'audio', seconds: 128, meta: '48 kHz · mono', hue: 258 },
  { id: 'm7', name: 'Drone_pullback_4k.mp4', kind: 'video', seconds: 63, meta: '3840 x 2160 · 30 fps', hue: 194 },
  { id: 'm8', name: 'poster_frame_01.png', kind: 'image', seconds: 0, meta: '1920 x 1080 · PNG', hue: 44 },
  { id: 'm9', name: 'logo_lockup.png', kind: 'image', seconds: 0, meta: '1024 x 1024 · PNG', hue: 282 },
]

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

export interface TitlePreset {
  id: string
  name: string
  category: string
  meta: string
  sample: string
  /** second line, for the presets that are two lines by definition */
  sub?: string
  color: string
  /** wash behind the whole tile */
  plate?: string
  /** plate behind the text itself, the way a burned-in caption carries one */
  chip?: string
  size: number
  weight: number
  tracking?: string
  uppercase?: boolean
  align?: 'center' | 'left'
}

export const TITLES: readonly TitlePreset[] = [
  {
    id: 't1',
    name: 'Default title',
    category: 'titles',
    meta: 'Inter · 96 px',
    sample: 'Aa',
    color: '#ff2d6f',
    plate: 'rgb(255 45 111 / 0.12)',
    size: 30,
    weight: 700,
  },
  {
    id: 't2',
    name: 'Hero headline',
    category: 'titles',
    meta: 'Inter · 72 px · tracked',
    sample: 'Headline',
    color: '#ededed',
    size: 15,
    weight: 700,
    tracking: '0.14em',
    uppercase: true,
  },
  {
    id: 't3',
    name: 'Chapter card',
    category: 'titles',
    meta: 'Inter · 54 / 28 px',
    sample: 'Chapter two',
    sub: 'The long way round',
    color: '#f2f2f2',
    plate: 'rgb(10 132 255 / 0.10)',
    size: 13,
    weight: 600,
  },
  {
    id: 't4',
    name: 'Name and role',
    category: 'lower-thirds',
    meta: 'Inter · 40 / 24 px',
    sample: 'Jane Reyes',
    sub: 'Director of photography',
    color: '#ffffff',
    size: 12,
    weight: 600,
    align: 'left',
  },
  {
    id: 't5',
    name: 'Ticker strip',
    category: 'lower-thirds',
    meta: 'Inter · 32 px · plate',
    sample: 'Live from the set',
    color: '#ffffff',
    chip: 'rgb(224 123 51 / 0.9)',
    size: 10,
    weight: 600,
    align: 'left',
    uppercase: true,
  },
  {
    id: 't6',
    name: 'Burned-in caption',
    category: 'captions',
    meta: 'Inter · 38 px · 2 lines',
    sample: 'Do you really think',
    sub: 'you can do that?',
    color: '#ffffff',
    chip: 'rgb(0 0 0 / 0.72)',
    size: 11,
    weight: 600,
  },
]

/* ------------------------------------------------------------------ */
/* Transitions                                                         */
/* ------------------------------------------------------------------ */

export type TransitionKind = 'cross' | 'black' | 'white' | 'wipe' | 'slide' | 'zoom'

export interface Transition {
  id: string
  name: string
  category: string
  kind: TransitionKind
  /** default handle length — the one number a transition really is */
  seconds: number
}

export const TRANSITIONS: readonly Transition[] = [
  { id: 'x1', name: 'Cross fade', category: 'basic', kind: 'cross', seconds: 0.5 },
  { id: 'x2', name: 'Fade to black', category: 'basic', kind: 'black', seconds: 0.75 },
  { id: 'x3', name: 'Fade to white', category: 'basic', kind: 'white', seconds: 0.75 },
  { id: 'x4', name: 'Wipe right', category: 'motion', kind: 'wipe', seconds: 0.4 },
  { id: 'x5', name: 'Slide left', category: 'motion', kind: 'slide', seconds: 0.4 },
  { id: 'x6', name: 'Zoom through', category: 'motion', kind: 'zoom', seconds: 0.6 },
]

/* ------------------------------------------------------------------ */
/* Effects                                                             */
/* ------------------------------------------------------------------ */

export interface Effect {
  id: string
  name: string
  category: string
  /** the headline parameter, so a card says what you would be adjusting */
  meta: string
  /** applied to the sample frame — the card previews the real thing */
  filter?: string
  /** for the two effects no CSS filter function can express */
  svg?: 'sharpen' | 'wave'
  transform?: string
}

export const EFFECTS: readonly Effect[] = [
  { id: 'e1', name: 'Black & white', category: 'basic', meta: 'Amount 100%', filter: 'grayscale(1)' },
  { id: 'e2', name: 'Sepia', category: 'basic', meta: 'Amount 85%', filter: 'sepia(0.85) contrast(1.05)' },
  { id: 'e3', name: 'Invert', category: 'basic', meta: 'Amount 100%', filter: 'invert(1)' },
  { id: 'e4', name: 'Sharpen', category: 'basic', meta: 'Radius 1 px', svg: 'sharpen' },
  { id: 'e5', name: 'Gaussian blur', category: 'blur', meta: 'Radius 3 px', filter: 'blur(3px)' },
  { id: 'e6', name: 'Soft focus', category: 'blur', meta: 'Bloom 40%', filter: 'blur(1.4px) brightness(1.1) contrast(0.92)' },
  { id: 'e7', name: 'Warm grade', category: 'color', meta: 'Temp +18', filter: 'sepia(0.32) saturate(1.5) hue-rotate(-12deg)' },
  { id: 'e8', name: 'Cool grade', category: 'color', meta: 'Temp -22', filter: 'saturate(1.25) hue-rotate(26deg) brightness(0.94)' },
  { id: 'e9', name: 'Bleach bypass', category: 'color', meta: 'Mix 70%', filter: 'contrast(1.55) saturate(0.5) brightness(1.06)' },
  { id: 'e10', name: 'Posterize', category: 'stylize', meta: 'Levels 6', filter: 'contrast(2.4) saturate(1.7)' },
  { id: 'e11', name: 'Duotone', category: 'stylize', meta: 'Shadow to highlight', filter: 'grayscale(1) sepia(1) hue-rotate(185deg) saturate(3.4)' },
  { id: 'e12', name: 'Mirror', category: 'distort', meta: 'Axis vertical', transform: 'scaleX(-1)' },
  { id: 'e13', name: 'Wave', category: 'distort', meta: 'Amplitude 10', svg: 'wave' },
]

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export type TemplateLayout = 'split' | 'pip' | 'title-card' | 'three-up' | 'reel' | 'grid4'

export interface Template {
  id: string
  name: string
  category: string
  meta: string
  layout: TemplateLayout
}

export const TEMPLATES: readonly Template[] = [
  { id: 'p1', name: 'Split screen', category: 'layouts', meta: '16:9 · 2 tracks', layout: 'split' },
  { id: 'p2', name: 'Picture in picture', category: 'layouts', meta: '16:9 · 2 tracks', layout: 'pip' },
  { id: 'p3', name: 'Title card', category: 'layouts', meta: '16:9 · 3 tracks', layout: 'title-card' },
  { id: 'p4', name: 'Three up', category: 'layouts', meta: '16:9 · 3 tracks', layout: 'three-up' },
  { id: 'p5', name: 'Captioned reel', category: 'social', meta: '9:16 · 4 tracks', layout: 'reel' },
  { id: 'p6', name: 'Quad grid', category: 'social', meta: '1:1 · 4 tracks', layout: 'grid4' },
]
