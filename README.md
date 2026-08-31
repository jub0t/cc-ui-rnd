# custom-primitives

Editor UI primitives for [WolfCut](https://github.com/jub0t/WolfCut), built twice
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
