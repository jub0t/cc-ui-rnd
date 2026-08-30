import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, FolderOpen, Loader2, Upload, X } from 'lucide-react'
import { Select, clamp, cx } from '../../primitives'
import { Group, PropRow, Progress } from './controls'
import { bytes, duration, eta, midTruncate } from './format'
import controls from './controls.module.css'
import shell from './relay.module.css'
import styles from './tabs.module.css'

const RESOLUTIONS = [
  { value: 2160, label: '3840 × 2160 (4K)' },
  { value: 1440, label: '2560 × 1440 (1440p)' },
  { value: 1080, label: '1920 × 1080 (1080p)' },
  { value: 720, label: '1280 × 720 (720p)' },
]

const FPS = [
  { value: 24, label: '24 fps' },
  { value: 30, label: '30 fps' },
  { value: 60, label: '60 fps' },
]

/** Video bitrate in Mbps at 1080p30, scaled below by pixels and frame rate. */
const TIERS = [
  { value: 'high', label: 'High', note: 'Archival master', mbps: 16 },
  { value: 'balanced', label: 'Balanced', note: 'Recommended', mbps: 8 },
  { value: 'small', label: 'Small', note: 'Quick share', mbps: 4 },
] as const

type Tier = (typeof TIERS)[number]['value']

const AUDIO_BPS = 192_000
const PROJECT_SECONDS = 154

/** Size the export will actually be — the number the tier choice hinges on. */
function estimate(mbps: number, height: number, fps: number, seconds: number) {
  const pixelScale = (height * height * (16 / 9)) / (1080 * 1920)
  const fpsScale = fps / 30
  const videoBps = mbps * 1_000_000 * pixelScale * fpsScale
  return ((videoBps + AUDIO_BPS) * seconds) / 8
}

const PHASES = [
  { until: 0.68, label: 'Rendering video' },
  { until: 0.88, label: 'Encoding audio' },
  { until: 1, label: 'Finalising file' },
]

const FOLDER = 'C:\\Users\\jfore\\OneDrive\\Documents\\Desktop\\Relay'

export function ExportTab() {
  const [tier, setTier] = useState<Tier>('balanced')
  const [height, setHeight] = useState(1080)
  const [fps, setFps] = useState(30)
  const [filename, setFilename] = useState('Monaco_cut_v4')
  const [progress, setProgress] = useState<number | null>(null)
  const [complete, setComplete] = useState(false)

  const frame = useRef(0)
  const lastAt = useRef(0)
  const exporting = progress !== null

  useEffect(() => {
    if (!exporting) {
      lastAt.current = 0
      return
    }
    const tick = (now: number) => {
      const dt = Math.min((now - (lastAt.current || now)) / 1000, 0.1)
      lastAt.current = now
      setProgress((current) => {
        if (current === null) return current
        // encode passes are not linear; the audio pass runs quicker
        const speed = current < 0.68 ? 0.16 : current < 0.88 ? 0.42 : 0.22
        return clamp(current + speed * dt, 0, 1)
      })
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [exporting])

  useEffect(() => {
    if (progress !== null && progress >= 1) {
      setProgress(null)
      setComplete(true)
    }
  }, [progress])

  const size = estimate(
    TIERS.find((t) => t.value === tier)?.mbps ?? 8,
    height,
    fps,
    PROJECT_SECONDS,
  )

  const phase = PHASES.find((p) => (progress ?? 0) < p.until) ?? PHASES[PHASES.length - 1]!
  const remaining = progress === null ? 0 : ((1 - progress) / 0.2) * 1.4

  return (
    <div className={styles.exportWrap}>
      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          <span className={styles.summaryKey}>Format</span>
          <span className={styles.summaryValue}>
            {Math.round((height * 16) / 9)} × {height} · {fps} fps · H.264
          </span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryKey}>Duration</span>
          <span className={styles.summaryValue}>{duration(PROJECT_SECONDS)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryKey}>Contents</span>
          <span className={styles.summaryValue}>8 clips · 3 titles · 2 audio tracks</span>
        </div>
      </div>

      <Group label="Destination">
        <PropRow>
          <div className={styles.destRow}>
            <input
              className={controls.textInput}
              value={filename}
              aria-label="File name"
              onChange={(event) => setFilename(event.target.value)}
            />
            <button type="button" className={shell.button}>
              <FolderOpen size={14} />
              Browse
            </button>
          </div>
        </PropRow>
        {/* the full path lives under the field, so the editable filename is
            never the part that gets truncated away */}
        <span className={styles.pathHint}>{midTruncate(`${FOLDER}\\${filename}.mp4`, 58)}</span>
      </Group>

      <Group label="Output">
        <PropRow label="Resolution">
          <Select options={RESOLUTIONS} value={height} onChange={setHeight} aria-label="Resolution" />
        </PropRow>
        <PropRow label="Frame rate">
          <Select options={FPS} value={fps} onChange={setFps} aria-label="Frame rate" />
        </PropRow>
      </Group>

      <Group label="Quality">
        <div className={styles.qualityGrid} role="radiogroup" aria-label="Quality">
          {TIERS.map((option) => {
            const selected = option.value === tier
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={cx(styles.quality, selected && styles.qualityOn)}
                onClick={() => setTier(option.value)}
              >
                <span className={styles.qualityName}>{option.label}</span>
                <span className={styles.qualityNote}>{option.note}</span>
                {/* the deciding number, on the card instead of nowhere */}
                <span className={styles.qualitySize}>
                  ~{bytes(estimate(option.mbps, height, fps, PROJECT_SECONDS))}
                </span>
              </button>
            )
          })}
        </div>
      </Group>

      <div className={cx(styles.exportWrap, styles.exportFoot)} style={{ padding: '0 22px' }}>
        {exporting ? (
          <div className={styles.exportProgress}>
            <div className={styles.exportPhase}>
              <span className={styles.exportPhaseName}>
                <Loader2 size={14} className={shell.spin} />
                {phase.label}
                <span style={{ color: 'var(--rl-fg-muted)' }}>
                  {Math.round((progress ?? 0) * 100)}%
                </span>
              </span>
              <span className={styles.exportEta}>{eta(remaining)}</span>
            </div>
            <Progress value={progress ?? 0} />
            <button
              type="button"
              className={cx(shell.button, shell.buttonGhost)}
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setProgress(null)}
            >
              <X size={14} />
              Cancel export
            </button>
          </div>
        ) : complete ? (
          <div className={styles.exportProgress}>
            <span className={styles.doneRow}>
              <CheckCircle2 size={16} />
              Exported {filename}.mp4 · {bytes(size)}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className={shell.button}>
                <FolderOpen size={14} />
                Show in folder
              </button>
              <button
                type="button"
                className={cx(shell.button, shell.buttonGhost)}
                onClick={() => setComplete(false)}
              >
                Export again
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={cx(shell.button, shell.buttonPrimary, shell.buttonLarge, shell.buttonBlock)}
            onClick={() => {
              setComplete(false)
              setProgress(0)
            }}
          >
            <Upload size={15} />
            Export · ~{bytes(size)}
          </button>
        )}
      </div>
    </div>
  )
}
