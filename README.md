# Markdown Preview Basic

![Markdown Preview Basic screenshot](./screenshot.png)

A custom-styled markdown preview for VS Code, available via **Open With... → Markdown Preview (Basic)** — sits alongside the built-in preview rather than replacing it.

Available on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=juji.vscode-markdown-preview-basic).

## Features

- Custom, theme-aware rendering (uses VS Code's own `--vscode-*` CSS variables, matches your active color theme)
- Zoom controls, persisted across sessions
- Local and remote images
- Math via [MathJax](https://www.mathjax.org/) (`$inline$` and `$$display$$`)
- Diagrams via [Mermaid](https://mermaid.js.org/) (` ```mermaid ` code fences)
- Syntax-highlighted code blocks via [Shiki](https://shiki.style/), with a copy button
- GitHub-style tables (sticky header, zebra striping, horizontal scroll on overflow)
- Interactive task lists — checking a box edits the underlying `- [ ]`/`- [x]` in the markdown source (undo-able like any other edit)

## Installation

```bash
npm install
npm run build
code --install-extension vscode-markdown-preview-basic-0.0.3.vsix --force
```

## Development

```bash
npm install
```

Launch the extension in a development host:

```bash
code --extensionDevelopmentPath="$PWD" "$PWD/samples/advanced-example.md"
```

Then right-click the open file's tab → **Open With... → Markdown Preview (Basic)**.

After editing `extension.js`, reload the development host window (Cmd+R) to pick up changes.

## Samples

The `samples/` folder has example files for each feature:

- `advanced-example.md` — general markdown coverage (headings, lists, code, tables, links, images, raw HTML)
- `mathjax-example.md` — inline/display math, matrices, aligned equations
- `mermaid-example.md` — flowchart, sequence, gantt, class diagrams
- `shiki-example.md` — syntax highlighting across common languages, plus the copy button
- `tables-example.md` — alignment, zebra striping, wide-table scrolling, inline formatting in cells
- `task-lists-example.md` — simple, nested, and mixed task lists
