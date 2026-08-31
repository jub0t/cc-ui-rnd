import { EffectsPanel } from './demo/EffectsPanel'
import { InterpolationPanel } from './demo/InterpolationPanel'
import { TransformPanel } from './demo/TransformPanel'
import { LabSection } from './demo/lab/LabSection'
import { EditorPanels } from './demo/editor/EditorPanels'
import { MediaSection } from './demo/media/MediaSection'
import { InspectorSection } from './demo/inspector/InspectorSection'
import { ContextMenuSection } from './demo/menu/ContextMenuDemo'
import { PreviewSection } from './demo/preview/PreviewPanel'
import { TaskModalSection } from './demo/task/TaskModalDemo'
import { TimelineSection } from './demo/timeline/TimelinePanel'
import { TextToSpeechSection } from './demo/tts/TextToSpeechModal'
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

      <hr className="divider" />
      <MediaSection />

      <hr className="divider" />
      <InspectorSection />

      <hr className="divider" />
      <ContextMenuSection />

      <hr className="divider" />
      <PreviewSection />

      <hr className="divider" />
      <TaskModalSection />

      <hr className="divider" />
      <TextToSpeechSection />

      <hr className="divider" />
      <TimelineSection />
    </main>
  )
}
