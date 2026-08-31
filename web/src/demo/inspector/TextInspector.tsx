import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Panel, PlusIcon, Row, Section, SegmentedControl, Select, clamp } from '../../primitives'
import { HelpButton, Note, Param, SwitchRow } from './controls'
import styles from './inspector.module.css'

/**
 * The title/caption inspector.
 *
 * Sizes and offsets are stored as a fraction of the frame, not in pixels —
 * that is what lets one title survive a switch from 1080p to a vertical
 * export. The readout does the conversion so you can still think in percent:
 * the field holds 0.045, the label says "4.5% of height".
 */

/* Real families with real fallbacks. A picker that lists a font nobody has
   installed and quietly renders something else teaches you to distrust the
   preview; in a shipping editor this list comes from the system. */
const FAMILIES = [
  { value: 'Inter', label: 'Inter', stack: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { value: 'Georgia', label: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
  { value: 'Trebuchet', label: 'Trebuchet MS', stack: "'Trebuchet MS', Verdana, sans-serif" },
  { value: 'Courier', label: 'Courier New', stack: "'Courier New', ui-monospace, monospace" },
  { value: 'Impact', label: 'Impact', stack: "Impact, 'Arial Black', sans-serif" },
] as const

const WEIGHTS = [
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'SemiBold' },
  { value: 700, label: 'Bold' },
  { value: 900, label: 'Black' },
] as const

const ALIGN = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
] as const

const HEX = /^#[0-9a-f]{6}$/i

/** The sample box stands in for the program monitor this panel normally sits
 *  beside — a text inspector with no visible text is a form, not a tool. */
const SAMPLE_HEIGHT = 420

const ofHeight = (value: number) => `${(value * 100).toFixed(1)}% of height`
const asPercent = (value: number) => `${(value * 100).toFixed(1)}%`
const centred = (value: number) => (value === 0 ? 'centred' : asPercent(value))
const none = (value: number) => (value === 0 ? 'none' : asPercent(value))

