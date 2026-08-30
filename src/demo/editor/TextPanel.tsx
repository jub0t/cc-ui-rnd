import { useState } from 'react'
import { Eye, EyeOff, Italic, Upload } from 'lucide-react'
import { SegmentedControl, Select, useElementSize } from '../../primitives'
import { rgba } from './format'
import { Button, CHECKER, ColorField, Panel, Readout, Reveal, Row, Section, Slider, TextArea, Toggle, cn } from './ui'

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

/** Caption legibility depends on what is behind it, so the backdrop is a control. */
const BACKDROPS = [
  { value: 'checker', label: 'Alpha' },
  { value: 'black', label: 'Black' },
  { value: 'grey', label: 'Grey' },
  { value: 'white', label: 'White' },
] as const

const FILL: Record<string, string> = { black: '#000000', grey: '#7a7a7a', white: '#ffffff' }

const PROJECT_HEIGHT = 1080

export function TextPanel() {
  const [content, setContent] = useState('Do you really think you can do that?')
  const [family, setFamily] = useState(FAMILIES[0]!.value)
  const [weight, setWeight] = useState(700)
  const [size, setSize] = useState(0.045)
  const [italic, setItalic] = useState(false)
  const [fill, setFill] = useState('#ffffff')
  const [opacity, setOpacity] = useState(1)
  const [shadow, setShadow] = useState(true)
  const [softness, setSoftness] = useState(0.35)
  const [distance, setDistance] = useState(0.3)
  const [plate, setPlate] = useState(false)
  const [plateColor, setPlateColor] = useState('#000000')
  const [plateOpacity, setPlateOpacity] = useState(0.55)
  const [guides, setGuides] = useState(true)
  const [backdrop, setBackdrop] = useState<(typeof BACKDROPS)[number]['value']>('black')

  // Measured, so `size` can stay a fraction of frame height — what it actually
  // means in the project file — while the preview shows the real pixel result.
  const [canvasRef, canvas] = useElementSize<HTMLDivElement>()
  const previewPx = canvas.height * size
  const projectPx = Math.round(size * PROJECT_HEIGHT)

  // A collapsed section still has to report what it holds, otherwise folding
  // one hides settings you have no way of noticing are on.
  const familyLabel = FAMILIES.find((f) => f.value === family)?.label ?? family
  const weightLabel = WEIGHTS.find((w) => w.value === weight)?.label ?? weight
  const backdropLabel = BACKDROPS.find((b) => b.value === backdrop)?.label ?? backdrop
  const effectsSummary = [shadow && 'Shadow', plate && 'Plate'].filter(Boolean).join(' · ') || 'None'

  return (
    <Panel title="Text" width={340}>
      <Section
        collapsible
        label="Preview"
        summary={backdropLabel}
        action={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle title-safe guides"
            aria-pressed={guides}
            onClick={() => setGuides((current) => !current)}
          >
            {guides ? <Eye size={14} /> : <EyeOff size={14} />}
          </Button>
        }
      >
        <div
          ref={canvasRef}
          style={backdrop === 'checker' ? CHECKER : { background: FILL[backdrop] }}
          className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-md p-[7%] ring-1 ring-line ring-inset"
        >
          {guides && <span className="pointer-events-none absolute inset-[9%] border border-dashed border-white/20" />}

          <p
            className={cn('relative m-0 max-w-full text-center leading-tight [overflow-wrap:anywhere]', plate && 'rounded-[0.18em] px-[0.6em] py-[0.3em]')}
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
                textShadow: shadow
                  ? `0 ${previewPx * distance * 0.35}px ${previewPx * softness}px rgb(0 0 0 / 0.75)`
                  : undefined,
              }}
            >
              {content || 'Your text'}
            </span>
          </p>

          <div className="absolute bottom-2 left-2 flex gap-1.5 text-[10px] tabular-nums">
            <span className="rounded-sm bg-black/60 px-1.5 py-0.5 text-white/60">1920 × 1080</span>
            <span className="rounded-sm bg-black/60 px-1.5 py-0.5 text-white/60">{projectPx} px</span>
          </div>
        </div>

        <Row label="Backdrop">
          <SegmentedControl
            options={BACKDROPS}
            value={backdrop}
            onChange={setBackdrop}
            aria-label="Preview backdrop"
          />
        </Row>
      </Section>

      <Section collapsible label="Content" summary={content || 'Empty'}>
        <TextArea
          value={content}
          onChange={setContent}
          placeholder="Type the caption…"
          aria-label="Text content"
        />
      </Section>

      <Section
        collapsible
        label="Font"
        summary={`${familyLabel} ${weightLabel} · ${(size * 100).toFixed(1)}%`}
        action={
          <Button variant="ghost" size="icon" aria-label="Add a font file">
            <Upload size={14} />
          </Button>
        }
      >
        {/* One control per row, on the panel's own label grammar. Family gets
            the full width because font names are long; weight shares its row
            with italic because both describe the same style. */}
        <Row label="Family">
          <Select options={FAMILIES} value={family} onChange={setFamily} aria-label="Font family" />
        </Row>

        <Row label="Weight">
          <Select options={WEIGHTS} value={weight} onChange={setWeight} aria-label="Font weight" />
          <Button
            variant={italic ? 'primary' : 'default'}
            size="icon"
            aria-pressed={italic}
            aria-label="Italic"
            title="Italic"
            onClick={() => setItalic(!italic)}
          >
            <Italic size={13} />
          </Button>
        </Row>

        <Readout
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
        </Readout>
      </Section>

      <Section collapsible label="Colour" summary={`${fill} · ${Math.round(opacity * 100)}%`}>
        <Row label="Fill">
          <ColorField value={fill} onChange={setFill} alpha={opacity} aria-label="Fill colour" />
        </Row>
        <Readout primary="Opacity" secondary={`${Math.round(opacity * 100)}%`}>
          <Slider
            value={opacity}
            onChange={setOpacity}
            aria-label="Opacity"
            bubble={(v) => `${Math.round(v * 100)}%`}
            ramp={`linear-gradient(90deg, transparent, ${fill})`}
          />
        </Readout>
      </Section>

      <Section collapsible defaultOpen={false} label="Effects" summary={effectsSummary}>
        <Row label="Drop shadow">
          <Toggle checked={shadow} onChange={setShadow} aria-label="Drop shadow" />
        </Row>
        <Reveal open={shadow}>
          <Readout primary="Softness" secondary={`${Math.round(softness * 100)}%`}>
            <Slider value={softness} onChange={setSoftness} aria-label="Shadow softness" bubble={(v) => `${Math.round(v * 100)}%`} />
          </Readout>
          <Readout primary="Distance" secondary={`${Math.round(distance * 100)}%`}>
            <Slider value={distance} onChange={setDistance} aria-label="Shadow distance" bubble={(v) => `${Math.round(v * 100)}%`} />
          </Readout>
        </Reveal>

        <Row label="Plate">
          <Toggle checked={plate} onChange={setPlate} aria-label="Plate behind text" />
        </Row>
        <Reveal open={plate}>
          <Row label="Colour">
            <ColorField value={plateColor} onChange={setPlateColor} alpha={plateOpacity} aria-label="Plate colour" />
          </Row>
          <Readout primary="Plate opacity" secondary={`${Math.round(plateOpacity * 100)}%`}>
            <Slider
              value={plateOpacity}
              onChange={setPlateOpacity}
              aria-label="Plate opacity"
              bubble={(v) => `${Math.round(v * 100)}%`}
              ramp={`linear-gradient(90deg, transparent, ${plateColor})`}
            />
          </Readout>
        </Reveal>
      </Section>
    </Panel>
  )
}
