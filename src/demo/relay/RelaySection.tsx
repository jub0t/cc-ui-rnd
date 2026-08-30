import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Captions, Film, Type, Upload } from 'lucide-react'
import { cx, useElementSize } from '../../primitives'
import { ExportTab } from './ExportTab'
import { MediaTab } from './MediaTab'
import { TextTab } from './TextTab'
import { TranscriberTab } from './TranscriberTab'
import styles from './relay.module.css'

interface Tab {
  id: string
  label: string
  icon: ReactNode
  badge?: number
  render: () => ReactNode
}

const TABS: Tab[] = [
  { id: 'text', label: 'Text', icon: <Type size={15} />, render: () => <TextTab /> },
  { id: 'media', label: 'Media', icon: <Film size={15} />, badge: 8, render: () => <MediaTab /> },
  {
    id: 'transcriber',
    label: 'Transcriber',
    icon: <Captions size={15} />,
    render: () => <TranscriberTab />,
  },
  { id: 'export', label: 'Export', icon: <Upload size={15} />, render: () => <ExportTab /> },
]

export function RelaySection() {
  const [activeId, setActiveId] = useState('text')
  const [barRef, barSize] = useElementSize<HTMLDivElement>()
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const [ink, setInk] = useState<{ left: number; width: number } | null>(null)

  const index = TABS.findIndex((tab) => tab.id === activeId)
  const active = TABS[index] ?? TABS[0]!

  // The underline is measured from the live DOM so it tracks label widths as
  // the font loads, rather than assuming fixed tab sizes.
  useLayoutEffect(() => {
    const el = buttons.current[index]
    setInk(el ? { left: el.offsetLeft, width: el.offsetWidth } : null)
  }, [index, barSize.width])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (direction === 0) return
    event.preventDefault()
    const next = (index + direction + TABS.length) % TABS.length
    setActiveId(TABS[next]!.id)
    buttons.current[next]?.focus()
  }

  return (
    <section className={styles.root}>
      <header className={styles.sectionHead}>
        <h2>Relay — interface revamp</h2>
        <p>
          The same four screens, rebuilt around one rule: show the consequence, not the raw
          value. Drag the size slider, hover a clip to scrub it, start a model download, or
          change the export quality and watch the estimate move.
        </p>
      </header>

      <div className={styles.window}>
        <div ref={barRef} className={styles.tabBar} role="tablist" onKeyDown={onKeyDown}>
          {TABS.map((tab, i) => {
            const selected = tab.id === activeId
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  buttons.current[i] = el
                }}
                type="button"
                role="tab"
                id={`relay-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`relay-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                className={cx(styles.tab, selected && styles.tabActive)}
                onClick={() => setActiveId(tab.id)}
              >
                {tab.icon}
                {tab.label}
                {tab.badge !== undefined && <span className={styles.tabBadge}>{tab.badge}</span>}
              </button>
            )
          })}
          {ink && (
            <span
              className={styles.tabInk}
              aria-hidden
              style={{ transform: `translateX(${ink.left}px)`, width: ink.width }}
            />
          )}
        </div>

        <div
          className={styles.body}
          role="tabpanel"
          id={`relay-panel-${active.id}`}
          aria-labelledby={`relay-tab-${active.id}`}
        >
          {active.render()}
        </div>
      </div>
    </section>
  )
}
