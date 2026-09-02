# Contributing to cc-slint-ui

This is the UI research tree for [Concat](https://github.com/jub0t/Concat): the
same editor primitives built twice, in React and in Slint, so the two stacks can
be compared on one design rather than argued about in the abstract.

It is an R&D repository. Things here are expected to be torn out and rebuilt,
and code that works its way into a conclusion usually ends up merged into Concat
proper.

## Building

```sh
npm --prefix web install
npm --prefix web run dev          # http://localhost:5173
npm --prefix web run typecheck

cargo run --manifest-path slint/Cargo.toml            # debug
cargo run --release --manifest-path slint/Cargo.toml  # release
```

Before opening a PR:

```sh
npm --prefix web run typecheck
cargo fmt --manifest-path slint/Cargo.toml -- --check
cargo clippy --manifest-path slint/Cargo.toml
```

`.cargo/config.toml` sets `-C target-cpu=native`, so binaries built here run on
this machine and machines like it. Override `RUSTFLAGS` before building anything
for someone else.

## Licensing your contribution

This tree is **AGPL-3.0-or-later** ([`LICENSE`](LICENSE)) — deliberately the same
terms as Concat, so code can move between the two repositories without a
relicensing step.

**Slint is used under its GPL-3.0-only option.** Please do not introduce code or
build configurations that depend on Slint's Royalty-free or commercial licences;
both are aimed at proprietary distribution and neither can pass on the freedoms
this project's licence promises. See
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

Contributions are accepted under the CLA in [`CLA.md`](CLA.md). You keep the
copyright in your work. Sign off to indicate agreement:

```sh
git commit -s -m "your message"
```

Typo and documentation fixes do not need a sign-off.

### File headers

Every source file — `.rs`, `.slint`, `.ts`, `.tsx`, `.css` — starts with:

```
// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors
```

(`/* … */` in CSS.) Add your own copyright line if you want one; don't replace
what is there.

### Adding dependencies

New dependencies must be compatible with AGPL-3.0-or-later. Say what you are
adding and why in the PR — an R&D tree accumulates them quickly, and a licence
problem is far cheaper to catch before a merge than after this code lands in
Concat.

## Trademarks

The code is free to fork; *Concat* and the logo are not part of that grant. See
[`TRADEMARK.md`](TRADEMARK.md).
