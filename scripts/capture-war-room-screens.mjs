// One-off: capture War Room luxury preview screenshots for PR artifacts.
//   1) full room at 1440x900
//   2) full room at 1024x700 (narrowest desktop, verifying no projector overlap)
//   3) close-up of a single seat (Faris) at 1440x900
//
// Uses local Chrome since puppeteer-core is bundled without browser.
// Run after `npm run dev` is up on :5173.

import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', '.tmp', 'war-room-screens');
mkdirSync(OUT_DIR, { recursive: true });

// Common locations for Chrome on Windows
const CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.PUPPETEER_EXECUTABLE_PATH,
].filter(Boolean);

let executablePath = null;
const { existsSync } = await import('node:fs');
for (const p of CHROME_PATHS) {
  if (existsSync(p)) { executablePath = p; break; }
}
if (!executablePath) {
  console.error('No Chrome found at known paths:', CHROME_PATHS);
  process.exit(1);
}

// The dev server can't easily serve .tmp/ (Vite restricts file system to the root),
// so we use the `file://` URL for the static preview.
const localPreview = join(__dirname, '..', '.tmp', 'war-room-preview', 'checkpoint3.html');
const URL = process.env.PREVIEW_URL || `file:///${localPreview.replace(/\\/g, '/')}`;

console.log('Using Chrome at:', executablePath);
console.log('URL:', URL);

const browser = await puppeteer.launch({ executablePath, headless: 'new' });
try {
  // 1) Full room at 1440x900
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
    const out = join(OUT_DIR, '01-full-room-1440x900.png');
    await page.screenshot({ path: out, fullPage: false });
    console.log('Wrote', out);
    await page.close();
  }

  // 2) Full room at 1024x700 — narrowest supported desktop
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 700, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
    const out = join(OUT_DIR, '02-full-room-1024x700.png');
    await page.screenshot({ path: out, fullPage: false });
    console.log('Wrote', out);
    await page.close();
  }

  // 3) Close-up of Faris (seat 1, head of table) — clip to his portrait + name
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
    const clip = await page.evaluate(() => {
      const seats = document.querySelectorAll('.seat');
      const faris = [...seats].find((s) => s.querySelector('.name')?.textContent?.trim() === 'فارس');
      if (!faris) return null;
      const r = faris.getBoundingClientRect();
      return {
        x: Math.max(0, r.left - 40),
        y: Math.max(0, r.top - 50),
        width: r.width + 80,
        height: r.height + 80,
      };
    });
    if (clip) {
      const out = join(OUT_DIR, '03-faris-closeup.png');
      await page.screenshot({ path: out, clip });
      console.log('Wrote', out, JSON.stringify(clip));
    } else {
      console.warn('Skipped close-up — Faris seat not found.');
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log('\nAll screenshots saved to:', OUT_DIR);
