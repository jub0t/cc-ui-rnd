// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { Fragment, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { AudioLines, Eye, EyeOff, Magnet, Maximize2, MousePointer2, Scissors, Split, Trash2, Volume2, VolumeX } from 'lucide-react'
import {
  IconButton,
  MinusIcon,
  Panel,
  PlusIcon,
  Select,
  clamp,
  cx,
  useElementSize,
  usePointerDrag,
} from '../../primitives'
import { Frame } from '../media/previews'
import { TimelineWave } from './TimelineWave'
import type { WaveShape } from '../media/previews'
import { FPS, MIN_LENGTH, SEQUENCES, labelStep, snapEdge, snapMove, snapTargets, timecode } from './sequence'
import type { Clip, Sequence } from './sequence'
import styles from './timeline.module.css'

/**
 * The timeline.
 *
 * Clips are drawn with the same generated footage the media browser uses, so a
 * clip looks like itself wherever it appears — the bin and the timeline are
 * not two different pictures of one file.
 *
 * What it does: scrub, zoom, move, trim, split, snap, mute, hide, and two
 * sequences to switch between. What it does not: play, ripple, or transitions.
 */

/** Must match `grid-template-columns` in the stylesheet. */
const HEAD_W = 164
const LANE_H = 56
/** px of slack the pointer gets before a snap takes hold. */
const SNAP_PX = 7

const WAVES = [
  { value: 'centred', label: 'Centred' },
  { value: 'floored', label: 'Floored' },
] as const

/* ------------------------------------------------------------------ */
/* Clip                                                                */
/* ------------------------------------------------------------------ */

interface ClipChange {
  start?: number
  length?: number
  offset?: number
  lane?: number
}

