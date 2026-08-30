import { useState } from 'react'
import { Eye, EyeOff, Upload } from 'lucide-react'
import { SegmentedControl, Select, useElementSize } from '../../primitives'
import { rgba } from './format'
import { Button, CHECKER, ColorField, Panel, Readout, Reveal, Row, Section, Slider, TextArea, TextButton, Toggle, cn } from './ui'

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

  return (
    <Panel title="Text" width={340}>
      <Section
        label="Preview"
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

      <Section label="Content">
        <TextArea
          value={content}
          onChange={setContent}
          placeholder="Type the caption…"
          aria-label="Text content"
        />
      </Section>

      <Section label="Font">
        <div className="flex gap-1.5">
          <div className="min-w-0 flex-1">
            <Select options={FAMILIES} value={family} onChange={setFamily} aria-label="Font family" />
          </div>
          <div className="w-[104px] flex-none">
            <Select options={WEIGHTS} value={weight} onChange={setWeight} aria-label="Font weight" />
          </div>
        </div>

        <TextButton>
          <Upload size={13} />
          Add a font file
        </TextButton>

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

        <Row label="Italic">
          <Toggle checked={italic} onChange={setItalic} aria-label="Italic" />
        </Row>
      </Section>

      <Section label="Colour">
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

      <Section label="Effects">
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
