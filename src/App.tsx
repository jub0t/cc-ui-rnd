import { EffectsPanel } from './demo/EffectsPanel'
import { InterpolationPanel } from './demo/InterpolationPanel'
import { TransformPanel } from './demo/TransformPanel'
import { LabSection } from './demo/lab/LabSection'
import { EditorPanels } from './demo/editor/EditorPanels'
import './App.css'

export function App() {
  return (
    <main className="page">
      <header className="pageHeader">
        <h1>custom-primitives</h1>
        <p>
          Editor primitives reproduced from the reference inspector. Drag any number field
          sideways to scrub, click to type. Shift coarsens, Alt refines.
        </p>
      </header>
      <div className="gallery">
        <EffectsPanel />
        <TransformPanel />
        <InterpolationPanel />
      </div>

      <hr className="divider" />
      <EditorPanels />

      <hr className="divider" />
      <LabSection />
    </main>
  )
}
