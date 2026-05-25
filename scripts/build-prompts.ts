#!/usr/bin/env node
/**
 * build-prompts.ts — compile docs/prompts/*.md into server/_core/prompts/_generated.ts
 *
 * Each prompt file contains one or more "prompt blocks". A block is a contiguous
 * group of three fenced code regions in order:
 *
 *     ```system
 *     ...system message...
 *     ```
 *
 *     ```user
 *     ...user template with {{placeholders}}...
 *     ```
 *
 *     ```schema
 *     type Foo = { ... };
 *     ```
 *
 * A heading line beginning with `## ` (level-2) just above a block becomes the
 * block's name (slug-cased). If a file has only one block, the block name
 * defaults to the file's basename (e.g. radar.md → "radar").
 *
 * The generated module exports one constant per block:
 *
 *     export const radarDiscoveryPrompt = { system, user(vars), schema } as const;
 *
 * Run with `npm run build:prompts`. No external dependencies — uses only Node
 * built-ins. CommonJS interop friendly (works under both ESM and CJS).
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..');
const PROMPTS_DIR  = join(PROJECT_ROOT, 'docs', 'prompts');
const OUT_DIR      = join(PROJECT_ROOT, 'server', '_core', 'prompts');
const OUT_FILE     = join(OUT_DIR, '_generated.ts');

type PromptBlock = {
  name: string;
  system: string;
  userTemplate: string;
  schema: string;
  placeholders: string[];
};

const FENCE_RE = /```(system|user|schema)\s*\n([\s\S]*?)\n```/g;
const HEADING_RE = /^##\s+(.+)$/gm;
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toCamelCase(parts: string[]): string {
  return parts
    .map((p, i) => (i === 0 ? p : p[0]!.toUpperCase() + p.slice(1)))
    .join('');
}

function exportName(fileSlug: string, blockSlug: string | null): string {
  // file slug "radar" + block slug "discovery"  →  radarDiscoveryPrompt
  // file slug "resume" + block slug null         →  resumePrompt
  // file slug "resume" + block slug "refine"     →  resumeRefinePrompt
  // file slug "content-post" + block slug null   →  contentPostPrompt
  const fileParts  = fileSlug.split('-');
  const blockParts = blockSlug ? blockSlug.split('-') : [];
  return toCamelCase([...fileParts, ...blockParts, 'prompt']);
}

function extractBlocks(filePath: string, src: string): PromptBlock[] {
  // Walk the file linearly, recording level-2 headings and fenced blocks
  // in document order. Group every three consecutive fences (system / user
  // / schema) into one block, and attach the most recent heading as the
  // block's name.
  type Hit =
    | { kind: 'heading'; offset: number; text: string }
    | { kind: 'fence';   offset: number; lang: 'system' | 'user' | 'schema'; body: string };

  const hits: Hit[] = [];

  HEADING_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HEADING_RE.exec(src)) !== null) {
    hits.push({ kind: 'heading', offset: m.index, text: m[1]!.trim() });
  }

  FENCE_RE.lastIndex = 0;
  while ((m = FENCE_RE.exec(src)) !== null) {
    hits.push({
      kind: 'fence',
      offset: m.index,
      lang: m[1] as 'system' | 'user' | 'schema',
      body: m[2]!.trim(),
    });
  }

  hits.sort((a, b) => a.offset - b.offset);

  const blocks: PromptBlock[] = [];
  let pendingName: string | null = null;
  let pendingFences: Array<{ lang: 'system' | 'user' | 'schema'; body: string }> = [];

  // We accept fences in any order as long as a complete set (one each of
  // system / user / schema) accumulates between the start of a section and
  // the next heading or end-of-file.
  const flush = () => {
    if (pendingFences.length === 0) return;
    const bySig: Partial<Record<'system' | 'user' | 'schema', string>> = {};
    for (const f of pendingFences) {
      if (bySig[f.lang]) {
        throw new Error(
          `Duplicate '${f.lang}' fence in section ${pendingName ?? '<unnamed>'} of ${basename(filePath)}`
        );
      }
      bySig[f.lang] = f.body;
    }
    if (!bySig.system || !bySig.user || !bySig.schema) {
      throw new Error(
        `Incomplete prompt block in ${basename(filePath)} (section ${pendingName ?? '<unnamed>'}): need all three of system / user / schema`
      );
    }
    const placeholders = Array.from(
      new Set(Array.from(bySig.user.matchAll(PLACEHOLDER_RE), (mm) => mm[1]!))
    );
    blocks.push({
      name: pendingName ? slug(pendingName) : '',
      system: bySig.system,
      userTemplate: bySig.user,
      schema: bySig.schema,
      placeholders,
    });
    pendingFences = [];
  };

  for (const hit of hits) {
    if (hit.kind === 'heading') {
      flush();
      pendingName = hit.text;
    } else {
      pendingFences.push({ lang: hit.lang, body: hit.body });
    }
  }
  flush();

  return blocks;
}

function emitBlock(fileSlug: string, block: PromptBlock): string {
  const name = exportName(fileSlug, block.name || null);
  const placeholderType =
    block.placeholders.length === 0
      ? 'Record<string, never>'
      : `{ ${block.placeholders.map((p) => `${p}: string`).join('; ')} }`;

  // The user-message template is rendered with simple {{var}} substitution.
  // We emit a fresh function per prompt so callers can call e.g.
  // radarAnalysisPrompt.user({ target_role: 'PM', ... }).
  const userBodyLiteral = JSON.stringify(block.userTemplate);
  const systemLiteral = JSON.stringify(block.system);
  const schemaLiteral = JSON.stringify(block.schema);

  return [
    `export const ${name} = {`,
    `  system: ${systemLiteral},`,
    `  user(vars: ${placeholderType}): string {`,
    `    let out = ${userBodyLiteral};`,
    ...block.placeholders.map(
      (p) =>
        `    out = out.replace(/\\{\\{\\s*${p}\\s*\\}\\}/g, String((vars as Record<string, string>).${p} ?? ''));`
    ),
    `    return out;`,
    `  },`,
    `  schema: ${schemaLiteral},`,
    `  placeholders: ${JSON.stringify(block.placeholders)} as const,`,
    `} as const;`,
  ].join('\n');
}

function main(): void {
  if (!existsSync(PROMPTS_DIR)) {
    throw new Error(`Prompts directory not found: ${PROMPTS_DIR}`);
  }
  const files = readdirSync(PROMPTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No .md prompts found in ${PROMPTS_DIR}`);
  }

  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  const sections: string[] = [];
  const exports: string[] = [];

  for (const file of files) {
    const fullPath = join(PROMPTS_DIR, file);
    const src = readFileSync(fullPath, 'utf8');
    const fileSlug = slug(basename(file, '.md'));
    const blocks = extractBlocks(fullPath, src);
    if (blocks.length === 0) {
      throw new Error(`No prompt blocks found in ${file}`);
    }

    sections.push(`// ─── ${file} ───────────────────────────────────────────`);
    for (const block of blocks) {
      const name = exportName(fileSlug, block.name || null);
      exports.push(name);
      sections.push(emitBlock(fileSlug, block));
    }
  }

  const header = [
    '/* AUTO-GENERATED by scripts/build-prompts.ts — do not edit by hand. */',
    '/* Edit the source markdown in docs/prompts/ and run `npm run build:prompts`. */',
    '',
    '/* eslint-disable */',
    '',
  ].join('\n');

  const footer = [
    '',
    'export const allPrompts = {',
    ...exports.map((e) => `  ${e},`),
    '} as const;',
    '',
  ].join('\n');

  writeFileSync(OUT_FILE, header + sections.join('\n\n') + footer, 'utf8');

  console.log(`✓ build-prompts: wrote ${exports.length} prompts from ${files.length} files → ${OUT_FILE.replace(PROJECT_ROOT, '.')}`);
  for (const name of exports) console.log(`    – ${name}`);
}

main();
