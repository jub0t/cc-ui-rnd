import { useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { MousePointer2, Scissors, Trash2 } from 'lucide-react'
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  EyeIcon,
  LockIcon,
  Panel,
  PlusIcon,
  SegmentedControl,
  SparkleIcon,
} from '../../primitives'
import { ContextMenu, useContextMenu } from '../../primitives/ContextMenu'
import type { ContextMenuItem } from '../../primitives/ContextMenu'
import { MiniMenu } from '../../primitives/MiniMenu'
import type { MiniMenuItem } from '../../primitives/MiniMenu'
import styles from './menu.module.css'

interface Clip {
  id: number
  name: string
  seconds: number
  speed: number
  muted: boolean
  locked: boolean
}

const START: Clip[] = [
  { id: 1, name: 'Protagonist_review_take3.mp4', seconds: 184, speed: 1, muted: false, locked: false },
  { id: 2, name: 'speech-af_heart-1.wav', seconds: 41, speed: 1, muted: false, locked: false },
  { id: 3, name: 'B_roll_city_dusk.mp4', seconds: 96, speed: 1, muted: true, locked: false },
]

const SPEEDS = [0.5, 1, 2] as const

const MODES = [
  { value: 'full', label: 'Full' },
  { value: 'mini', label: 'Minimal' },
] as const

type Mode = (typeof MODES)[number]['value']

