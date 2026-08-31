import { MediaBrowser } from './MediaBrowser'

export function MediaSection() {
  return (
    <section data-tw className="mx-auto max-w-[1180px] font-ui text-ink">
      <header className="mx-auto mb-7 max-w-[640px] text-center">
        <h2 className="mb-1.5 text-xl font-semibold tracking-tight">Media browser</h2>
        <p className="text-[13px] leading-relaxed text-inkmute">
          The editor's top-left library panel, rebuilt on this palette. Hover a clip to scrub it,
          hover a transition to play it, and walk the grid with the arrow keys. Every tile is drawn
          rather than shipped, so nothing here is a screenshot.
        </p>
      </header>

      <div className="flex justify-center">
        <MediaBrowser />
      </div>
    </section>
  )
}
