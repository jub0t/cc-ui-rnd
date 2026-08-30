import { ExportPanel } from './ExportPanel'
import { MediaPanel } from './MediaPanel'
import { TextPanel } from './TextPanel'
import { TranscriberPanel } from './TranscriberPanel'

export function EditorPanels() {
  return (
    <section data-tw className="mx-auto max-w-[1180px] font-ui text-ink">
      <header className="mx-auto mb-7 max-w-[640px] text-center">
        <h2 className="mb-1.5 text-xl font-semibold tracking-tight">Editor panels</h2>
        <p className="text-[13px] leading-relaxed text-inkmute">
          Standalone surfaces, each doing one job. Built with Tailwind on the same palette as
          the panels above.
        </p>
      </header>

      <div className="flex flex-wrap items-start justify-center gap-6">
        <TextPanel />
        <MediaPanel />
        <TranscriberPanel />
        <ExportPanel />
      </div>
    </section>
  )
}
