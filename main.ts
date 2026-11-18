// Puerto Serena — Neon Tide: the hand-in program (Node 22, standard
// library only). The game itself is the static site in game/ — plain
// files a desktop browser opens offline — and this program's one job
// is to deliver it: copy game/ and screenshots/ into the output
// directory and write dossier.json there with the vendored make.fun
// library, byte for byte the way the grader will rebuild it.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game folder goes over whole; screenshots ride along when the
// folder exists (it always does in a real entry, but a bare checkout
// used for a smoke test should not crash the hand-in).
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier carries the judge's whole view of the entry — the
// screenshots and the source outline — so its caps mirror the gate's:
// dossier text capped at 160 KiB, at most 4 screenshots of at most
// 256 KiB each, game/ at most 993 entries and 48 MiB with no path
// longer than 1000 bytes. They live in one named table so the numbers
// the hand-in runs with are the numbers this file documents.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};
writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, GATE_CAPS));
