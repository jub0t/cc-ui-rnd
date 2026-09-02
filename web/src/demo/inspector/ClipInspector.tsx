// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useState } from 'react'
import { Panel, Section, SegmentedControl } from '../../primitives'
import { HelpButton, Note, Param, SwitchRow } from './controls'
import { PresetStack, applyPreset } from './PresetStack'
import type { Applied } from './PresetStack'
import { EFFECTS, EFFECT_GROUPS, FILTERS, FILTER_GROUPS } from './presets'
import styles from './inspector.module.css'

/**
 * The editor's clip inspector: one panel, three tabs, built from the same
 * primitives as the panels at the top of this page.
 *
 * The reference pairs each control with a formatted readout above it and a raw
 * number field beside it. That looks like a duplicate until you use it — the
 * readout is the value in a unit you reason about ("none", "auto", "1.00x"),
 * the field is the number you can type into. Keeping both is what lets a fade
 * of zero say "none" without making zero un-typeable.
 */

const TABS = [
  { value: 'adjust', label: 'Adjust' },
  { value: 'filters', label: 'Filters' },
  { value: 'effects', label: 'Effects' },
] as const

type Tab = (typeof TABS)[number]['value']

const dB = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`
const rate = (value: number) => `${value.toFixed(2)}x`
const fade = (value: number) => (value === 0 ? 'none' : `${value.toFixed(1)} s`)

export function ClipInspector() {
  const [tab, setTab] = useState<Tab>('adjust')

  const [level, setLevel] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [pitchWithSpeed, setPitchWithSpeed] = useState(false)
  const [fadeIn, setFadeIn] = useState(0)
  const [fadeOut, setFadeOut] = useState(0)

  const [speedHelp, setSpeedHelp] = useState(false)
  const [pitchHelp, setPitchHelp] = useState(false)

  // Starts with the reference's state: one filter applied, at its own default.
  const [filters, setFilters] = useState<Applied[]>(() => {
    const sweet = FILTERS.find((preset) => preset.id === 'sweet')
    return sweet ? [applyPreset(sweet)] : []
  })
  const [effects, setEffects] = useState<Applied[]>([])

  return (
    <Panel>
      <div className={styles.tabs}>
        <SegmentedControl options={TABS} value={tab} onChange={setTab} aria-label="Clip inspector tab" />
      </div>

      {tab === 'adjust' && (
        <>
          <Section title="Volume">
            <Param
              label="Level"
              value={level}
              onChange={setLevel}
              min={-60}
              max={12}
              step={0.5}
              defaultValue={0}
              format={dB}
            />
          </Section>

          <Section
            title="Speed"
            actions={
              <HelpButton label="About speed" open={speedHelp} onToggle={() => setSpeedHelp((on) => !on)} />
            }
          >
            {speedHelp && (
              <Note>
                Rate re-times the clip in place, so the timeline length changes with it. Trim
                afterwards, not before.
              </Note>
            )}
            <Param
              label="Rate"
              value={speed}
              onChange={setSpeed}
              min={0.25}
              max={4}
              step={0.05}
              defaultValue={1}
              format={rate}
            />
            <SwitchRow
              label="Change pitch with speed"
              checked={pitchWithSpeed}
              onChange={setPitchWithSpeed}
              help={
                <HelpButton
                  label="About pitch and speed"
                  open={pitchHelp}
                  onToggle={() => setPitchHelp((on) => !on)}
                />
              }
            />
            {pitchHelp && (
              <Note>
                On, the clip behaves like tape — faster runs higher. Off, the pitch is held while
                the rate changes, which is what you want under dialogue.
              </Note>
            )}
          </Section>

          <Section title="Fades">
            <Param
              label="Fade in"
              value={fadeIn}
              onChange={setFadeIn}
              min={0}
              max={5}
              step={0.1}
              format={fade}
            />
            <Param
              label="Fade out"
              value={fadeOut}
              onChange={setFadeOut}
              min={0}
              max={5}
              step={0.1}
              format={fade}
            />
          </Section>
        </>
      )}

      {tab === 'filters' && (
        <PresetStack
          presets={FILTERS}
          groups={FILTER_GROUPS}
          noun="filter"
          applied={filters}
          onChange={setFilters}
        />
      )}

      {tab === 'effects' && (
        <PresetStack
          presets={EFFECTS}
          groups={EFFECT_GROUPS}
          noun="effect"
          applied={effects}
          onChange={setEffects}
        />
      )}
    </Panel>
  )
}
