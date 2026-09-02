// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useEffect, useRef, useState } from 'react'
import { Check, Download, Loader2, Trash2, X } from 'lucide-react'
import { SegmentedControl } from '../../primitives'
import { eta, megabytes, rate } from './format'
import { Button, Panel, Row, Section, cn } from './ui'

interface Model {
  id: string
  name: string
  blurb: string
  mb: number
  /** 1..5, shown as a dot meter rather than buried in prose */
  accuracy: number
}

const MODELS: Model[] = [
  { id: 'tiny', name: 'Tiny', blurb: 'Fastest draft. Rough on names and punctuation.', mb: 78, accuracy: 1 },
  { id: 'base', name: 'Base', blurb: 'Solid captions at about 10× realtime.', mb: 147, accuracy: 2 },
  { id: 'small', name: 'Small', blurb: 'Noticeably better wording. A few times slower.', mb: 488, accuracy: 3 },
  { id: 'medium', name: 'Medium', blurb: 'Handles accents and crosstalk well.', mb: 1530, accuracy: 4 },
  { id: 'large', name: 'Large v3', blurb: 'Best available. Needs a capable GPU.', mb: 3090, accuracy: 5 },
]

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
] as const

/** Plausible broadband throughput, jittered so it never looks scripted. */
const BASE_RATE = 62 * 1024 * 1024
const totalBytes = (model: Model) => model.mb * 1024 * 1024

interface Transfer {
  received: number
  rate: number
}

export function TranscriberPanel() {
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]['value']>('auto')
  const [installed, setInstalled] = useState<string[]>(['base'])
  const [active, setActive] = useState('base')
  const [transfers, setTransfers] = useState<Record<string, Transfer>>({})

  const frame = useRef(0)
  const lastAt = useRef(0)
  const running = Object.keys(transfers).length > 0

  // One loop advances every in-flight download; the updater stays pure.
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

  const usedMb = MODELS.filter((m) => installed.includes(m.id)).reduce((total, m) => total + m.mb, 0)

  return (
    <Panel title="Transcriber" width={520}>
      <Section label="Language">
        <Row>
          <div className="w-full max-w-[260px] [&_button]:block [&_button]:min-w-0 [&_button]:truncate [&_button]:leading-6">
            <SegmentedControl
              options={LANGUAGES}
              value={language}
              onChange={setLanguage}
              aria-label="Transcription language"
            />
          </div>
        </Row>
      </Section>

      <Section label="Models">
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Transcription model">
          {MODELS.map((model) => {
            const transfer = transfers[model.id]
            const isInstalled = installed.includes(model.id)
            const isActive = isInstalled && active === model.id

            const identity = (
              <>
                <span
                  className={cn(
                    'mt-0.5 size-4 flex-none rounded-full ring-inset transition-shadow',
                    isActive
                      ? 'ring-[5px] ring-accent'
                      : isInstalled
                        ? 'ring-[1.5px] ring-edge'
                        : 'ring-[1.5px] ring-[#2c2c2c]',
                  )}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                    {model.name}
                    {isActive && (
                      <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-onaccent">
                        In use
                      </span>
                    )}
                  </span>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-inkmute">{model.blurb}</p>
                </span>
              </>
            )

            return (
              <div
                key={model.id}
                className={cn(
                  'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border p-3 transition-colors',
                  isActive
                    ? 'border-accent bg-accent/15'
                    : 'border-line bg-raised has-[button:hover]:border-edge',
                  !isInstalled && !transfer && 'opacity-85',
                )}
              >
                {/* A downloaded model is a choice, so only then is it a radio.
                    Everything else is an acquisition, handled by the button on
                    the right — the original row conflated the two. */}
                {isInstalled ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setActive(model.id)}
                    className="flex min-w-0 items-start gap-2.5 rounded text-left focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    {identity}
                  </button>
                ) : (
                  <span className="flex min-w-0 items-start gap-2.5 text-left">{identity}</span>
                )}

                <span className="flex flex-none items-center gap-2">
                  <span className="flex items-center gap-0.5" aria-label={`Accuracy ${model.accuracy} of 5`}>
                    {[1, 2, 3, 4, 5].map((step) => (
                      <span
                        key={step}
                        className={cn(
                          'h-2.5 w-[3px] rounded-px',
                          step <= model.accuracy ? 'bg-accent' : 'bg-[#2e2e2e]',
                        )}
                      />
                    ))}
                  </span>
                  <span className="text-[11px] tabular-nums text-inkdim">{megabytes(model.mb)}</span>

                  {transfer ? (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setTransfers((current) => {
                          const next = { ...current }
                          delete next[model.id]
                          return next
                        })
                      }
                    >
                      <X size={14} />
                      Cancel
                    </Button>
                  ) : isInstalled ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${model.name}`}
                      onClick={() => {
                        const remaining = installed.filter((id) => id !== model.id)
                        setInstalled(remaining)
                        if (active === model.id) setActive(remaining[0] ?? '')
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  ) : (
                    <Button
                      onClick={() =>
                        setTransfers((current) => ({
                          ...current,
                          [model.id]: { received: 0, rate: 0 },
                        }))
                      }
                    >
                      <Download size={14} />
                      Download
                    </Button>
                  )}
                </span>

                {transfer && (
                  <div className="col-span-2 flex flex-col gap-1.5 pt-1">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-well ring-1 ring-line ring-inset">
                      <span
                        className="block h-full rounded-full bg-accent transition-[width] duration-150 ease-linear"
                        style={{ width: `${(transfer.received / totalBytes(model)) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2.5 text-[11px] tabular-nums text-inkmute">
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={11} className="animate-spin" />
                        {megabytes(transfer.received / 1024 / 1024, 1)} of {megabytes(model.mb)} ·{' '}
                        {rate(transfer.rate)}
                      </span>
                      <span>{eta((totalBytes(model) - transfer.received) / (transfer.rate || 1))}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-1 flex items-center justify-between gap-3 text-[11.5px] tabular-nums text-inkmute">
          <span>
            {installed.length} installed · {megabytes(usedMb)} on disk
          </span>
          <span className="flex items-center gap-1.5 text-success">
            <Check size={13} />
            Runs locally
          </span>
        </div>
      </Section>
    </Panel>
  )
}
