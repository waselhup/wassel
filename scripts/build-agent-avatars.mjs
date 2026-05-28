// scripts/build-agent-avatars.mjs
//
// Pre-generates 8 War Room agent avatars (DiceBear notionists) into
// client/public/agents/*.svg so they ship as static assets instead of
// being generated at runtime. Saves ~120 KB gzipped from the bundle.
//
// Run:   node scripts/build-agent-avatars.mjs
// Re-run any time the AGENT_OPTIONS below change.
//
// Output: client/public/agents/{faris,sayed,al_mukhadram,hassan,fatima,dhai,hussein,mohammed}.svg

import { createAvatar } from '@dicebear/core';
import { notionists } from '@dicebear/collection';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'client', 'public', 'agents');
mkdirSync(OUT_DIR, { recursive: true });

const AGENT_BG = {
  faris:        ['1e293b'],
  sayed:        ['10b981'],
  al_mukhadram: ['78350f'],
  hassan:       ['dc2626'],
  fatima:       ['ec4899'],
  dhai:         ['6366f1'],
  hussein:      ['0ea5e9'],
  mohammed:     ['d4af37'],
};

// Per-agent locked options — matches the personality brief from the
// AI Workforce seed (see 20260526_ai_workforce.sql).
const AGENT_OPTIONS = {
  faris: {
    seed: 'faris-coo-calm', backgroundColor: AGENT_BG.faris, backgroundType: ['gradientLinear'],
    hair: ['variant16'], beard: ['variant04'], beardProbability: 100,
    glasses: ['variant01'], glassesProbability: 0,
    eyes: ['variant02'], brows: ['variant05'], lips: ['variant10'], nose: ['variant03'],
    body: ['variant05'], gestureProbability: 0, bodyIconProbability: 0,
  },
  sayed: {
    seed: 'sayed-creative-energy', backgroundColor: AGENT_BG.sayed, backgroundType: ['gradientLinear'],
    hair: ['variant09'], beard: ['variant02'], beardProbability: 100,
    glasses: ['variant01'], glassesProbability: 0,
    eyes: ['variant04'], brows: ['variant03'], lips: ['variant05'], nose: ['variant02'],
    body: ['variant12'], gestureProbability: 0, bodyIconProbability: 0,
  },
  al_mukhadram: {
    seed: 'almukhadram-warm-dad', backgroundColor: AGENT_BG.al_mukhadram, backgroundType: ['gradientLinear'],
    hair: ['variant05'], beard: ['variant07'], beardProbability: 100,
    glasses: ['variant03'], glassesProbability: 0,
    eyes: ['variant01'], brows: ['variant07'], lips: ['variant03'], nose: ['variant05'],
    body: ['variant08'], gestureProbability: 0, bodyIconProbability: 0,
  },
  hassan: {
    seed: 'hassan-sales-killer', backgroundColor: AGENT_BG.hassan, backgroundType: ['gradientLinear'],
    hair: ['variant07'], beard: ['variant01'], beardProbability: 100,
    glasses: ['variant01'], glassesProbability: 0,
    eyes: ['variant03'], brows: ['variant11'], lips: ['variant02'], nose: ['variant01'],
    body: ['variant02'], gestureProbability: 0, bodyIconProbability: 0,
  },
  fatima: {
    seed: 'fatima-analyst-thoughtful', backgroundColor: AGENT_BG.fatima, backgroundType: ['gradientLinear'],
    hair: ['variant40'], beard: ['variant01'], beardProbability: 0,
    glasses: ['variant03'], glassesProbability: 100,
    eyes: ['variant02'], brows: ['variant02'], lips: ['variant07'], nose: ['variant02'],
    body: ['variant04'], gestureProbability: 0, bodyIconProbability: 0,
  },
  dhai: {
    seed: 'dhai-compliance-stoic', backgroundColor: AGENT_BG.dhai, backgroundType: ['gradientLinear'],
    hair: ['variant03'], beard: ['variant05'], beardProbability: 100,
    glasses: ['variant02'], glassesProbability: 100,
    eyes: ['variant01'], brows: ['variant09'], lips: ['variant01'], nose: ['variant04'],
    body: ['variant06'], gestureProbability: 0, bodyIconProbability: 0,
  },
  hussein: {
    seed: 'hussein-tech-casual', backgroundColor: AGENT_BG.hussein, backgroundType: ['gradientLinear'],
    hair: ['variant21'], beard: ['variant03'], beardProbability: 100,
    glasses: ['variant01'], glassesProbability: 0,
    eyes: ['variant05'], brows: ['variant04'], lips: ['variant06'], nose: ['variant02'],
    body: ['variant14'], gestureProbability: 0, bodyIconProbability: 0,
  },
  mohammed: {
    seed: 'mohammed-finance-formal', backgroundColor: AGENT_BG.mohammed, backgroundType: ['gradientLinear'],
    hair: ['variant04'], beard: ['variant06'], beardProbability: 100,
    glasses: ['variant04'], glassesProbability: 100,
    eyes: ['variant02'], brows: ['variant06'], lips: ['variant04'], nose: ['variant03'],
    body: ['variant07'], gestureProbability: 0, bodyIconProbability: 0,
  },
};

let totalBytes = 0;
for (const [id, opts] of Object.entries(AGENT_OPTIONS)) {
  const svg = createAvatar(notionists, opts).toString();
  const outPath = join(OUT_DIR, `${id}.svg`);
  writeFileSync(outPath, svg, 'utf8');
  totalBytes += svg.length;
  process.stdout.write(`  ${id.padEnd(14)} ${(svg.length / 1024).toFixed(1).padStart(5)} KB\n`);
}
process.stdout.write(`\nTotal: ${(totalBytes / 1024).toFixed(1)} KB across 8 files → ${OUT_DIR}\n`);
