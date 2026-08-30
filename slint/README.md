# slint/

The primitive set from [`web/`](../web) rebuilt in Rust and Slint, against the
same tokens and the same reference design.

```sh
cargo run --manifest-path slint/Cargo.toml            # debug
cargo run --release --manifest-path slint/Cargo.toml  # release
```

## Layout

```
ui/
  theme.slint              design tokens, mirroring web/src/styles/tokens.css
  util.slint               Fmt / Geom helpers, and the globals Rust fills in
  icons.slint              Glyph enum + Icon, the counterpart of primitives/icons.tsx
  fonts/                   Inter 400/500/600, bundled (OFL, see LICENSE.txt)
  primitives/
    primitives.slint       barrel module — import from here
    panel.slint            Panel, PanelHeader, Section, SectionHeader,
                           SectionBody, Row, IconButton
    number-field.slint     drag to scrub, click to type
    stepper.slint          minus/plus pair with hold-to-repeat
    segmented-control.slint
    select.slint           listbox dropdown
    knob.slint             rotary control
    bezier-editor.slint    cubic-bezier curve editor
    level-meter.slint      audio meter with peak hold
    focus-ring.slint       the --cp-focus token, drawn rather than shadowed
  demo/
    editor-chrome.slint    EditorHeader, AlignToolbar
    effects-panel.slint    EffectsPanel + the EffectData struct
    transform-panel.slint
    interpolation-panel.slint
  app.slint                window, page chrome, the three-panel gallery
src/main.rs                models, the bezier solver, the two parsers
```

## What moved to Rust, and why

The behaviour is the expensive part, and Slint's expression language stops
exactly where an algorithm starts — it has no loops and no string splitting.
Those pieces sit in `src/main.rs` behind globals declared in `util.slint`:

| Global | Why it cannot be Slint |
| --- | --- |
| `Curves.ease` | Solving a cubic-bezier for y at x is Newton iteration |
| `Curves.parse` | `"0.42, 0, 0.58, 1"` needs `split(',')` |
| `Fmt.parse-timecode` | `"00:00:04"` needs `split(':')` |

`main.rs` also owns the effect lists, because a Slint `[T]` property has no
push or remove, and the simulated programme level, because Slint has no RNG.
Formatting in the other direction — `Fmt.timecode`, `Fmt.decibels` — is plain
arithmetic and stays in `util.slint`.

## Renderers

The default build uses FemtoVG, which is GPU-accelerated (OpenGL) and pure
Rust, so cross-compiling to macOS, Linux and Windows needs nothing beyond
`rustup target add`. Skia is available but opt-in:

```sh
cargo run --features skia          # A/B text fidelity on a dev box
SLINT_BACKEND=winit-femtovg cargo run --features skia   # force the other one
```

Skia is deliberately not the default. It is not a GPU-vs-no-GPU choice — both
render on the GPU. What Skia adds is text and path rasterization quality; what
it costs is a prebuilt C++ library that drags in `cc`, `bindgen` and
`clang-sys`, so every cross-compilation target needs a C++ toolchain and a
matching sysroot. It is toolchain-coupled at link time too: the prebuilt
`skia.lib` requires MSVC 17.13+ and fails with an opaque `LNK2019` on 17.12.

### Why the text weights differ from the tokens

`Theme.weight-body` is 500 and `Theme.weight-title` is 600, where `web/` uses
400 and 500. That is renderer compensation, not a design change: FemtoVG
composites glyph coverage without gamma correction, so light text on a dark
panel renders lighter than the same tokens do in a browser.

The compensation is deliberately confined to those two properties. Colours and
sizes stay byte-identical to `tokens.css`, because bending those to chase the
look would fork the design from `web/` silently — the exact drift this repo
exists to catch. Reset both to 400/500 when building with `--features skia`, or
if FemtoVG ever gains gamma-correct blending; leaving them on top of a
gamma-correct renderer will read as too heavy.

## Where the two implementations diverge

Everything below is a language difference, not a design change. The rendered
result is meant to be the same.

**One `@children` slot per component.** React passes a header's actions and its
body as two props. `Section` is therefore split, and the caller nests the two
halves — which also makes collapsing explicit, since an `if` drops the body out
of the layout the way `{showBody && ...}` drops it out of the tree:

```slint
Section {
    hdr := SectionHeader { title: "Layout"; collapsible: true; }
    if hdr.open: SectionBody { Row { /* ... */ } }
}
```

**Two-way bindings replace `value` + `onChange`.** The controlled-component
contract is spelled `value <=> root.speed`. A one-way `value:` binding is
dropped the moment the primitive writes back, so bind with `<=>` and use the
`changed` callback for side effects only.

**`format` / `parse` are callbacks with defaults**, overridden at the use site,
which is as close as Slint gets to passing a function as a prop.

**Focus rings are drawn, not shadowed.** Slint has no `box-shadow`, so
`FocusRing` paints the two rings of the `--cp-focus` token as rectangles.

**Icons are one instance per glyph.** `Path.commands` may only be set in a
binding and never read back, so `Icon` dispatches on a `Glyph` enum to a set of
literal command strings rather than looking one up in a table. Dynamic geometry
— the knob's arc, the bezier curve — uses the `MoveTo` / `ArcTo` / `CubicTo`
element API instead, which does take bound values.

**A `FocusScope` must come before the `TouchArea` it shares an element with.**
A FocusScope takes pointer events to focus itself; declared last, it sits on top
and swallows the click, leaving a control that shows a focus ring and does
nothing. Every primitive here declares the scope first and calls `.focus()`
explicitly from the TouchArea.

**Geometry is computed, not measured.** `useElementSize` exists because the DOM
will not tell you a flex child's width without asking. Slint's segments and
curve handles are laid out from the same arithmetic that positions them, so
there is no Slint counterpart to that hook.

## Not ported yet

- `Select` typeahead. Slint's string type has no prefix or substring test.
- `Select` lists longer than 240px clip instead of scrolling; the web version
  scrolls the listbox.
- The web demo's **Editor panels** (Text, Media, Transcriber, Export) and
  **Combinations** (Trim, Keyframes, Mixer) sections. The primitives they are
  built from are all here; the screens are not.
- Page scrolling. The window sizes to the three panels. A `Flickable` would
  fight the horizontal scrub gesture on every `NumberField`, so the shell is
  left unscrolled until that is worth solving properly.
