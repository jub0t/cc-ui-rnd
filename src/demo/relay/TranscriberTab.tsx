import { useEffect, useRef, useState } from 'react'
import { Check, Download, Loader2, Trash2, X } from 'lucide-react'
import { SegmentedControl, cx } from '../../primitives'
import { Group, PropRow, Progress } from './controls'
import { eta, megabytes, rate } from './format'
import shell from './relay.module.css'
import styles from './tabs.module.css'

interface Model {
  id: string
  name: string
  blurb: string
  mb: number
  /** 1..5, shown as a dot meter rather than buried in prose */
  accuracy: number
}

const MODELS: Model[] = [
  { id: 'tiny-en', name: 'Tiny', blurb: 'Fastest draft. Rough on names and punctuation.', mb: 78, accuracy: 1 },
  { id: 'base-en', name: 'Base', blurb: 'Solid captions at about 10× realtime.', mb: 147, accuracy: 2 },
  { id: 'small-en', name: 'Small', blurb: 'Noticeably better wording. A few times slower.', mb: 488, accuracy: 3 },
  { id: 'medium-en', name: 'Medium', blurb: 'Handles accents and crosstalk well.', mb: 1530, accuracy: 4 },
  { id: 'large-v3', name: 'Large v3', blurb: 'Best available. Needs a capable GPU.', mb: 3090, accuracy: 5 },
]

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
] as const

/** Plausible broadband throughput, jittered so it never looks scripted. */
const BASE_RATE = 62 * 1024 * 1024

interface Transfer {
  received: number
  rate: number
}

const totalBytes = (model: Model) => model.mb * 1024 * 1024

function AccuracyMeter({ level }: { level: number }) {
  return (
    <span className={styles.meter} aria-label={`Accuracy ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span key={step} className={cx(styles.meterDot, step <= level && styles.meterDotOn)} />
      ))}
    </span>
  )
}

export function TranscriberTab() {
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]['value']>('auto')
  const [installed, setInstalled] = useState<string[]>(['base-en'])
  const [active, setActive] = useState('base-en')
  const [transfers, setTransfers] = useState<Record<string, Transfer>>({})

  const frame = useRef(0)
  const lastAt = useRef(0)
  const running = Object.keys(transfers).length > 0

  // One loop advances every in-flight download. The updater stays pure —
  // completion is handled by the effect below.
  useEffect(() => {
    if (!running) {
      lastAt.current = 0
      return
    }
    const tick = (now: number) => {
      const dt = Math.min((now - (lastAt.current || now)) / 1000, 0.1)
      lastAt.current = now

      setTransfers((current) => {
        const next: Record<string, Transfer> = {}
        for (const [id, transfer] of Object.entries(current)) {
          const model = MODELS.find((m) => m.id === id)
          if (!model) continue
          const speed = BASE_RATE * (0.75 + Math.random() * 0.5)
          next[id] = {
            received: Math.min(transfer.received + speed * dt, totalBytes(model)),
            rate: speed,
          }
        }
        return next
      })

      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [running])

  // Retire finished transfers and adopt the newly available model.
  useEffect(() => {
    const done = Object.entries(transfers)
      .filter(([id, transfer]) => {
        const model = MODELS.find((m) => m.id === id)
        return model !== undefined && transfer.received >= totalBytes(model)
      })
      .map(([id]) => id)

    if (done.length === 0) return

    setInstalled((list) => [...new Set([...list, ...done])])
    setActive((current) => done[0] ?? current)
    setTransfers((current) => {
      const next = { ...current }
      for (const id of done) delete next[id]
      return next
    })
  }, [transfers])

  const start = (id: string) =>
    setTransfers((current) => ({ ...current, [id]: { received: 0, rate: 0 } }))

  const cancel = (id: string) =>
    setTransfers((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })

  const remove = (id: string) => {
    const remaining = installed.filter((value) => value !== id)
    setInstalled(remaining)
    if (active === id) setActive(remaining[0] ?? '')
  }

  const usedMb = MODELS.filter((model) => installed.includes(model.id)).reduce(
    (total, model) => total + model.mb,
    0,
  )

  return (
    <div className={styles.transcriberWrap}>
      <Group label="Language">
        <PropRow>
          <div className={styles.langWrap}>
            <SegmentedControl
              options={LANGUAGES}
              value={language}
              onChange={setLanguage}
              aria-label="Transcription language"
            />
          </div>
        </PropRow>
      </Group>

      <Group label="Models">
        <div className={styles.modelList} role="radiogroup" aria-label="Transcription model">
          {MODELS.map((model) => {
            const transfer = transfers[model.id]
            const isInstalled = installed.includes(model.id)
            const isActive = isInstalled && active === model.id

            const identity = (
              <>
                <span
                  className={cx(
                    styles.radio,
                    isActive && styles.radioOn,
                    !isInstalled && styles.radioEmpty,
                  )}
                />
                <span className={styles.modelText}>
                  <span className={styles.modelName}>
                    {model.name}
                    {isActive && <span className={styles.pill}>In use</span>}
                  </span>
                  <p className={styles.modelDesc}>{model.blurb}</p>
                </span>
              </>
            )

            return (
              <div
                key={model.id}
                className={cx(
                  styles.model,
                  isActive && styles.modelActive,
                  !isInstalled && !transfer && styles.modelIdle,
                )}
              >
                {/* A downloaded model is a choice, so only then is it a radio.
                    Everything else is an acquisition, handled by the button on
                    the right. The original row conflated the two. */}
                {isInstalled ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={cx(styles.modelMain, styles.modelPick)}
                    onClick={() => setActive(model.id)}
                  >
                    {identity}
                  </button>
                ) : (
                  <span className={styles.modelMain}>{identity}</span>
                )}

                <span className={styles.modelSide}>
                  <AccuracyMeter level={model.accuracy} />
                  <span className={styles.modelSize}>{megabytes(model.mb)}</span>

                  {transfer ? (
                    <button
                      type="button"
                      className={cx(shell.button, shell.buttonGhost)}
                      onClick={() => cancel(model.id)}
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  ) : isInstalled ? (
                    <button
                      type="button"
                      className={cx(shell.button, shell.buttonGhost)}
                      aria-label={`Delete ${model.name}`}
                      onClick={() => remove(model.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <button type="button" className={shell.button} onClick={() => start(model.id)}>
                      <Download size={14} />
                      Download
                    </button>
                  )}
                </span>

                {transfer && (
                  <span className={styles.downloading}>
                    <Progress value={transfer.received / totalBytes(model)} />
                    <span className={styles.downloadStats}>
                      <span>
                        <Loader2 size={11} className={shell.spin} style={{ marginRight: 6 }} />
                        {megabytes(transfer.received / 1024 / 1024, 1)} of {megabytes(model.mb)} ·{' '}
                        {rate(transfer.rate)}
                      </span>
                      <span>{eta((totalBytes(model) - transfer.received) / (transfer.rate || 1))}</span>
                    </span>
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div className={styles.diskFoot}>
          <span>
            {installed.length} installed · {megabytes(usedMb)} on disk
          </span>
          <span className={styles.localNote}>
            <Check size={13} />
            Runs locally
          </span>
        </div>
      </Group>
    </div>
  )
}
