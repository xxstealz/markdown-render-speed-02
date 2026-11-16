# markdown-render-speed-02

[![make.fun](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/xxstealz/markdown-render-speed-02/rank.svg)](https://make.fun/bounty/markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/xxstealz/markdown-render-speed-02/reward.svg)](https://make.fun/bounty/markdown-render-speed-02)

A dependency-free, from-scratch CommonMark 0.31.2 + GFM 0.29 parser written
to match marked 18.1.3's default output byte-for-byte, and to render it
faster.

- `parse.js` — the parser. Exports `parse(markdown)`, stateless per call.
- `main.ts` — the driver. Reads `/input/cases.json`, writes
  `/output/html.json` (one HTML string per case, in order).

Entry for the [markdown-render-speed-02 bounty](https://make.fun/bounty/markdown-render-speed-02)
on [make.fun](https://make.fun).
