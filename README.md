# custom-primitives

Editor UI primitives for [Concat](https://github.com/jub0t/Concat), built twice
so the two stacks can be compared on the same design rather than in the abstract.

| Directory         | Stack                                      | Status                                               |
| ----------------- | ------------------------------------------ | ---------------------------------------------------- |
| [`web/`](web)     | Vite · React 19 · TypeScript · Tailwind v4 | Working reference implementation                     |
| [`slint/`](slint) | Rust · Slint 1.17                          | Primitives complete; two demo sections still to port |

## web/

```sh
npm --prefix web install
npm --prefix web run dev        # http://localhost:5173
npm --prefix web run build
npm --prefix web run typecheck
```

## slint/

```sh
cargo run --manifest-path slint/Cargo.toml            # debug
cargo run --release --manifest-path slint/Cargo.toml  # release
cargo build --release --no-default-features --features skia  # skia
```

## License

AGPL-3.0-or-later — the same terms as [Concat](https://github.com/jub0t/Concat)
itself, so this tree can merge into it without a relicensing step. Full text in
[LICENSE](./LICENSE).

**Slint is used under its GPL-3.0-only option**, not the Royalty-free or
commercial one. Slint offers all three at the user's choice, and nothing in the
source would otherwise record which applies here, so
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) states it and explains why
GPL-3.0 section 13 makes that combination conveyable alongside AGPL code.
Forking this tree under Slint's other licences means removing the AGPL code
first; the two do not mix.

Also here, matching the main repository:

- [LICENSE-EXCEPTIONS.md](./LICENSE-EXCEPTIONS.md) — plugins reaching Concat
  through the Concat API keep their own licence
- [TRADEMARK.md](./TRADEMARK.md) — the name is not part of the code grant
- [CLA.md](./CLA.md) — contributors keep copyright in their work
- [CONTRIBUTING.md](./CONTRIBUTING.md)

Embedded fonts (Inter under the SIL OFL, Synonym under the ITF FFL) ship inside
any binary built here — see the notices file.
