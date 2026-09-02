// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useEffect, useRef, useState } from 'react'
import { CheckIcon, Modal, Panel, Row, Section } from '../../primitives'
import styles from './task.module.css'

/**
 * The blocking-wait dialog: what a long job looks like while you cannot do
 * anything else.
 *
 * Two shapes, because real jobs come in two kinds. A caption pass knows how
 * much work it has, so it gets a real bar and named stages. Speech synthesis
 * does not, so it gets a sweep and an elapsed clock — inventing a percentage
 * for it would be a lie the user catches the moment it stalls at 90%.
 */

interface TaskSpec {
  id: string
  name: string
  note: string
  title: string
  description: string
  /** false when the work cannot report how far along it is */
  determinate: boolean
  duration: number
  stages: string[]
  result: string
}

const TASKS: TaskSpec[] = [
  {
    id: 'captions',
    name: 'Generate captions',
    note: 'Transcribes the timeline audio and writes a caption track',
    title: 'Generating captions',
    description: 'Keep this window open. Cancelling will not damage the clip.',
    determinate: true,
    duration: 6400,
    stages: ['Loading the model', 'Transcribing audio', 'Aligning words to the waveform', 'Writing the caption track'],
    result: '68 captions written to a new track',
  },
  {
    id: 'speech',
    name: 'Synthesise speech',
    note: 'Reads the script aloud in the selected voice',
    title: 'Synthesising speech',
    description: 'The voice server does not report progress, so this shows elapsed time instead.',
    determinate: false,
    duration: 4800,
    stages: ['Queued on the voice server', 'Rendering audio'],
    result: '0:41 of audio imported to the bin',
  },
]

const clock = (ms: number) => {
  const whole = Math.floor(ms / 1000)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function TaskModalDemo() {
  const [task, setTask] = useState<TaskSpec | null>(null)
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const startedAt = useRef(0)

  const running = task !== null && !finished

  useEffect(() => {
    if (!running || task === null) return
    let raf = 0
    const tick = (now: number) => {
      const ms = now - startedAt.current
      setElapsed(ms)
      const ratio = Math.min(1, ms / task.duration)
      setProgress(ratio)
      if (ratio >= 1) {
        setFinished(true)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, task])

  // The done state is worth seeing — a dialog that vanishes the instant the
  // work lands leaves you unsure it ever happened — but not worth dismissing
  // by hand, so it closes itself.
  useEffect(() => {
    if (!finished || task === null) return
    setResult(task.result)
    const id = window.setTimeout(() => setTask(null), 1500)
    return () => window.clearTimeout(id)
  }, [finished, task])

  const start = (spec: TaskSpec) => {
    startedAt.current = performance.now()
    setProgress(0)
    setElapsed(0)
    setFinished(false)
    setResult(null)
    setTask(spec)
  }

  const cancel = () => {
    setTask(null)
    setFinished(false)
    setResult('Cancelled — nothing was written')
  }

  const stage = task === null ? 0 : Math.min(task.stages.length - 1, Math.floor(progress * task.stages.length))

  return (
    <>
      <Panel title="Long tasks" width={420}>
        <Section title="Run something slow">
          {TASKS.map((spec) => (
            <Row key={spec.id}>
              <div className={styles.task}>
                <span className={styles.taskText}>
                  <span className={styles.taskName}>{spec.name}</span>
                  <span className={styles.taskNote}>{spec.note}</span>
                </span>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  disabled={task !== null}
                  onClick={() => start(spec)}
                >
                  Run
                </button>
              </div>
            </Row>
          ))}
        </Section>

        <div className={styles.result}>
          {result === null ? (
            <span>Either one blocks the page while it works.</span>
          ) : (
            <>
              <span className={styles.resultDot} />
              <span>{result}</span>
            </>
          )}
        </div>
      </Panel>

      <Modal
        open={task !== null}
        onClose={cancel}
        title={finished ? 'Done' : (task?.title ?? '')}
        description={finished ? undefined : task?.description}
        // A running job is not dismissed, it is cancelled — and that is a
        // decision, so it belongs on a button you had to aim at.
        dismissible={false}
        width={430}
        footer={
          finished ? (
            <button type="button" className={styles.button} onClick={() => setTask(null)}>
              Close
            </button>
          ) : (
            <button type="button" className={styles.button} onClick={cancel}>
              Cancel
            </button>
          )
        }
      >
        {task !== null && !finished && (
          <div style={{ marginTop: 12 }}>
            <div className={styles.meterRow}>
              <span className={styles.stage}>{task.stages[stage]}</span>
              <span className={styles.count}>
                {task.determinate ? `${Math.round(progress * 100)}%` : clock(elapsed)}
              </span>
            </div>

            <div
              className={styles.track}
              role="progressbar"
              aria-label={task.title}
              aria-valuenow={task.determinate ? Math.round(progress * 100) : undefined}
              aria-valuemin={task.determinate ? 0 : undefined}
              aria-valuemax={task.determinate ? 100 : undefined}
            >
              {task.determinate ? (
                <div className={styles.fill} style={{ width: `${progress * 100}%` }} />
              ) : (
                <div className={styles.sweep} />
              )}
            </div>

            <ul className={styles.steps}>
              {task.stages.map((label, index) => {
                const state = index < stage ? 'done' : index === stage ? 'on' : 'pending'
                return (
                  <li
                    key={label}
                    className={`${styles.step} ${state === 'on' ? styles.stepOn : ''} ${
                      state === 'done' ? styles.stepDone : ''
                    }`}
                  >
                    <span className={styles.mark}>
                      {state === 'done' ? (
                        <CheckIcon size={12} className={styles.tick} />
                      ) : state === 'on' ? (
                        <span className={styles.spinner} />
                      ) : (
                        <span className={styles.dot} />
                      )}
                    </span>
                    {label}
                    {state === 'on' && task.determinate && (
                      <span className={styles.elapsed}>{clock(elapsed)}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {finished && task !== null && (
          <div className={styles.done} style={{ marginTop: 10 }}>
            <span className={styles.doneMark}>
              <CheckIcon size={13} />
            </span>
            <span>
              {task.result} · took {clock(elapsed)}
            </span>
          </div>
        )}
      </Modal>
    </>
  )
}

export function TaskModalSection() {
  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <h2>Waiting</h2>
        <p>
          A blocking dialog over a blurred page, for the jobs you cannot work around — caption
          passes, voice synthesis, exports. Blurring rather than dimming is the point: a dimmed
          page still reads, so it still invites you to try the controls behind it. Tab stays inside
          the dialog, the page under it cannot scroll, and focus returns to the button you pressed.
        </p>
      </header>

      <div className={styles.centre}>
        <TaskModalDemo />
      </div>
    </section>
  )
}
