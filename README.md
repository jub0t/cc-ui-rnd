# custom-primitives

Editor UI primitives for [WolfCut](https://github.com/jub0t/WolfCut), built twice
so the two stacks can be compared on the same design rather than in the abstract.

| Directory | Stack | Status |
| --- | --- | --- |
| [`web/`](web) | Vite · React 19 · TypeScript · Tailwind v4 | Working reference implementation |
| [`slint/`](slint) | Rust · Slint 1.17 | Primitives complete; two demo sections still to port |

## web/

```sh
npm --prefix web install
npm --prefix web run dev        # http://localhost:5173
npm --prefix web run build
npm --prefix web run typecheck
```

Three sections on the page:

- **custom-primitives** — the primitive set: `NumberField` (drag to scrub, click
  to type), `Stepper`, `SegmentedControl`, `Select`, `Knob`, `BezierEditor`,
  `LevelMeter`, plus the `Panel`/`Section`/`Row` shell.
- **Editor panels** — Text, Media, Transcriber and Export as standalone panels.
- **Combinations** — Trim, Keyframes and Mixer, wiring the primitives together.

## slint/

```sh
cargo run --manifest-path slint/Cargo.toml            # debug
cargo run --release --manifest-path slint/Cargo.toml  # release
```

The same primitive set — `NumberField`, `Stepper`, `SegmentedControl`, `Select`,
`Knob`, `BezierEditor`, `LevelMeter` and the `Panel`/`Section`/`Row` shell —
plus the three gallery panels. The palette and metrics live in
[`ui/theme.slint`](slint/ui/theme.slint), mirroring `web/src/styles/tokens.css`,
so both implementations describe one product instead of drifting apart. Inter is
bundled rather than assumed, so a machine that has never installed it still
renders the reference face.

See [`slint/README.md`](slint/README.md) for the porting notes: where a Slint
component's single `@children` slot changes the shape of an API, why the
cubic-bezier solver and the two parsers live in Rust, and what is still missing.

## Porting notes

The behaviour is the expensive part, not the markup, and it is all pure
computation that moves to Rust unchanged. The cubic-bezier solver has made that
trip already, in [`slint/src/main.rs`](slint/src/main.rs). Still to follow:

- per-segment keyframe interpolation
- the console fader taper that puts 0 dB at ~90 % of the throw
- the shared dB axis binding meter fill, colour bands and printed scale
- export size estimation from bitrate, resolution and frame rate
