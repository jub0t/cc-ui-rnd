import { timecode } from '../demo/editor/format'

/** Label on the left, value hard right — a readout, not a form. */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-[5px]">
      <span className="flex-none text-[11.5px] text-inkmute">{label}</span>
      <span className="min-w-0 text-right text-[11.5px] break-words text-ink">{value}</span>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-3 py-2.5">
      <h3 className="mb-1 text-[10.5px] font-medium tracking-wide text-inkdim uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function Details({
  duration,
  tracks,
  clips,
  media,
}: {
  duration: number
  tracks: number
  clips: number
  media: number
}) {
  return (
    <div data-tw className="flex min-h-0 flex-1 flex-col font-ui">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Group title="Project">
          <Line label="Name" value="Untitled project" />
          <Line label="Folder" value="C:\Users\Editor\Documents\Relay\Untitled project" />
          <Line label="Output" value="1920 × 1080" />
          <Line label="Rate" value="30.00 fps" />
          <Line label="Duration" value={timecode(duration)} />
        </Group>

        <div className="mx-3 border-t border-line" />

        <Group title="Contents">
          <Line label="Media" value={String(media)} />
          <Line label="Tracks" value={String(tracks)} />
          <Line label="Clips" value={String(clips)} />
        </Group>
      </div>

      <div className="flex flex-none justify-end border-t border-line p-2.5">
        <button
          type="button"
          className="inline-flex h-7 items-center rounded-md border border-line bg-field px-3 text-[11.5px] font-medium text-ink transition-colors hover:border-edge hover:bg-fieldhi focus-visible:ring-1 focus-visible:ring-accent"
        >
          Modify
        </button>
      </div>
    </div>
  )
}
