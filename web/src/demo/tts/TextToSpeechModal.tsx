// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useEffect, useMemo, useRef, useState } from 'react'
import { AudioLines, Check, Pause, Play, Sparkles } from 'lucide-react'
import { Modal, Panel, Row, Section, SegmentedControl, Select, Tooltip, clamp, cx } from '../../primitives'
import { Fader } from '../inspector/controls'
import { Waveform } from '../media/previews'
import styles from './tts.module.css'

/**
 * Text to speech.
 *
 * The reference is a text box, a voice dropdown and a button, which is enough
 * to send a job and not enough to get the read you wanted. Three things carry
 * most of the difference in practice, so they are on the surface here: which
 * voice, how much latitude the model has (stability), and how hard it leans
 * into the voice's own manner (style). The dropdown becomes a list, because a
 * voice is chosen by ear and by description, not by name alone.
 */

const LIMIT = 5000
/** Rough speaking rate. Enough to put a duration next to the button. */
const CHARS_PER_SECOND = 14

interface Voice {
  id: string
  name: string
  tags: string
  hue: number
  /** the shape of its signature bars, 0..1 */
  shape: number[]
}

/* Kokoro's own voice ids, because Kokoros is what is doing the reading. The
   prefix is the useful half: af = American female, bm = British male. */
const VOICES: Voice[] = [
  { id: 'af_heart', name: 'Heart', tags: 'af_heart · American female · warm', hue: 28, shape: [0.4, 0.8, 0.55, 1, 0.6, 0.35, 0.7] },
  { id: 'af_bella', name: 'Bella', tags: 'af_bella · American female · bright', hue: 348, shape: [0.75, 0.35, 0.9, 0.5, 0.8, 0.45, 0.6] },
  { id: 'am_michael', name: 'Michael', tags: 'am_michael · American male · steady', hue: 205, shape: [0.9, 0.55, 0.35, 0.7, 0.4, 0.85, 0.5] },
  { id: 'bf_emma', name: 'Emma', tags: 'bf_emma · British female · crisp', hue: 148, shape: [0.35, 0.6, 0.45, 0.8, 0.55, 0.4, 0.65] },
  { id: 'bm_george', name: 'George', tags: 'bm_george · British male · deep', hue: 268, shape: [1, 0.45, 0.7, 0.35, 0.9, 0.5, 0.8] },
]

/* Local engines only — nothing here leaves the machine, which is the whole
   reason to run Kokoros rather than call a service. `ms` is how long the
   render takes in this demo, ordered the way the real ones rank. */
const MODELS = [
  {
    value: 'kokoros',
    label: 'Kokoros',
    ms: 1500,
    note: 'Rust Kokoro-82M on the CPU, faster than real time on a laptop. The default here.',
  },
  {
    value: 'piper',
    label: 'Piper',
    ms: 900,
    note: 'Smallest and quickest of the set. Flatter prosody — fine for a scratch read.',
  },
  {
    value: 'styletts2',
    label: 'StyleTTS 2',
    ms: 3000,
    note: 'The best prosody you can run locally. Wants a GPU to keep up with the others.',
  },
  {
    value: 'xtts',
    label: 'XTTS v2',
    ms: 4600,
    note: 'Clones a voice from a short reference sample. GPU only, and the slowest here.',
  },
  {
    value: 'f5',
    label: 'F5-TTS',
    ms: 5200,
    note: 'Cloning with cleaner consonants than XTTS, at the cost of more time again.',
  },
] as const

/** The two that read from a reference sample rather than a voice id. */
const CLONING = new Set(['xtts', 'f5'])

const PACE = [
  { value: 0.85, label: 'Slower' },
  { value: 1, label: 'Natural' },
  { value: 1.15, label: 'Faster' },
] as const

