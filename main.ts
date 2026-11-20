// Leonida Platinum Log — the hand-in program for gta6-trophy-guide-01.
//
// What it does, in three steps:
//   1. Copies this repo's app/ (the offline trophy guide: index.html, app.js,
//      style.css, data/trophies.json and data/meta.json) into the output dir.
//   2. Copies screenshots/ alongside it, when the folder exists.
//   3. Writes dossier.json with buildDossier from vendor/makefun-frontend.ts.
//      That vendored file is the kit's copy and must stay untouched: the
//      scorer rebuilds the dossier from the same library and requires the
//      two to match byte for byte.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader MAKEFUN_OUTPUT_DIR is unset and the output dir is /output.
// Node 22 only, standard library only, no network, no build step.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const appDir = join(repoRoot, 'app');
const shotsDir = join(repoRoot, 'screenshots');

mkdirSync(outputDir, { recursive: true });
cpSync(appDir, join(outputDir, 'app'), { recursive: true });

mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// Caps mirror the gate so a local run refuses exactly what the scorer refuses:
// at most 4 screenshots of at most 256 KiB each, at most 993 entries and
// 48 MiB under app/. Only text_max_bytes changes the dossier's bytes.
const dossierText = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierText);

// One line of proof on stdout: what was handed in, so a local run can be
// checked at a glance without opening the output folder.
const shotNames = existsSync(shotsDir) ? readdirSync(shotsDir).sort() : [];
console.log(`handed in app/ + ${shotNames.length} screenshot(s) (${shotNames.join(', ')}) + dossier.json`);
