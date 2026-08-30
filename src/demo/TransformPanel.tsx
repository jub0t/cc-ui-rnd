import { useState } from 'react'
import {
  AngleIcon,
  CopyIcon,
  EyeIcon,
  FlipHIcon,
  FlipVIcon,
  FrameIcon,
  IconButton,
  LockIcon,
  NumberField,
  Panel,
  PlusIcon,
  Row,
  Section,
  Select,
  Stepper,
} from '../primitives'
import { AlignToolbar, EditorHeader } from './EditorChrome'

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0')
const toTimecode = (seconds: number) =>
  [pad2(seconds / 3600), pad2((seconds / 60) % 60), pad2(seconds % 60)].join(':')
const fromTimecode = (text: string) =>
  text
    .split(':')
    .reverse()
    .reduce((total, part, index) => total + (Number.parseFloat(part) || 0) * 60 ** index, 0)

const H_ANCHORS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'L + R' },
] as const

const V_ANCHORS = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'both', label: 'T + B' },
] as const

const BLEND_MODES = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'add', label: 'Add' },
  { value: 'difference', label: 'Difference' },
] as const

export function TransformPanel() {
  const [speed, setSpeed] = useState(100)
  const [length, setLength] = useState(12)
  const [inPoint, setInPoint] = useState(4)
  const [outPoint, setOutPoint] = useState(16)
  const [x, setX] = useState(742)
  const [y, setY] = useState(386)
  const [rotate, setRotate] = useState(0)
  const [width, setWidth] = useState(1920)
  const [height, setHeight] = useState(1080)
  const [opacity, setOpacity] = useState(100)
  const [hAnchor, setHAnchor] = useState<(typeof H_ANCHORS)[number]['value']>('left')
  const [vAnchor, setVAnchor] = useState<(typeof V_ANCHORS)[number]['value']>('top')
  const [blend, setBlend] = useState<(typeof BLEND_MODES)[number]['value']>('normal')
  const [locked, setLocked] = useState(false)
  const [visible, setVisible] = useState(true)
  const [keys, setKeys] = useState({ x: false, y: false, rotate: false })

  const toggleKey = (which: keyof typeof keys) => (on: boolean) =>
    setKeys((current) => ({ ...current, [which]: on }))

  return (
    <Panel>
      <EditorHeader />
      <AlignToolbar />

      <Section title="Time" actions={<IconButton label="Add time keyframe"><PlusIcon /></IconButton>}>
        <Row label="Speed">
          <NumberField value={speed} onChange={setSpeed} min={1} max={1000} suffix="%" keyframe aria-label="Speed" />
          <Stepper
            aria-label="Speed"
            onStep={(direction, { shiftKey }) =>
              setSpeed((current) => Math.max(1, current + direction * (shiftKey ? 25 : 5)))
            }
          />
        </Row>
        <Row label="Length">
          <NumberField value={length} onChange={setLength} min={0} suffix="s" aria-label="Length" />
          <Stepper
            aria-label="Length"
            onStep={(direction) => setLength((current) => Math.max(0, current + direction))}
          />
        </Row>
        <Row label="In & Out">
          <NumberField
            value={inPoint}
            onChange={setInPoint}
            min={0}
            max={outPoint}
            format={toTimecode}
            parse={fromTimecode}
            aria-label="In point"
          />
          <NumberField
            value={outPoint}
            onChange={setOutPoint}
            min={inPoint}
            format={toTimecode}
            parse={fromTimecode}
            aria-label="Out point"
          />
        </Row>
      </Section>

      <Section title="Transform" actions={<IconButton label="Add transform keyframe"><PlusIcon /></IconButton>}>
        <Row label="Position">
          <NumberField
            value={x}
            onChange={setX}
            prefix="X"
            keyframe
            keyframed={keys.x}
            onKeyframedChange={toggleKey('x')}
            aria-label="Position X"
          />
          <NumberField
            value={y}
            onChange={setY}
            prefix="Y"
            keyframe
            keyframed={keys.y}
            onKeyframedChange={toggleKey('y')}
            aria-label="Position Y"
          />
        </Row>
        <Row>
          <Select
            options={H_ANCHORS}
            value={hAnchor}
            onChange={setHAnchor}
            aria-label="Horizontal anchor"
          />
        </Row>
        <Row>
          <Select options={V_ANCHORS} value={vAnchor} onChange={setVAnchor} aria-label="Vertical anchor" />
        </Row>
        <Row label="Rotate">
          <NumberField
            value={rotate}
            onChange={setRotate}
            prefix={<AngleIcon size={11} />}
            suffix="°"
            keyframe
            keyframed={keys.rotate}
            onKeyframedChange={toggleKey('rotate')}
            aria-label="Rotation"
          />
          <IconButton label="Duplicate"><CopyIcon /></IconButton>
          <IconButton label="Flip horizontal" onClick={() => setWidth((w) => w)}><FlipHIcon /></IconButton>
          <IconButton label="Flip vertical"><FlipVIcon /></IconButton>
        </Row>
      </Section>

      <Section
        title="Layout"
        collapsible
        actions={
          <>
            <IconButton label="Fit to frame"><FrameIcon /></IconButton>
            <IconButton label="Lock aspect ratio" active={locked} onClick={() => setLocked((l) => !l)}>
              <LockIcon />
            </IconButton>
            <IconButton label="Add layout keyframe"><PlusIcon /></IconButton>
          </>
        }
      >
        <Row label="Size">
          <NumberField
            value={width}
            onChange={(next) => {
              setWidth(next)
              if (locked) setHeight(Math.round((next * 9) / 16))
            }}
            prefix="W"
            min={1}
            keyframe
            aria-label="Width"
          />
          <NumberField
            value={height}
            onChange={(next) => {
              setHeight(next)
              if (locked) setWidth(Math.round((next * 16) / 9))
            }}
            prefix="H"
            min={1}
            keyframe
            aria-label="Height"
          />
        </Row>
      </Section>

      <Section
        title="Appearance"
        actions={
          <>
            <IconButton label="Toggle visibility" active={visible} onClick={() => setVisible((v) => !v)}>
              <EyeIcon />
            </IconButton>
            <IconButton label="Add appearance keyframe"><PlusIcon /></IconButton>
          </>
        }
      >
        <Row label="Opacity">
          <NumberField value={opacity} onChange={setOpacity} min={0} max={100} suffix="%" keyframe aria-label="Opacity" />
        </Row>
        <Row label="Blending">
          <Select options={BLEND_MODES} value={blend} onChange={setBlend} aria-label="Blending mode" />
        </Row>
      </Section>
    </Panel>
  )
}
