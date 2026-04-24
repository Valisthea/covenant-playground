# Covenant Playground

Browser-based Covenant compiler + simulator + Sepolia deploy — **zero install required**.

Live: [playground.covenant-lang.org](https://playground.covenant-lang.org)

## What it is

- **Monaco editor** with full Covenant syntax highlighting (same engine as VS Code).
- **In-browser compiler** — `.cov` source -> WebAssembly, running entirely client-side. No server round-trip.
- **MockChain simulator** — run compiled contracts against an EVM-opcode interpreter in the tab.
- **Sepolia deploy** — connect MetaMask and ship real transactions.
- **Share via URL** — LZ-string-compressed source encoded in the query string.
- **15 curated examples** from Hello Contract to the Amnesia ceremony.

## Status

**Tier 1 — Core IDE (in progress).** See `docs/sprint-17-plan.md` for the 4-tier, 6-8-week roadmap. Tier 1 ships Monaco + the compiler wrapper + the output panes. Tier 2 adds MockChain + MetaMask. Tier 3 adds the privacy / FHE / ZK / Amnesia visualizers. Tier 4 is polish.

## Local dev

```bash
npm install
npm run dev         # http://localhost:3000
npm run build       # production bundle -> dist/
npm run typecheck   # tsc --noEmit
```

## WASM compiler integration

The playground expects the Covenant compiler to be packaged as a `wasm-bindgen` npm module living at `public/covenant-wasm/`:

```
public/covenant-wasm/
├── covenant_wasm_bindings.js        # wasm-bindgen glue
├── covenant_wasm_bindings_bg.wasm   # compiler binary
└── covenant_wasm_bindings.d.ts      # types
```

Until the real bundle is wired up, `src/lib/covenant-compiler.ts` runs in **stub mode**: it returns synthesized `CompileResult` objects so the UI is fully testable end-to-end. Flip `USE_STUB_COMPILER = false` in that file once the real module is dropped into `public/covenant-wasm/`.

To build the real bundle from the compiler repo:

```bash
cd ../covenant-src/crates/covenant-wasm-bindings
wasm-pack build --target web --out-dir ../../../covenant-playground/public/covenant-wasm
```

## Design tokens

Shared with `covenant-lang.org` and `docs.covenant-lang.org`: paper `#fcfbf8`, violet `#7C3AED`, EB Garamond serif, Inter sans, JetBrains Mono. See `src/styles/tokens.css`.

## License

MIT. The Covenant compiler itself is Apache-2.0.
