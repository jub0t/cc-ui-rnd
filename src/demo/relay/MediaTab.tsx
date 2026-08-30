import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { AudioLines, Check, Search, Upload, Video } from 'lucide-react'
import { SegmentedControl, clamp, cx } from '../../primitives'
import { duration, seeded, timecode } from './format'
import controls from './controls.module.css'
import shell from './relay.module.css'
import styles from './tabs.module.css'

type Kind = 'video' | 'audio'

interface Asset {
  id: string
  name: string
  kind: Kind
  seconds: number
  /** two-stop gradient standing in for a real poster frame */
  tint: [string, string]
}

const ASSETS: Asset[] = [
  { id: 'a1', name: 'Protagonist_review_take3.mp4', kind: 'video', seconds: 184, tint: ['#3d5a80', '#1b2838'] },
  { id: 'a2', name: 'speech-af_heart-1.wav', kind: 'audio', seconds: 41, tint: ['#5a3d2b', '#241a14'] },
  { id: 'a3', name: 'B_roll_city_dusk.mp4', kind: 'video', seconds: 96, tint: ['#7a4a5c', '#2c1a22'] },
  { id: 'a4', name: 'Interview_wide_A.mp4', kind: 'video', seconds: 452, tint: ['#3f6b52', '#16241d'] },
  { id: 'a5', name: 'room_tone_bar.wav', kind: 'audio', seconds: 128, tint: ['#4a4a6b', '#1c1c2a'] },
  { id: 'a6', name: 'Drone_pullback_4k.mp4', kind: 'video', seconds: 63, tint: ['#2f5f6b', '#132428'] },
  { id: 'a7', name: 'vo_final_mix.wav', kind: 'audio', seconds: 217, tint: ['#6b5330', '#282013'] },
  { id: 'a8', name: 'Cutaway_hands_closeup.mp4', kind: 'video', seconds: 28, tint: ['#66435f', '#241a23'] },
]

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
] as const

/** Deterministic bars, so a given clip always draws the same waveform. */
function Waveform({ id, seconds }: { id: string; seconds: number }) {
  const bars = useMemo(() => {
    const random = seeded(id.charCodeAt(1) + seconds)
    return Array.from({ length: 42 }, (_, i) => {
      const envelope = Math.sin((i / 41) * Math.PI) * 0.55 + 0.45
      return Math.max(0.12, random() * envelope)
    })
  }, [id, seconds])

  return (
    <svg className={styles.waveform} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
      {bars.map((height, index) => (
        <rect
          key={index}
          x={index * 2.38 + 0.5}
          y={20 - height * 18}
          width={1.5}
          height={height * 36}
          rx={0.7}
          fill="rgb(255 255 255 / 0.5)"
        />
      ))}
    </svg>
  )
}

function AssetCard({
  asset,
  selected,
  onToggle,
}: {
  asset: Asset
  selected: boolean
  onToggle: () => void
}) {
  const thumbRef = useRef<HTMLDivElement>(null)
  const [scrub, setScrub] = useState<number | null>(null)

  // Hovering scrubs the clip: the playhead follows the cursor and the badge
  // reports the timecode under it. Costs nothing, reads as alive.
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = thumbRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    setScrub(clamp((event.clientX - rect.left) / rect.width, 0, 1))
  }

  const isVideo = asset.kind === 'video'

  return (
    <button
      type="button"
      className={cx(styles.card, selected && styles.cardSelected)}
      aria-pressed={selected}
      onClick={onToggle}
    >
      <div
        ref={thumbRef}
        className={styles.thumb}
        onPointerMove={isVideo ? onPointerMove : undefined}
        onPointerLeave={() => setScrub(null)}
      >
        <span
          className={styles.thumbFill}
          style={{ background: `linear-gradient(150deg, ${asset.tint[0]}, ${asset.tint[1]})` }}
        />
        {!isVideo && <Waveform id={asset.id} seconds={asset.seconds} />}

        <span className={cx(styles.badge, isVideo ? styles.badgeVideo : styles.badgeAudio)}>
          {isVideo ? <Video size={13} /> : <AudioLines size={13} />}
        </span>

        {selected && (
          <span className={styles.check}>
            <Check size={13} strokeWidth={2.6} />
          </span>
        )}

        {scrub === null ? (
          <span className={styles.duration}>{duration(asset.seconds)}</span>
        ) : (
          <>
            <span className={styles.playhead} style={{ left: `${scrub * 100}%` }} />
            <span className={styles.scrubTime}>{timecode(asset.seconds * scrub)}</span>
          </>
        )}
      </div>
      <span className={styles.cardName}>{asset.name}</span>
      <span className={styles.cardMeta}>
        {isVideo ? '1920 × 1080 · 30 fps' : '48 kHz · stereo'}
      </span>
    </button>
  )
}

export function MediaTab() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('all')
  const [selected, setSelected] = useState<string[]>(['a1'])
  const [dragOver, setDragOver] = useState(false)

  const visible = ASSETS.filter(
    (asset) =>
      (filter === 'all' || asset.kind === filter) &&
      asset.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )

  const selectedSeconds = ASSETS.filter((asset) => selected.includes(asset.id)).reduce(
    (total, asset) => total + asset.seconds,
    0,
  )

  return (
    <div style={{ padding: 22 }}>
      <div className={styles.mediaBar}>
        <div className={styles.search}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={cx(controls.textInput, styles.searchInput)}
            value={query}
            placeholder="Search media"
            aria-label="Search media"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className={styles.filter}>
          <SegmentedControl
            options={FILTERS}
            value={filter}
            onChange={setFilter}
            aria-label="Filter by type"
          />
        </div>
      </div>

      <button
        type="button"
        className={cx(styles.dropzone, dragOver && styles.dropzoneActive)}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
        }}
      >
        <Upload size={16} />
        {dragOver ? 'Release to import' : 'Drop files here, or click to browse'}
      </button>

      <div className={styles.mediaGrid}>
        {visible.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            selected={selected.includes(asset.id)}
            onToggle={() => toggle(asset.id)}
          />
        ))}
      </div>

      <div className={styles.mediaFoot}>
        <span>
          {visible.length} of {ASSETS.length} shown
          {selected.length > 0 && ` · ${selected.length} selected · ${duration(selectedSeconds)}`}
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            className={cx(shell.button, shell.buttonGhost)}
            onClick={() => setSelected([])}
          >
            Clear selection
          </button>
        )}
      </div>
    </div>
  )
}
