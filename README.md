# SwiftMark

[![make.fun · markdown-render-speed-02](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/xxstealz/markdown-render-speed-02/rank.svg)](https://make.fun/bounty/markdown-render-speed-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/xxstealz/markdown-render-speed-02/reward.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)

A dependency-free, hand-written Markdown parser that renders byte-identical HTML to marked 18.1.3 (CommonMark 0.31.2 + GFM extensions) — and faster.

Entry for the [markdown-render-speed-02 bounty](https://make.fun/bounty/markdown-render-speed-02) on make.fun.

## Design

- `parse.js` — the parser, written from scratch:
  - A line-oriented block parser (containers, leaves, lazy continuation, link reference definitions, GFM tables) that derives its behaviour from the CommonMark spec examples and the practice oracle.
  - A single-pass inline parser (delimiter stack for emphasis/strikethrough, links, autolinks, code spans, entities) producing identical output to marked's default options.
  - Speed comes from ASCII character-class tables, a fast path for plain lines, autolink gating, alnum-run batching, and minimal allocation in the hot paths.
- `main.ts` — the driver: reads `cases.json` from `$MAKEFUN_INPUT_DIR` (default `/input`), writes `html.json` to `$MAKEFUN_OUTPUT_DIR` (default `/output`).

## Usage

```sh
node main.ts
```

`parse(markdown)` returns the HTML string for one document.
