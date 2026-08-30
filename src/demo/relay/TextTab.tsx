import { useState } from 'react'
import { Eye, EyeOff, Upload } from 'lucide-react'
import { Select, cx, useElementSize } from '../../primitives'
import { rgba } from './format'
import { ColorField, Group, PropRow, ReadoutRow, Reveal, Slider, Toggle } from './controls'
import controls from './controls.module.css'
import shell from './relay.module.css'
import styles from './tabs.module.css'

const FAMILIES = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: 'Impact, sans-serif', label: 'Impact' },
]

const WEIGHTS = [
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extrabold' },
]

const PROJECT_HEIGHT = 1080

export function TextTab() {
  const [content, setContent] = useState('Do you really think you can do that?')
  const [family, setFamily] = useState(FAMILIES[0]!.value)
  const [weight, setWeight] = useState(700)
  const [size, setSize] = useState(0.045)
  const [italic, setItalic] = useState(false)
  const [fill, setFill] = useState('#ffffff')
  const [opacity, setOpacity] = useState(1)
  const [shadow, setShadow] = useState(true)
  const [shadowBlur, setShadowBlur] = useState(0.35)
  const [shadowOffset, setShadowOffset] = useState(0.3)
  const [plate, setPlate] = useState(false)
  const [plateColor, setPlateColor] = useState('#000000')
  const [plateOpacity, setPlateOpacity] = useState(0.55)
  const [guides, setGuides] = useState(true)

  // The canvas is measured so `size` can stay a fraction of frame height —
  // exactly what it means in the project file — while the preview shows the
  // real pixel result.
  const [canvasRef, canvas] = useElementSize<HTMLDivElement>()
  const previewPx = canvas.height * size
  const projectPx = Math.round(size * PROJECT_HEIGHT)

  const shadowPx = previewPx * shadowBlur
  const offsetPx = previewPx * shadowOffset * 0.35

  return (
    <div className={shell.split}>
      <div className={shell.stage}>
        <div className={styles.stageHead}>
          <h4 className={styles.stageTitle}>Preview</h4>
          <div className={styles.stageTools}>
            <button
              type="button"
              className={cx(shell.button, shell.buttonGhost)}
              onClick={() => setGuides((current) => !current)}
            >
              {guides ? <Eye size={14} /> : <EyeOff size={14} />}
              Title-safe guides
            </button>
          </div>
        </div>

        <div ref={canvasRef} className={styles.canvas}>
          {guides && <span className={styles.safeArea} />}
          <p
            className={cx(styles.previewText, plate && styles.previewPlate)}
            style={{
              fontFamily: family,
              fontWeight: weight,
              fontStyle: italic ? 'italic' : 'normal',
              fontSize: `${previewPx}px`,
              // the plate carries its own alpha, so text opacity cannot fade it
              background: plate ? rgba(plateColor, plateOpacity) : undefined,
            }}
          >
            <span
              style={{
                color: fill,
                opacity,
                textShadow: shadow ? `0 ${offsetPx}px ${shadowPx}px rgb(0 0 0 / 0.75)` : undefined,
              }}
            >
              {content || 'Your text'}
            </span>
          </p>
          <div className={styles.canvasMeta}>
            <span className={styles.canvasChip}>1920 × 1080</span>
            <span className={styles.canvasChip}>{projectPx} px cap height</span>
          </div>
        </div>
      </div>

      <div className={shell.inspector}>
        <Group label="Content">
          <textarea
            className={controls.textArea}
            value={content}
            aria-label="Text content"
            placeholder="Type the caption…"
            onChange={(event) => setContent(event.target.value)}
          />
        </Group>

        <Group label="Font">
          <div className={styles.fontRow}>
            <Select options={FAMILIES} value={family} onChange={setFamily} aria-label="Font family" />
            <Select options={WEIGHTS} value={weight} onChange={setWeight} aria-label="Font weight" />
          </div>
          <PropRow>
            <button type="button" className={shell.textButton}>
              <Upload size={13} />
              Add a font file
            </button>
          </PropRow>

          <ReadoutRow
            primary={`${(size * 100).toFixed(1)}% of frame height`}
            secondary={`${projectPx} px at 1080p`}
          >
            <Slider
              value={size}
              onChange={setSize}
              min={0.01}
              max={0.2}
              step={0.001}
              aria-label="Text size"
              bubble={(v) => `${(v * 100).toFixed(1)}%`}
            />
          </ReadoutRow>

          <PropRow label="Italic">
            <Toggle checked={italic} onChange={setItalic} aria-label="Italic" />
          </PropRow>
        </Group>

        <Group label="Colour">
          <PropRow label="Fill">
            <ColorField value={fill} onChange={setFill} alpha={opacity} aria-label="Fill colour" />
          </PropRow>

          <ReadoutRow primary="Opacity" secondary={`${Math.round(opacity * 100)}%`}>
            <Slider
              value={opacity}
              onChange={setOpacity}
              min={0}
              max={1}
              step={0.01}
              aria-label="Opacity"
              bubble={(v) => `${Math.round(v * 100)}%`}
              ramp={{ background: `linear-gradient(90deg, transparent, ${fill})` }}
            />
          </ReadoutRow>
        </Group>

        <Group label="Effects">
          <PropRow label="Drop shadow">
            <Toggle checked={shadow} onChange={setShadow} aria-label="Drop shadow" />
          </PropRow>
          <Reveal open={shadow}>
            <ReadoutRow primary="Softness" secondary={`${Math.round(shadowBlur * 100)}%`}>
              <Slider
                value={shadowBlur}
                onChange={setShadowBlur}
                min={0}
                max={1}
                step={0.01}
                aria-label="Shadow softness"
                bubble={(v) => `${Math.round(v * 100)}%`}
              />
            </ReadoutRow>
            <ReadoutRow primary="Distance" secondary={`${Math.round(shadowOffset * 100)}%`}>
              <Slider
                value={shadowOffset}
                onChange={setShadowOffset}
                min={0}
                max={1}
                step={0.01}
                aria-label="Shadow distance"
                bubble={(v) => `${Math.round(v * 100)}%`}
              />
            </ReadoutRow>
          </Reveal>

          <PropRow label="Plate">
            <Toggle checked={plate} onChange={setPlate} aria-label="Plate behind text" />
          </PropRow>
          <Reveal open={plate}>
            <PropRow label="Colour">
              <ColorField
                value={plateColor}
                onChange={setPlateColor}
                alpha={plateOpacity}
                aria-label="Plate colour"
              />
            </PropRow>
            <ReadoutRow primary="Plate opacity" secondary={`${Math.round(plateOpacity * 100)}%`}>
              <Slider
                value={plateOpacity}
                onChange={setPlateOpacity}
                min={0}
                max={1}
                step={0.01}
                aria-label="Plate opacity"
                bubble={(v) => `${Math.round(v * 100)}%`}
                ramp={{ background: `linear-gradient(90deg, transparent, ${plateColor})` }}
              />
            </ReadoutRow>
          </Reveal>
        </Group>
      </div>
    </div>
  )
}