const clock = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`

/**
 * Bars beside a voice, drawn only while that voice is previewing — a waveform
 * on a row that is not playing is decoration, and five of them at once is a
 * row of decoration nobody can read past. The slot keeps its width either way
 * so the play button does not jump sideways when the sound starts.
 */
function Signature({ voice, playing }: { voice: Voice; playing: boolean }) {
  return (
    <span
      className={cx(styles.signature, playing && styles.playing)}
      style={{ color: `hsl(${voice.hue} 90% 62%)` }}
      aria-hidden
    >
      {playing &&
        voice.shape.map((height, index) => (
          <span
            key={index}
            className={styles.bar}
            style={{ height: `${height * 100}%`, animationDelay: `${index * 70}ms` }}
          />
        ))}
    </span>
  )
}

type Stage = 'compose' | 'rendering' | 'done'

export function TextToSpeechModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('')
  const [voiceId, setVoiceId] = useState('af_heart')
  const [model, setModel] = useState<(typeof MODELS)[number]['value']>('kokoros')
  const [pace, setPace] = useState<number>(1)
  const [stability, setStability] = useState(0.5)
  const [similarity, setSimilarity] = useState(0.75)
  const [style, setStyle] = useState(0.15)

  const [stage, setStage] = useState<Stage>('compose')
  const [elapsed, setElapsed] = useState(0)
  const [previewing, setPreviewing] = useState<string | null>(null)

  const startedAt = useRef(0)

  const voice = VOICES.find((entry) => entry.id === voiceId) ?? VOICES[0]!
  const chosenModel = MODELS.find((entry) => entry.value === model) ?? MODELS[0]
  const over = text.length > LIMIT
  const seconds = (text.trim().length / CHARS_PER_SECOND) * (1 / pace)

  // Reset to a clean sheet each time it opens, so a cancelled run does not
  // greet you as a finished one.
  useEffect(() => {
    if (open) return
    setStage('compose')
    setElapsed(0)
    setPreviewing(null)
  }, [open])

  useEffect(() => {
    if (stage !== 'rendering') return
    const total = MODELS.find((entry) => entry.value === model)?.ms ?? 2000
    let raf = 0
    const tick = (now: number) => {
      const ms = now - startedAt.current
      setElapsed(ms)
      if (ms >= total) {
        setStage('done')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [stage, model])

  // A preview runs for as long as the sample would, then stops itself.
  useEffect(() => {
    if (previewing === null) return
    const id = window.setTimeout(() => setPreviewing(null), 2200)
    return () => window.clearTimeout(id)
  }, [previewing])

  const generate = () => {
    startedAt.current = performance.now()
    setElapsed(0)
    setStage('rendering')
  }

  const counterClass = over ? styles.counterOver : text.length > LIMIT * 0.9 ? styles.counterWarn : undefined

  const footer = useMemo(() => {
    if (stage === 'rendering') {
      return (
        <button type="button" className={styles.button} onClick={() => setStage('compose')}>
          Cancel
        </button>
      )
    }
    if (stage === 'done') {
      return (
        <div className={styles.footRow}>
          <span className={styles.estimate}>Ready to place on the timeline</span>
          <button type="button" className={styles.button} onClick={() => setStage('compose')}>
            Regenerate
          </button>
          <button type="button" className={cx(styles.button, styles.primary)} onClick={onClose}>
            Add to timeline
          </button>
        </div>
      )
    }
    return (
      <div className={styles.footRow}>
        <span className={styles.estimate}>
          {text.trim().length === 0
            ? 'Nothing to read yet'
            : `About ${clock(seconds)} in ${voice.name} · ${text.length.toLocaleString()} characters`}
        </span>
        <button
          type="button"
          className={cx(styles.button, styles.primary)}
          disabled={text.trim().length === 0 || over}
          onClick={generate}
        >
          <Sparkles size={13} />
          Generate speech
        </button>
      </div>
    )
  }, [stage, text, seconds, voice.name, over, onClose])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={stage === 'done' ? 'Speech ready' : 'Text to speech'}
      dismissible={stage !== 'rendering'}
      width={860}
      footer={footer}
    >
      {stage === 'compose' && (
        /* Two columns: what to say on the left, who says it and how on the
           right. Stacked, this dialog ran the height of the screen and the
           Generate button fell off the bottom of a laptop. */
        <div className={styles.columns}>
          <div className={styles.col}>
            <div className={cx(styles.group, styles.grow)}>
              <div className={styles.groupHead}>
                <span className={styles.legend}>Script</span>
                <span className={cx(styles.counter, counterClass)}>
                  {text.length.toLocaleString()} / {LIMIT.toLocaleString()}
                </span>
              </div>
              <textarea
                className={styles.textarea}
                value={text}
                spellCheck
                aria-label="Script"
                placeholder="Type the narration to read aloud…"
                onChange={(event) => setText(event.target.value)}
              />
            </div>

            <div className={styles.group}>
              <span className={styles.legend}>Model</span>
              <div className={styles.control}>
                <Select options={MODELS} value={model} onChange={setModel} aria-label="Model" />
              </div>
              <p className={styles.note}>{chosenModel?.note}</p>
            </div>

            <div className={styles.group}>
              <span className={styles.legend}>Pace</span>
              <div className={styles.control}>
                <SegmentedControl options={PACE} value={pace} onChange={setPace} aria-label="Pace" />
              </div>
            </div>
          </div>

          <div className={styles.col}>
            <div className={styles.group}>
              <div className={styles.groupHead}>
                <span className={styles.legend}>Voice</span>
                <span className={styles.counter}>{VOICES.length} available</span>
              </div>
              <div className={styles.voices}>
                {VOICES.map((entry) => (
                  <div
                    key={entry.id}
                    role="radio"
                    tabIndex={0}
                    aria-checked={entry.id === voiceId}
                    className={cx(styles.voice, entry.id === voiceId && styles.voiceOn)}
                    onClick={() => setVoiceId(entry.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setVoiceId(entry.id)
                      }
                    }}
                  >
                    <span className={styles.avatar} style={{ background: `hsl(${entry.hue} 88% 62%)` }}>
                      {entry.name.charAt(0)}
                    </span>
                    <span className={styles.voiceText}>
                      <span className={styles.voiceName}>{entry.name}</span>
                      <span className={styles.voiceTags}>{entry.tags}</span>
                    </span>
                    <Signature voice={entry} playing={previewing === entry.id} />
                    <Tooltip label={previewing === entry.id ? 'Stop preview' : `Preview ${entry.name}`}>
                      <button
                        type="button"
                        className={styles.preview}
                        aria-label={previewing === entry.id ? 'Stop preview' : `Preview ${entry.name}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          setPreviewing((current) => (current === entry.id ? null : entry.id))
                        }}
                      >
                        {previewing === entry.id ? <Pause size={12} /> : <Play size={12} />}
                      </button>
                    </Tooltip>
                  </div>
                ))}
              </div>
              {CLONING.has(model) && (
                <p className={styles.note}>
                  {chosenModel?.label} clones from a reference sample, so it reads past this list.
                </p>
              )}
            </div>

            <div className={styles.group}>
              <span className={styles.legend}>Delivery</span>
              {(
                [
                  {
                    label: 'Stability',
                    value: stability,
                    set: setStability,
                    read: stability < 0.35 ? 'expressive' : stability > 0.7 ? 'even' : 'balanced',
                  },
                  {
                    label: 'Similarity',
                    value: similarity,
                    set: setSimilarity,
                    read: `${Math.round(similarity * 100)}%`,
                  },
                  {
                    label: 'Style',
                    value: style,
                    set: setStyle,
                    read: style === 0 ? 'none' : `${Math.round(style * 100)}%`,
                  },
                ] as const
              ).map(({ label, value, set, read }) => (
                <div key={label} className={styles.setting}>
                  <div className={styles.settingHead}>
                    <span className={styles.settingLabel}>{label}</span>
                    <span className={styles.settingValue}>{read}</span>
                  </div>
                  <Fader
                    value={value}
                    onChange={(next) => set(clamp(next, 0, 1))}
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={label === 'Similarity' ? 0.75 : label === 'Stability' ? 0.5 : 0.15}
                    valueText={read}
                    aria-label={label}
                  />
                </div>
              ))}
              <p className={styles.note}>
                Low stability lets the read wander between takes; high holds it steady and flatter.
              </p>
            </div>
          </div>
        </div>
      )}

      {stage === 'rendering' && (
        <div className={styles.group}>
          <div className={styles.rendering}>
            <span className={styles.spinner} />
            <span>
              Rendering {clock(seconds)} with {chosenModel?.label}
            </span>
            <span className={styles.elapsed}>{clock(elapsed / 1000)}</span>
          </div>
          <div className={styles.track}>
            <div className={styles.sweep} />
          </div>
          <p className={styles.note}>
            The voice server does not report progress, so this is elapsed time rather than a
            percentage that would have to be invented.
          </p>
        </div>
      )}

      {stage === 'done' && (
        <div className={styles.group}>
          <div className={styles.rendering}>
            <Check size={14} className={styles.tick} />
            <span>
              {voice.name} · {clock(seconds)} · {chosenModel?.label}
            </span>
            <span className={styles.elapsed}>rendered in {clock(elapsed / 1000)}</span>
          </div>
          <div className={styles.result}>
            <Waveform hue={voice.hue} seed={Math.round(seconds * 100) + voice.hue} shape="centred" />
          </div>
          <p className={styles.note}>
            Added to the bin as <strong>{voice.name.toLowerCase()}-take-1.wav</strong>.
          </p>
        </div>
      )}
    </Modal>
  )
}

export function TextToSpeechSection() {
  const [open, setOpen] = useState(false)

  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <h2>Text to speech</h2>
        <p>
          The same dialog the reference sketches, with the controls a read actually turns on: a
          voice list you can hear and compare rather than a dropdown, the three delivery settings,
          and an honest elapsed clock while it renders.
        </p>
      </header>

      <div className={styles.centre}>
        <Panel title="Narration" width={380}>
          <Section title="Generate">
            <p className={styles.blurb}>
              Reads a script in one of five voices and drops the result in the bin. Everything is
              simulated — no audio leaves this page.
            </p>
            <Row>
              <button
                type="button"
                className={cx(styles.button, styles.primary, styles.block)}
                onClick={() => setOpen(true)}
              >
                <AudioLines size={14} />
                Open text to speech
              </button>
            </Row>
          </Section>
        </Panel>
      </div>

      <TextToSpeechModal open={open} onClose={() => setOpen(false)} />
    </section>
  )
}