const clock = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function ContextMenuDemo() {
  const menu = useContextMenu()
  const [mode, setMode] = useState<Mode>('full')
  const [clips, setClips] = useState(START)
  const [target, setTarget] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(1)
  const [clipboard, setClipboard] = useState<Clip | null>(null)
  const [snap, setSnap] = useState(true)
  const [nextId, setNextId] = useState(4)
  const [last, setLast] = useState<string | null>(null)

  const clip = clips.find((entry) => entry.id === target) ?? null

  const patch = (id: number, changes: Partial<Clip>) =>
    setClips((current) => current.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)))

  const openOn = (id: number | null) => (event: ReactMouseEvent) => {
    setTarget(id)
    setSelected(id)
    menu.onContextMenu(event)
  }

  /* --- shared actions -------------------------------------------------- */

  const copy = (entry: Clip) => {
    setClipboard(entry)
    setLast(`Copied ${entry.name}`)
  }

  const pasteClip = () => {
    if (!clipboard) return
    setClips((current) => [...current, { ...clipboard, id: nextId, name: `${clipboard.name} (pasted)` }])
    setNextId((value) => value + 1)
    setLast(`Pasted ${clipboard.name}`)
  }

  const addMatte = () => {
    setClips((current) => [
      ...current,
      { id: nextId, name: 'Colour matte', seconds: 30, speed: 1, muted: false, locked: false },
    ])
    setNextId((value) => value + 1)
    setLast('Added a colour matte')
  }

  const remove = (entry: Clip) => {
    setClips((current) => current.filter((item) => item.id !== entry.id))
    setLast(`Deleted ${entry.name}`)
  }

  // The demo track has no time axis, so "the playhead" is its head: split
  // halves the clip in place, move lifts it to the front.
  const splitAt = (entry: Clip) => {
    const half = entry.seconds / 2
    setClips((current) => {
      const at = current.findIndex((item) => item.id === entry.id)
      if (at < 0) return current
      const next = [...current]
      next.splice(
        at,
        1,
        { ...entry, id: nextId, name: `${entry.name} (A)`, seconds: half },
        { ...entry, id: nextId + 1, name: `${entry.name} (B)`, seconds: half },
      )
      return next
    })
    setNextId((value) => value + 2)
    setSelected(null)
    setLast(`Split ${entry.name} at the playhead`)
  }

  const moveToPlayhead = (entry: Clip) => {
    setClips((current) => [entry, ...current.filter((item) => item.id !== entry.id)])
    setLast(`Moved ${entry.name} to the playhead`)
  }

  /* --- full menu ------------------------------------------------------- */

  const pasteRow = (): ContextMenuItem => ({
    label: 'Paste',
    icon: <PlusIcon size={12} />,
    shortcut: 'Ctrl+V',
    // Disabled rather than hidden: a menu whose rows move around between
    // openings has to be re-read every time.
    disabled: clipboard === null,
    onSelect: pasteClip,
  })

  const fullTrackItems: ContextMenuItem[] = [
    { type: 'label', label: 'Track 1' },
    pasteRow(),
    { label: 'Add colour matte', icon: <SparkleIcon size={12} />, onSelect: addMatte },
    { type: 'separator' },
    {
      label: 'Snap to grid',
      checked: snap,
      shortcut: 'S',
      onSelect: () => {
        setSnap((on) => !on)
        setLast(`Snapping ${snap ? 'off' : 'on'}`)
      },
    },
  ]

  const fullClipItems = (entry: Clip): ContextMenuItem[] => [
    { label: 'Copy', icon: <CopyIcon size={12} />, shortcut: 'Ctrl+C', onSelect: () => copy(entry) },
    {
      label: 'Duplicate',
      icon: <PlusIcon size={12} />,
      shortcut: 'Ctrl+D',
      disabled: entry.locked,
      onSelect: () => {
        setClips((current) => [...current, { ...entry, id: nextId, name: `${entry.name} copy` }])
        setNextId((value) => value + 1)
        setLast(`Duplicated ${entry.name}`)
      },
    },
    pasteRow(),
    { type: 'separator' },
    {
      label: 'Speed',
      icon: <SparkleIcon size={12} />,
      items: SPEEDS.map((speed) => ({
        label: `${speed.toFixed(2)}x`,
        checked: entry.speed === speed,
        onSelect: () => {
          patch(entry.id, { speed })
          setLast(`${entry.name} at ${speed.toFixed(2)}x`)
        },
      })),
    },
    {
      label: 'Mute',
      icon: <EyeIcon size={12} />,
      checked: entry.muted,
      shortcut: 'M',
      onSelect: () => {
        patch(entry.id, { muted: !entry.muted })
        setLast(`${entry.muted ? 'Unmuted' : 'Muted'} ${entry.name}`)
      },
    },
    {
      label: 'Lock',
      icon: <LockIcon size={12} />,
      checked: entry.locked,
      onSelect: () => {
        patch(entry.id, { locked: !entry.locked })
        setLast(`${entry.locked ? 'Unlocked' : 'Locked'} ${entry.name}`)
      },
    },
    { type: 'separator' },
    {
      label: 'Delete',
      icon: <CloseIcon size={12} />,
      shortcut: 'Del',
      danger: true,
      disabled: entry.locked,
      onSelect: () => remove(entry),
    },
  ]

  /* --- minimal menu ---------------------------------------------------- */

  const miniClipItems = (entry: Clip): MiniMenuItem[] => [
    { label: 'Split at playhead', icon: <Scissors size={15} />, shortcut: 'S', onSelect: () => splitAt(entry) },
    { label: 'Move to playhead', icon: <MousePointer2 size={15} />, onSelect: () => moveToPlayhead(entry) },
    'separator',
    {
      label: 'Delete',
      icon: <Trash2 size={15} />,
      shortcut: 'Del',
      danger: true,
      disabled: entry.locked,
      onSelect: () => remove(entry),
    },
  ]

  const miniTrackItems: MiniMenuItem[] = [
    { label: 'Paste', icon: <PlusIcon size={15} />, shortcut: 'Ctrl+V', disabled: clipboard === null, onSelect: pasteClip },
    { label: 'Add colour matte', icon: <SparkleIcon size={15} />, onSelect: addMatte },
  ]

  return (
    <>
      <Panel
        title="Timeline"
        width={520}
        actions={
          <div className={styles.modeSwitch}>
            <SegmentedControl options={MODES} value={mode} onChange={setMode} aria-label="Menu style" />
          </div>
        }
      >
        <div className={styles.track}>
          {clips.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={selected === entry.id}
              onClick={() => setSelected(entry.id)}
              onContextMenu={openOn(entry.id)}
              className={[
                styles.clip,
                selected === entry.id ? styles.clipOn : '',
                entry.muted ? styles.clipMuted : '',
                entry.locked ? styles.clipLocked : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className={styles.clipName}>{entry.name}</span>
              {entry.speed !== 1 && <span className={styles.tag}>{entry.speed.toFixed(2)}x</span>}
              {entry.muted && <span className={styles.tag}>muted</span>}
              {entry.locked && <span className={styles.tag}>locked</span>}
              <span className={styles.clipMeta}>{clock(entry.seconds / entry.speed)}</span>
            </button>
          ))}

          <button
            type="button"
            aria-label="Empty track"
            onClick={() => setSelected(null)}
            onContextMenu={openOn(null)}
            className={styles.empty}
          >
            empty track — right-click here too
          </button>
        </div>

        <div className={styles.status}>
          {last === null ? (
            <span>Right-click a clip, or the track below it. Shift+F10 works as well.</span>
          ) : (
            <>
              <span className={styles.statusDot} />
              <span>{last}</span>
            </>
          )}
          {snap && (
            <span className={styles.statusRight}>
              <CheckIcon size={11} /> snapping
            </span>
          )}
        </div>
      </Panel>

      {/* One trigger, two surfaces — the hook does not care which one renders. */}
      {mode === 'full' ? (
        <ContextMenu
          {...menu.props}
          items={clip ? fullClipItems(clip) : fullTrackItems}
          aria-label={clip ? clip.name : 'Track 1'}
        />
      ) : (
        <MiniMenu
          {...menu.props}
          items={clip ? miniClipItems(clip) : miniTrackItems}
          aria-label={clip ? clip.name : 'Track 1'}
        />
      )}
    </>
  )
}

export function ContextMenuSection() {
  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <h2>Context menu</h2>
        <p>
          Two surfaces over one engine: the full menu with submenus, checkbox rows and shortcut
          hints, and a minimal one that is a short list of verbs and nothing else. Both are
          portalled so no ancestor can clip them, both clamp inside the viewport, both work from
          the keyboard, and both hand focus back on the way out. Flip the switch and right-click.
        </p>
      </header>

      <div className={styles.centre}>
        <ContextMenuDemo />
      </div>
    </section>
  )
}
