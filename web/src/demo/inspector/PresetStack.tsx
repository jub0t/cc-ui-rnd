import { useState } from 'react'
import {
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  EyeIcon,
  IconButton,
  PlusIcon,
  Row,
  Section,
  SegmentedControl,
  cx,
} from '../../primitives'
import { HelpButton, Note, Param, SearchField } from './controls'
import type { Group, Preset } from './presets'
import styles from './inspector.module.css'

/** One preset in the chain: which one, whether it is live, and its values. */
export interface Applied {
  id: string
  on: boolean
  values: Record<string, number>
}

export function applyPreset(preset: Preset): Applied {
  return {
    id: preset.id,
    on: true,
    values: Object.fromEntries(preset.params.map((param) => [param.id, param.value])),
  }
}

/**
 * The applied chain plus the library that feeds it. Filters and effects differ
 * only in their catalogue, so both tabs are this component with different data.
 */
export function PresetStack({
  presets,
  groups,
  noun,
  applied,
  onChange,
}: {
  presets: readonly Preset[]
  groups: readonly Group[]
  /** lower-case singular, for labels and placeholders */
  noun: string
  applied: Applied[]
  onChange: (next: Applied[]) => void
}) {
  const [group, setGroup] = useState(groups[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [help, setHelp] = useState(false)

  const byId = (id: string) => presets.find((preset) => preset.id === id)
  const needle = query.trim().toLowerCase()
  const listed = presets.filter(
    (preset) => preset.group === group && preset.name.toLowerCase().includes(needle),
  )

  const patch = (index: number, next: Applied) =>
    onChange(applied.map((item, i) => (i === index ? next : item)))

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= applied.length) return
    const next = [...applied]
    const [pulled] = next.splice(index, 1)
    if (pulled) next.splice(target, 0, pulled)
    onChange(next)
  }

  return (
    <>
      {/* No empty shell: the section arrives with the first preset, the way the
          reference panel does, so an untouched clip shows only its library. */}
      {applied.length > 0 && (
        <Section
          title="Applied"
          actions={
            <HelpButton label={`About the ${noun} chain`} open={help} onToggle={() => setHelp((on) => !on)} />
          }
        >
          {help && (
            <Note>
              The chain runs top to bottom — reorder it with the chevrons. The eye bypasses one
              link without losing the values you dialled into it.
            </Note>
          )}

          <div className={styles.stack}>
            {applied.map((item, index) => {
              const preset = byId(item.id)
              if (!preset) return null
              return (
                <div key={item.id} className={cx(styles.card, !item.on && styles.cardOff)}>
                  <div className={styles.cardHead}>
                    <span className={styles.cardName}>{preset.name}</span>
                    <IconButton
                      label={item.on ? `Bypass ${preset.name}` : `Enable ${preset.name}`}
                      active={item.on}
                      className={styles.cardButton}
                      onClick={() => patch(index, { ...item, on: !item.on })}
                    >
                      <EyeIcon size={13} />
                    </IconButton>
                    <IconButton
                      label={`Move ${preset.name} up`}
                      disabled={index === 0}
                      className={styles.cardButton}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronDownIcon size={13} className={styles.flip} />
                    </IconButton>
                    <IconButton
                      label={`Move ${preset.name} down`}
                      disabled={index === applied.length - 1}
                      className={styles.cardButton}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDownIcon size={13} />
                    </IconButton>
                    <IconButton
                      label={`Remove ${preset.name}`}
                      className={cx(styles.cardButton, styles.remove)}
                      onClick={() => onChange(applied.filter((_, i) => i !== index))}
                    >
                      <CloseIcon size={13} />
                    </IconButton>
                  </div>

                  {preset.params.map((param) => (
                    <Param
                      key={param.id}
                      className={styles.inCard}
                      label={param.label}
                      value={item.values[param.id] ?? param.value}
                      onChange={(value) =>
                        patch(index, { ...item, values: { ...item.values, [param.id]: value } })
                      }
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      defaultValue={param.value}
                      format={param.format}
                      disabled={!item.on}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      <Section title={`${noun.charAt(0).toUpperCase()}${noun.slice(1)} library`}>
        <Row>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={`Search ${noun}s`}
            aria-label={`Search ${noun}s`}
          />
        </Row>
        <Row>
          <SegmentedControl
            options={groups.map(({ id, label }) => ({ value: id, label }))}
            value={group}
            onChange={setGroup}
            aria-label={`${noun} category`}
          />
        </Row>

        <div className={styles.list}>
          {listed.map((preset) => {
            const on = applied.some((item) => item.id === preset.id)
            return (
              <button
                key={preset.id}
                type="button"
                className={cx(styles.listRow, on && styles.listRowOn)}
                disabled={on}
                onClick={() => onChange([...applied, applyPreset(preset)])}
              >
                <span className={styles.listGlyph}>
                  {on ? <CheckIcon size={12} /> : <PlusIcon size={12} />}
                </span>
                <span className={styles.listName}>{preset.name}</span>
                {on && <span className={styles.listTag}>in chain</span>}
              </button>
            )
          })}
        </div>

        {listed.length === 0 && (
          <Note>
            Nothing in {groups.find((entry) => entry.id === group)?.label.toLowerCase()} matches
            that. The search covers the open category only.
          </Note>
        )}
      </Section>
    </>
  )
}
