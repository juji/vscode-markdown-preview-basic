## Context

Preview felt slow. First fix already shipped (not part of this doc): shiki no longer preloads all ~28 `COMMON_LANGS` on activation — `getHighlighter()` now starts with `langs: []`, and `ensureLangsLoaded()` scans the document's fenced code blocks and calls `highlighter.loadLanguage()` only for languages actually used, before each render. That's in `extension.js` already.

Remaining recommendations, ranked by impact, to work through serially:

## Phase 1 — Debounce render on text changes ✅

Every keystroke currently triggers a full re-parse + re-render + webview `postMessage`, via `onDidChangeTextDocument` calling `render()` unconditionally with no debounce. Add a ~150-300ms debounce after the last keystroke.

## Phase 2 — Check bundle size cause

`dist/extension.js` is 9.75MB even though runtime now lazy-loads languages. Check whether esbuild is statically pulling in shiki's entire `@shikijs/langs`/`@shikijs/themes` registry via barrel exports, bloating the bundle despite per-doc loading being lazy at runtime.

## Phase 3 — Guard MathJax typeset like mermaid.run

`mermaid.run(...)` is already gated behind `mermaidBlocks.length` so it only runs when the doc has mermaid blocks. Confirm whether `MathJax.typesetPromise(...)` has the same guard, or runs unconditionally on every render even for docs with no math.

## Phase 4 — Lazy-load only the active shiki theme

Currently both `github-dark` and `github-light` themes load always, though only one is active at a time based on `vscode.window.activeColorTheme.kind`. Load just the active theme, switch on demand if the color theme kind changes.
