import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CONTEXT_FILE = 'wassel_context.md';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: { content: string; loadedAt: number } | null = null;

function resolveContextPath(): string {
  const root = process.env.WASSEL_ROOT_DIR || process.cwd();
  return join(root, CONTEXT_FILE);
}

export async function loadWasselContext(force = false): Promise<string> {
  const now = Date.now();
  if (!force && cached && now - cached.loadedAt < CACHE_TTL_MS) {
    return cached.content;
  }
  try {
    const content = await readFile(resolveContextPath(), 'utf8');
    cached = { content, loadedAt: now };
    return content;
  } catch (err: any) {
    if (cached) return cached.content;
    return `# Wassel context unavailable\n\n_Could not read ${CONTEXT_FILE}: ${err?.message || 'unknown error'}_`;
  }
}

export async function updateWasselContext(content: string): Promise<void> {
  await writeFile(resolveContextPath(), content, 'utf8');
  cached = { content, loadedAt: Date.now() };
}

export function clearWasselContextCache(): void {
  cached = null;
}
