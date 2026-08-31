import { ClipInspector } from './ClipInspector'
import { TextInspector } from './TextInspector'
import styles from './section.module.css'

export function InspectorSection() {
  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <h2>Inspectors</h2>
        <p>
          The editor's right-hand panels, on the same primitives as the inspectors at the top of
          the page. Drag a fader or scrub its field — either lands on the same value. Double-click
          any fader to restore its default, and the "?" buttons explain the settings that need it.
        </p>
      </header>

      <div className={styles.grid}>
        <ClipInspector />
        <TextInspector />
      </div>
    </section>
  )
}