function TimelineClip({
  clip,
  lane,
  lanes,
  pxPerFrame,
  selected,
  blade,
  snap,
  wave,
  dim,
  targets,
  onSelect,
  onChange,
  onSplit,
  onDelete,
  onSnapLine,
}: {
  clip: Clip
  lane: number
  lanes: number
  pxPerFrame: number
  selected: boolean
  blade: boolean
  snap: boolean
  wave: WaveShape
  dim: boolean
  targets: number[]
  onSelect: () => void
  onChange: (change: ClipChange) => void
  onSplit: (at: number) => void
  onDelete: () => void
  onSnapLine: (frame: number | null) => void
}) {
  const origin = useRef({ start: 0, length: 0, lane: 0, offset: 0 })
  const [mode, setMode] = useState<'move' | 'left' | 'right' | null>(null)
  const tolerance = SNAP_PX / pxPerFrame

  const remember = () => {
    origin.current = { start: clip.start, length: clip.length, lane, offset: clip.offset }
  }

  const finish = () => {
    setMode(null)
    onSnapLine(null)
  }

  const beginMove = usePointerDrag({
    cursor: 'grabbing',
    onStart: () => {
      remember()
      setMode('move')
      onSelect()
    },
    onMove: ({ dx, dy, shiftKey, moved }) => {
      if (!moved) return
      const wanted = Math.max(0, origin.current.start + Math.round(dx / pxPerFrame))
      // Shift is the universal "I meant exactly there" — it turns snapping off
      // for the duration of the gesture rather than making you go and find the
      // toolbar toggle.
      const landed = snap && !shiftKey ? snapMove(wanted, clip.length, targets, tolerance) : { value: wanted, line: null }
      onSnapLine(landed.line)
      onChange({
        start: Math.max(0, Math.round(landed.value)),
        lane: clamp(origin.current.lane + Math.round(dy / LANE_H), 0, lanes - 1),
      })
    },
    onEnd: finish,
  })

  const beginLeft = usePointerDrag({
    cursor: 'ew-resize',
    onStart: () => {
      remember()
      setMode('left')
      onSelect()
    },
    onMove: ({ dx, shiftKey, moved }) => {
      if (!moved) return
      const end = origin.current.start + origin.current.length
      const wanted = origin.current.start + Math.round(dx / pxPerFrame)
      const landed = snap && !shiftKey ? snapEdge(wanted, targets, tolerance) : { value: wanted, line: null }
      const start = clamp(Math.round(landed.value), 0, end - MIN_LENGTH)
      onSnapLine(landed.line)
      // the head moved by `start - origin`, so the source has to move with it
      onChange({ start, length: end - start, offset: origin.current.offset + (start - origin.current.start) })
    },
    onEnd: finish,
  })

  const beginRight = usePointerDrag({
    cursor: 'ew-resize',
    onStart: () => {
      remember()
      setMode('right')
      onSelect()
    },
    onMove: ({ dx, shiftKey, moved }) => {
      if (!moved) return
      const wanted = origin.current.start + origin.current.length + Math.round(dx / pxPerFrame)
      const landed = snap && !shiftKey ? snapEdge(wanted, targets, tolerance) : { value: wanted, line: null }
      const end = Math.max(origin.current.start + MIN_LENGTH, Math.round(landed.value))
      onSnapLine(landed.line)
      onChange({ length: end - origin.current.start })
    },
    onEnd: finish,
  })

  const width = Math.max(2, clip.length * pxPerFrame)
  const bodyHeight = LANE_H - 8 - 16

  // One thumbnail per 16:9 of body height, which is what a filmstrip is.
  const thumbs = useMemo(() => {
    const thumbWidth = Math.max(26, Math.round(bodyHeight * (16 / 9)))
    const count = clamp(Math.ceil(width / thumbWidth), 1, 28)
    return Array.from({ length: count }, (_, index) => ({
      key: index,
      width: thumbWidth,
      t: count === 1 ? 0.4 : index / (count - 1),
    }))
    // width is deliberately quantised by the ceil above, so a drag only
    // rebuilds the strip when a whole thumbnail's worth has changed
  }, [width, bodyHeight])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (blade) {
      const rect = event.currentTarget.getBoundingClientRect()
      onSplit(clip.start + Math.round((event.clientX - rect.left) / pxPerFrame))
      return
    }
    beginMove(event)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? FPS : 1
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      event.stopPropagation()
      onChange({ start: Math.max(0, clip.start + (event.key === 'ArrowLeft' ? -step : step)) })
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      event.stopPropagation()
      onDelete()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${clip.name}, ${timecode(clip.start)} for ${timecode(clip.length)}`}
      className={cx(
        styles.clip,
        selected && styles.clipSelected,
        mode !== null && styles.clipDragging,
        dim && styles.clipMuted,
      )}
      style={{ left: clip.start * pxPerFrame, width, cursor: blade ? 'crosshair' : undefined }}
      onPointerDown={onPointerDown}
      onFocus={onSelect}
      onKeyDown={onKeyDown}
    >
      <span className={styles.clipLabel}>{clip.name}</span>

      <div className={styles.clipBody}>
        {clip.kind === 'audio' ? (
          <TimelineWave
            hue={clip.hue}
            seed={clip.hue}
            offset={clip.offset}
            length={clip.length}
            width={width}
            height={bodyHeight}
            shape={wave}
          />
        ) : (
          <div className={styles.strip}>
            {thumbs.map(({ key, width: thumbWidth, t }) => (
              <span key={key} className={styles.frame} style={{ width: thumbWidth }}>
                <Frame hue={clip.hue} seed={clip.length + clip.hue} t={t} />
              </span>
            ))}
          </div>
        )}
      </div>

      {!blade && (
        <>
          <span
            className={cx(styles.handle, styles.handleLeft)}
            onPointerDown={(event) => {
              event.stopPropagation()
              beginLeft(event)
            }}
          />
          <span
            className={cx(styles.handle, styles.handleRight)}
            onPointerDown={(event) => {
              event.stopPropagation()
              beginRight(event)
            }}
          />
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export function TimelinePanel() {
  const [sequences, setSequences] = useState<Sequence[]>(SEQUENCES)
  const [activeId, setActiveId] = useState(SEQUENCES[0]!.id)
  const [tool, setTool] = useState<'select' | 'blade'>('select')
  const [snap, setSnap] = useState(true)
  const [wave, setWave] = useState<WaveShape>('centred')
  const [pxPerFrame, setPxPerFrame] = useState(5)
  const [playhead, setPlayhead] = useState(16)
  const [selected, setSelected] = useState<string | null>(null)
  const [snapLine, setSnapLine] = useState<number | null>(null)
  const [nextId, setNextId] = useState(1)

  const rulerRef = useRef<HTMLDivElement>(null)
  const [bodyRef, body] = useElementSize<HTMLDivElement>()

  const sequence = sequences.find((entry) => entry.id === activeId) ?? sequences[0]!
  const { tracks, clips } = sequence

  const patch = (change: (current: Sequence) => Sequence) =>
    setSequences((current) => current.map((entry) => (entry.id === sequence.id ? change(entry) : entry)))

  const patchClip = (id: string, change: ClipChange) =>
    patch((current) => ({
      ...current,
      clips: current.clips.map((clip) =>
        clip.id === id
          ? {
              ...clip,
              start: change.start ?? clip.start,
              length: change.length ?? clip.length,
              offset: change.offset ?? clip.offset,
              track: change.lane === undefined ? clip.track : (current.tracks[change.lane]?.id ?? clip.track),
            }
          : clip,
      ),
    }))

  const maxEnd = clips.reduce((most, clip) => Math.max(most, clip.start + clip.length), 0)
  const laneWidth = Math.max(320, body.width - HEAD_W)
  const spanFrames = Math.max(maxEnd + FPS * 3, playhead + FPS, laneWidth / pxPerFrame)
  const contentPx = spanFrames * pxPerFrame
  const step = labelStep(pxPerFrame)

  /* --- actions ---------------------------------------------------------- */

  const zoom = (factor: number) => setPxPerFrame((current) => clamp(current * factor, 0.35, 26))

  const fit = () => {
    const span = Math.max(FPS, maxEnd + FPS)
    setPxPerFrame(clamp(laneWidth / span, 0.35, 26))
  }

  const splitAt = (id: string, at: number) =>
    patch((current) => {
      const clip = current.clips.find((entry) => entry.id === id)
      if (!clip) return current
      const offset = Math.round(at) - clip.start
      // A cut in the first or last few frames is a mis-aim, not an edit.
      if (offset < MIN_LENGTH || offset > clip.length - MIN_LENGTH) return current
      const suffix: Clip = {
        ...clip,
        id: `${clip.id}-${nextId}`,
        start: clip.start + offset,
        length: clip.length - offset,
        offset: clip.offset + offset,
      }
      setNextId((value) => value + 1)
      return {
        ...current,
        clips: [...current.clips.map((entry) => (entry.id === id ? { ...entry, length: offset } : entry)), suffix],
      }
    })

  const splitAtPlayhead = () => {
    const under = clips.filter((clip) => playhead > clip.start && playhead < clip.start + clip.length)
    for (const clip of under) splitAt(clip.id, playhead)
  }

  const removeSelected = () => {
    if (selected === null) return
    patch((current) => ({ ...current, clips: current.clips.filter((clip) => clip.id !== selected) }))
    setSelected(null)
  }

  const addTrack = () =>
    patch((current) => ({
      ...current,
      tracks: [
        { id: `t${nextId}`, name: `Track ${current.tracks.length + 1}`, hidden: false, muted: false },
        ...current.tracks,
      ],
    }))

  const toggleTrack = (id: string, key: 'hidden' | 'muted') =>
    patch((current) => ({
      ...current,
      tracks: current.tracks.map((track) => (track.id === id ? { ...track, [key]: !track[key] } : track)),
    }))

  const addSequence = () => {
    const id = `seq${sequences.length + 1}-${nextId}`
    setNextId((value) => value + 1)
    setSequences((current) => [
      ...current,
      {
        id,
        name: `Timeline ${current.length + 1}`,
        tracks: [
          { id: `${id}-v`, name: 'Track 2', hidden: false, muted: false },
          { id: `${id}-a`, name: 'Track 1', hidden: false, muted: false },
        ],
        clips: [],
      },
    ])
    setActiveId(id)
    setSelected(null)
  }

  /* --- scrubbing --------------------------------------------------------- */

  const frameAt = (clientX: number) => {
    const rect = rulerRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return clamp(Math.round((clientX - rect.left) / pxPerFrame), 0, Math.round(spanFrames))
  }

  const beginScrub = usePointerDrag({
    threshold: 0,
    cursor: 'ew-resize',
    onStart: ({ x }) => setPlayhead(frameAt(x)),
    onMove: ({ x }) => setPlayhead(frameAt(x)),
  })

  const onBodyKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase()
    if (key === 'v') setTool('select')
    else if (key === 'b') setTool('blade')
    else if (key === 's') splitAtPlayhead()
    else if (event.key === 'Delete' || event.key === 'Backspace') removeSelected()
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const distance = event.shiftKey ? FPS : 1
      setPlayhead((current) => Math.max(0, current + (event.key === 'ArrowLeft' ? -distance : distance)))
    } else return
    if (key === 'v' || key === 'b' || key === 's') event.preventDefault()
  }

  /* --- ruler ------------------------------------------------------------- */

  const ticks = useMemo(() => {
    const marks = []
    for (let frame = 0; frame <= spanFrames; frame += step) {
      const left = frame * pxPerFrame
      marks.push(<span key={`t${frame}`} className={styles.tick} style={{ left, height: 8 }} />)
      marks.push(
        <span key={`l${frame}`} className={styles.tickLabel} style={{ left }}>
          {timecode(frame)}
        </span>,
      )
      const half = frame + step / 2
      if (half <= spanFrames) {
        marks.push(<span key={`h${frame}`} className={styles.tick} style={{ left: half * pxPerFrame, height: 4 }} />)
      }
    }
    return marks
  }, [spanFrames, step, pxPerFrame])

  const gridline = `repeating-linear-gradient(90deg, var(--cp-line) 0 1px, transparent 1px ${step * pxPerFrame}px)`

  return (
    <Panel width="100%" className={styles.panel}>
      <div className={styles.tabs}>
        {sequences.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={entry.id === sequence.id}
            className={cx(styles.tab, entry.id === sequence.id && styles.tabOn)}
            onClick={() => {
              setActiveId(entry.id)
              setSelected(null)
            }}
          >
            {entry.name}
          </button>
        ))}
        <button type="button" className={styles.tabAdd} aria-label="New sequence" onClick={addSequence}>
          <PlusIcon size={13} />
        </button>
      </div>

      <div className={styles.toolbar}>
        <IconButton label="Select" shortcut="V" active={tool === 'select'} onClick={() => setTool('select')}>
          <MousePointer2 size={14} />
        </IconButton>
        <IconButton label="Blade" shortcut="B" active={tool === 'blade'} onClick={() => setTool('blade')}>
          <Scissors size={14} />
        </IconButton>

        <span className={styles.divider} />

        <IconButton label="Split at playhead" shortcut="S" onClick={splitAtPlayhead}>
          <Split size={14} />
        </IconButton>
        <IconButton
          label="Delete clip"
          shortcut="Del"
          disabled={selected === null}
          className={styles.danger}
          onClick={removeSelected}
        >
          <Trash2 size={14} />
        </IconButton>

        <span className={styles.divider} />

        <IconButton label="Snap to edges" active={snap} onClick={() => setSnap((on) => !on)}>
          <Magnet size={14} />
        </IconButton>
        <div className={styles.wavePicker}>
          <Select
            options={WAVES}
            value={wave}
            onChange={setWave}
            icon={<AudioLines size={13} />}
            aria-label="Waveform style"
          />
        </div>
        <IconButton label="Add track" onClick={addTrack}>
          <PlusIcon />
        </IconButton>

        <span className={styles.spacer} />

        <span className={styles.readout}>{timecode(playhead)}</span>
        <IconButton label="Zoom to fit" onClick={fit}>
          <Maximize2 size={13} />
        </IconButton>
        <IconButton label="Zoom out" onClick={() => zoom(1 / 1.5)}>
          <MinusIcon />
        </IconButton>
        <IconButton label="Zoom in" onClick={() => zoom(1.5)}>
          <PlusIcon />
        </IconButton>
      </div>

      <div ref={bodyRef} className={styles.body} tabIndex={0} onKeyDown={onBodyKeyDown}>
        <div className={styles.grid}>
          <div className={styles.corner} />
          <div ref={rulerRef} className={styles.ruler} style={{ width: contentPx }} onPointerDown={beginScrub}>
            {ticks}
          </div>

          {tracks.map((track, lane) => (
            <Fragment key={track.id}>
              <div
                className={cx(styles.trackHead, (track.hidden || track.muted) && styles.trackOff)}
                style={{ height: LANE_H }}
              >
                <span className={styles.trackName}>{track.name}</span>
                <IconButton
                  label={track.hidden ? `Show ${track.name}` : `Hide ${track.name}`}
                  className={styles.trackButton}
                  onClick={() => toggleTrack(track.id, 'hidden')}
                >
                  {track.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </IconButton>
                <IconButton
                  label={track.muted ? `Unmute ${track.name}` : `Mute ${track.name}`}
                  className={styles.trackButton}
                  onClick={() => toggleTrack(track.id, 'muted')}
                >
                  {track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                </IconButton>
              </div>

              <div className={styles.lane} style={{ width: contentPx, height: LANE_H }}>
                <div className={styles.gridlines} style={{ backgroundImage: gridline }} />
                {clips
                  .filter((clip) => clip.track === track.id)
                  .map((clip) => (
                    <TimelineClip
                      key={clip.id}
                      clip={clip}
                      lane={lane}
                      lanes={tracks.length}
                      pxPerFrame={pxPerFrame}
                      selected={clip.id === selected}
                      blade={tool === 'blade'}
                      snap={snap}
                      wave={wave}
                      dim={track.hidden || track.muted}
                      targets={snapTargets(clips, clip.id, playhead)}
                      onSelect={() => setSelected(clip.id)}
                      onChange={(change) => patchClip(clip.id, change)}
                      onSplit={(at) => splitAt(clip.id, at)}
                      onDelete={() => {
                        patch((current) => ({
                          ...current,
                          clips: current.clips.filter((entry) => entry.id !== clip.id),
                        }))
                        setSelected(null)
                      }}
                      onSnapLine={setSnapLine}
                    />
                  ))}
              </div>
            </Fragment>
          ))}

          {snapLine !== null && (
            <div className={styles.snapline} style={{ left: HEAD_W + snapLine * pxPerFrame }} />
          )}
          <div className={styles.playhead} style={{ left: HEAD_W + playhead * pxPerFrame }}>
            <span className={styles.playheadGrip} />
          </div>
        </div>
      </div>
    </Panel>
  )
}

export function TimelineSection() {
  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <h2>Timeline</h2>
        <p>
          Drag a clip to move it, its edges to trim it, and the ruler to scrub. Snapping catches
          clip edges and the playhead — hold shift to ignore it. The blade splits where you click,
          and clips are drawn with the same generated footage as the bin, so a clip looks like
          itself in both places.
        </p>
      </header>

      <TimelinePanel />
    </section>
  )
}
