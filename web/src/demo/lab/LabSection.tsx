import { KeyframeTrack } from './KeyframeTrack'
import { MixerStrip } from './MixerStrip'
import { TrimBar } from './TrimBar'
import styles from './lab.module.css'

export function LabSection() {
  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <h2>Combinations</h2>
        <p>Primitives wired together into working controls, on the same black as the panels above.</p>
      </header>

      <div className={styles.grid}>
        <TrimBar />
        <KeyframeTrack />
        <MixerStrip />
      </div>
    </section>
  )
}