export function TextInspector() {
  const [content, setContent] = useState('Do you really think you can do that?')
  const [family, setFamily] = useState<(typeof FAMILIES)[number]['value']>('Inter')
  const [weight, setWeight] = useState<(typeof WEIGHTS)[number]['value']>(700)
  const [size, setSize] = useState(0.045)
  const [italic, setItalic] = useState(false)

  const [fill, setFill] = useState('#ffffff')
  const [hexDraft, setHexDraft] = useState<string | null>(null)
  const [opacity, setOpacity] = useState(1)
  const [shadow, setShadow] = useState(true)
  const [plate, setPlate] = useState(false)

  const [outline, setOutline] = useState(0)
  const [align, setAlign] = useState<(typeof ALIGN)[number]['value']>('center')
  const [lineHeight, setLineHeight] = useState(1.2)
  const [tracking, setTracking] = useState(0)
  const [horizontal, setHorizontal] = useState(0)
  const [vertical, setVertical] = useState(0)

  const [shadowHelp, setShadowHelp] = useState(false)
  const [plateHelp, setPlateHelp] = useState(false)

  const stack = FAMILIES.find((entry) => entry.value === family)?.stack
  const strokeWidth = outline * SAMPLE_HEIGHT

  const sampleText: CSSProperties = {
    fontFamily: stack,
    fontWeight: weight,
    fontStyle: italic ? 'italic' : 'normal',
    fontSize: size * SAMPLE_HEIGHT,
    lineHeight,
    letterSpacing: `${tracking}em`,
    color: fill,
    opacity,
    textShadow: shadow ? '0 2px 6px rgb(0 0 0 / 0.75)' : undefined,
    WebkitTextStroke: strokeWidth > 0 ? `${strokeWidth}px #000` : undefined,
    paintOrder: 'stroke fill',
    background: plate ? 'rgb(0 0 0 / 0.72)' : undefined,
    padding: plate ? '2px 8px' : undefined,
    borderRadius: plate ? 'var(--cp-r-xs)' : undefined,
    transform: `translate(${horizontal * 100}%, ${vertical * -100}%)`,
  }

  const commitHex = (text: string) => {
    const candidate = text.trim().replace(/^#?/, '#')
    if (HEX.test(candidate)) setFill(candidate.toLowerCase())
    setHexDraft(null)
  }

  return (
    <Panel title="Text">
      <div
        className={styles.sample}
        style={{ justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center' }}
      >
        <span className={styles.sampleText} style={sampleText}>
          {content || 'Type something'}
        </span>
      </div>

      <Section title="Content">
        <Row>
          <textarea
            className={styles.textarea}
            value={content}
            spellCheck={false}
            aria-label="Title text"
            placeholder="Type the title"
            onChange={(event) => setContent(event.target.value)}
          />
        </Row>
      </Section>

      <Section title="Font">
        <Row>
          <Select options={FAMILIES} value={family} onChange={setFamily} aria-label="Font family" />
        </Row>
        <Row>
          <button type="button" className={styles.dashed}>
            <PlusIcon size={13} />
            Add font file
          </button>
        </Row>
        <Row>
          <Select options={WEIGHTS} value={weight} onChange={setWeight} aria-label="Font weight" />
        </Row>
        <Param
          label="Size"
          value={size}
          onChange={setSize}
          min={0.01}
          max={0.4}
          step={0.001}
          defaultValue={0.045}
          format={ofHeight}
        />
        <SwitchRow label="Italic" checked={italic} onChange={setItalic} />
      </Section>

      <Section title="Colour">
        <Row label="Fill">
          <input
            className={styles.hex}
            value={hexDraft ?? fill}
            spellCheck={false}
            aria-label="Fill colour"
            onChange={(event) => setHexDraft(event.target.value)}
            onBlur={(event) => commitHex(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                setHexDraft(null)
                event.currentTarget.blur()
              }
            }}
          />
          <span className={styles.swatch} style={{ background: fill }}>
            <input
              type="color"
              className={styles.swatchInput}
              value={fill}
              aria-label="Pick fill colour"
              onChange={(event) => setFill(event.target.value)}
            />
          </span>
        </Row>

        <Param
          label="Opacity"
          value={opacity}
          onChange={(value) => setOpacity(clamp(value, 0, 1))}
          min={0}
          max={1}
          step={0.01}
          defaultValue={1}
          format={(value) => `${Math.round(value * 100)}%`}
        />

        <SwitchRow
          label="Drop shadow"
          checked={shadow}
          onChange={setShadow}
          help={
            <HelpButton
              label="About drop shadow"
              open={shadowHelp}
              onToggle={() => setShadowHelp((on) => !on)}
            />
          }
        />
        {shadowHelp && (
          <Note>Cheap separation from a busy frame. It costs legibility on a dark background.</Note>
        )}

        <SwitchRow
          label="Plate behind text"
          checked={plate}
          onChange={setPlate}
          help={
            <HelpButton
              label="About the plate"
              open={plateHelp}
              onToggle={() => setPlateHelp((on) => !on)}
            />
          }
        />
        {plateHelp && (
          <Note>
            A solid card behind the words. Guarantees contrast over any footage, which is why
            burned-in captions use one.
          </Note>
        )}
      </Section>

      <Section title="Outline">
        <Param
          label="Width"
          value={outline}
          onChange={setOutline}
          min={0}
          max={0.02}
          step={0.001}
          format={none}
        />
      </Section>

      <Section title="Layout">
        <Row>
          <SegmentedControl options={ALIGN} value={align} onChange={setAlign} aria-label="Alignment" />
        </Row>
        <Param
          label="Line height"
          value={lineHeight}
          onChange={setLineHeight}
          min={0.8}
          max={3}
          step={0.05}
          defaultValue={1.2}
          format={(value) => value.toFixed(2)}
        />
        <Param
          label="Tracking"
          value={tracking}
          onChange={setTracking}
          min={-0.05}
          max={0.3}
          step={0.001}
          defaultValue={0}
          format={asPercent}
        />
      </Section>

      <Section title="Position">
        <Param
          label="Horizontal"
          value={horizontal}
          onChange={setHorizontal}
          min={-0.5}
          max={0.5}
          step={0.0005}
          defaultValue={0}
          format={centred}
        />
        <Param
          label="Vertical"
          value={vertical}
          onChange={setVertical}
          min={-0.5}
          max={0.5}
          step={0.0005}
          defaultValue={0}
          format={centred}
        />
      </Section>
    </Panel>
  )
}
