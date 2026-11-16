// Entrypoint for the markdown-render-speed-02 entry.
//
// The harness hands us a directory holding cases.json — a JSON array
// of { id, markdown } objects (or an object wrapping such an array
// under `cases`) — and expects html.json back: a JSON array of the
// rendered HTML strings, one per case, in input order. Each case is
// rendered on its own by parse() from parse.js, so no state carries
// between cases.
//
// Inside the scoring container the directories are /input and
// /output. Outside a container, MAKEFUN_INPUT_DIR and
// MAKEFUN_OUTPUT_DIR override them.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './parse.js';

type Case = { id: string; markdown: string };

function loadCases(dir: string): Case[] {
  const parsed: unknown = JSON.parse(readFileSync(join(dir, 'cases.json'), 'utf8'));
  return Array.isArray(parsed) ? (parsed as Case[]) : (parsed as { cases: Case[] }).cases;
}

function main(): void {
  const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  const cases = loadCases(inputDir);
  const html: string[] = new Array(cases.length);
  for (let i = 0; i < cases.length; i++) {
    html[i] = parse(cases[i].markdown);
  }

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'html.json'), JSON.stringify(html));
}

main();
