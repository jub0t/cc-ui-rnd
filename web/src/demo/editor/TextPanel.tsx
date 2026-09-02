// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useState } from 'react'
import { Eye, EyeOff, Italic, Upload } from 'lucide-react'
import { SegmentedControl, Select, useElementSize } from '../../primitives'
import { rgba } from './format'
import { Button, CHECKER, ColorField, Panel, Readout, Reveal, Row, Section, SliderField, TextArea, Toggle, cn } from './ui'

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

/** Fit hugs the text; Band runs the full frame, the way a lower third does. */
const PLATE_WIDTHS = [
  { value: 'fit', label: 'Fit' },
  { value: 'band', label: 'Band' },
] as const

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
  const [plateWidth, setPlateWidth] = useState<(typeof PLATE_WIDTHS)[number]['value']>('fit')
  // padding is held in em so the plate keeps its proportions when the text
  // is resized — a plate measured in pixels falls apart at another size
  const [padX, setPadX] = useState(0.6)
  const [padY, setPadY] = useState(0.3)
  // 0 = square, 1 = fully rounded, resolved against the plate's own height
  const [radius, setRadius] = useState(0.16)
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

  // A radius of 1 has to mean "pill" at any padding, so it resolves against
  // the plate's real half-height rather than a fixed length.
  const plateEmHeight = 1.25 + padY * 2
  const radiusPx = (radius * previewPx * plateEmHeight) / 2
  const radius1080 = Math.round((radius * projectPx * plateEmHeight) / 2)
  const isBand = plate && plateWidth === 'band'

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
          className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-md ring-1 ring-line ring-inset"
        >
          {guides && <span className="pointer-events-none absolute inset-[9%] border border-dashed border-white/20" />}

          {/* a band ignores the safe inset and runs edge to edge; a fitted
              plate stays inside it and hugs the text */}
          <div className={cn('w-full text-center', !isBand && 'px-[7%]')}>
            <p
              className={cn(
                'relative m-0 max-w-full text-center leading-tight [overflow-wrap:anywhere]',
                isBand ? 'block w-full' : 'inline-block',
              )}
              style={{
                fontFamily: family,
                fontWeight: weight,
                fontStyle: italic ? 'italic' : 'normal',
                fontSize: `${previewPx}px`,
                // the plate carries its own alpha, so text opacity cannot fade it
                background: plate ? rgba(plateColor, plateOpacity) : undefined,
                padding: plate ? `${padY}em ${padX}em` : undefined,
                borderRadius: plate ? `${radiusPx}px` : undefined,
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
          </div>

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
          primary="Size"
          secondary={`${projectPx} px at 1080p`}
        >
          <SliderField
            value={size}
            onChange={setSize}
            min={0.01}
            max={0.2}
            step={0.001}
            scale={100}
            precision={1}
            suffix="%"
            bubble={(v) => `${(v * 100).toFixed(1)}%`}
            aria-label="Text size"
          />
        </Readout>
      </Section>

      <Section collapsible label="Colour" summary={`${fill} · ${Math.round(opacity * 100)}%`}>
        <Row label="Fill">
          <ColorField value={fill} onChange={setFill} alpha={opacity} aria-label="Fill colour" />
        </Row>
        <Readout primary="Opacity">
          <SliderField
            value={opacity}
            onChange={setOpacity}
            min={0}
            max={1}
            step={0.01}
            scale={100}
            precision={0}
            suffix="%"
            ramp={`linear-gradient(90deg, transparent, ${fill})`}
            bubble={(v) => `${(v * 100).toFixed(0)}%`}
            aria-label="Opacity"
          />
        </Readout>
      </Section>

      <Section collapsible defaultOpen={false} label="Effects" summary={effectsSummary}>
        <Row label="Drop shadow">
          <Toggle checked={shadow} onChange={setShadow} aria-label="Drop shadow" />
        </Row>
        <Reveal open={shadow}>
          <Readout primary="Softness">
            <SliderField
              value={softness}
              onChange={setSoftness}
              min={0}
              max={1}
              step={0.01}
              scale={100}
              precision={0}
              suffix="%"
              bubble={(v) => `${(v * 100).toFixed(0)}%`}
              aria-label="Shadow softness"
            />
          </Readout>
          <Readout primary="Distance">
            <SliderField
              value={distance}
              onChange={setDistance}
              min={0}
              max={1}
              step={0.01}
              scale={100}
              precision={0}
              suffix="%"
              bubble={(v) => `${(v * 100).toFixed(0)}%`}
              aria-label="Shadow distance"
            />
          </Readout>
        </Reveal>

        <Row label="Plate">
          <Toggle checked={plate} onChange={setPlate} aria-label="Plate behind text" />
        </Row>
        <Reveal open={plate}>
          <Row label="Colour">
            <ColorField value={plateColor} onChange={setPlateColor} alpha={plateOpacity} aria-label="Plate colour" />
          </Row>

          <Row label="Width">
            <SegmentedControl
              options={PLATE_WIDTHS}
              value={plateWidth}
              onChange={setPlateWidth}
              aria-label="Plate width"
            />
          </Row>

          <Readout primary="Opacity">
            <SliderField
              value={plateOpacity}
              onChange={setPlateOpacity}
              min={0}
              max={1}
              step={0.01}
              scale={100}
              precision={0}
              suffix="%"
              ramp={`linear-gradient(90deg, transparent, ${plateColor})`}
              bubble={(v) => `${(v * 100).toFixed(0)}%`}
              aria-label="Plate opacity"
            />
          </Readout>

          <Readout primary="Padding X" secondary={`${Math.round(padX * projectPx)} px at 1080p`}>
            <SliderField
              value={padX}
              onChange={setPadX}
              min={0}
              max={2}
              step={0.02}
              scale={100}
              precision={0}
              suffix="%"
              bubble={(v) => `${(v * 100).toFixed(0)}%`}
              aria-label="Plate padding X"
            />
          </Readout>

          <Readout primary="Padding Y" secondary={`${Math.round(padY * projectPx)} px at 1080p`}>
            <SliderField
              value={padY}
              onChange={setPadY}
              min={0}
              max={2}
              step={0.02}
              scale={100}
              precision={0}
              suffix="%"
              bubble={(v) => `${(v * 100).toFixed(0)}%`}
              aria-label="Plate padding Y"
            />
          </Readout>

          <Readout
            primary="Corner radius"
            secondary={radius >= 0.995 ? 'Pill' : `${radius1080} px at 1080p`}
          >
            <SliderField
              value={radius}
              onChange={setRadius}
              min={0}
              max={1}
              step={0.01}
              scale={100}
              precision={0}
              suffix="%"
              bubble={(v) => `${(v * 100).toFixed(0)}%`}
              aria-label="Plate corner radius"
            />
          </Readout>
        </Reveal>
      </Section>
    </Panel>
  )
}
