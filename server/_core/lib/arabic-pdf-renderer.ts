/**
 * Arabic-aware HTML → PDF renderer.
 *
 * jsPDF cannot shape Arabic glyphs (no bidi/ligature support — every
 * character renders as its isolated form, which Word/Photoshop users see
 * as "squares"). We can't fix that inside jsPDF, so we use headless
 * Chromium via puppeteer-core + @sparticuz/chromium to render an HTML
 * document — Chromium handles RTL, ligatures, font shaping, and embeds
 * the result as a real PDF.
 *
 * The serverless target is Vercel. @sparticuz/chromium ships a stripped
 * Chromium that fits inside the 250MB lambda limit when paired with
 * puppeteer-core (NOT regular puppeteer, which bundles its own ~280MB
 * Chrome download). On localhost we fall back to whatever Chrome the
 * developer has installed via puppeteer's built-in `executablePath()`
 * lookup, controlled by the WASSEL_LOCAL_CHROME_PATH env var when set.
 */

import type { Browser } from 'puppeteer-core';

let cachedBrowser: Browser | null = null;
let lastBrowserOpenedAt = 0;
const BROWSER_TTL_MS = 60_000;

/**
 * Lazily resolve a Chromium binary. Vercel uses @sparticuz/chromium;
 * local dev uses Chrome at WASSEL_LOCAL_CHROME_PATH or the platform default.
 */
async function getExecutablePath(): Promise<string> {
  if (process.env.WASSEL_LOCAL_CHROME_PATH) {
    return process.env.WASSEL_LOCAL_CHROME_PATH;
  }
  // @sparticuz/chromium dynamic import — keeps it out of the cold-start
  // path when we never render a PDF.
  const mod = await import('@sparticuz/chromium');
  const chromium = (mod as any).default ?? mod;
  return await chromium.executablePath();
}

/**
 * Reuse a single browser across invocations within the same lambda
 * container — cold-start savings on warm pings.
 */
async function getBrowser(): Promise<Browser> {
  const now = Date.now();
  if (cachedBrowser && now - lastBrowserOpenedAt < BROWSER_TTL_MS) {
    return cachedBrowser;
  }
  if (cachedBrowser) {
    try { await cachedBrowser.close(); } catch { /* swallow */ }
    cachedBrowser = null;
  }

  const puppeteer = await import('puppeteer-core');
  const isLocal = !!process.env.WASSEL_LOCAL_CHROME_PATH;

  let args: string[] = [];
  let headless: boolean | 'shell' = true;
  if (!isLocal) {
    const mod = await import('@sparticuz/chromium');
    const chromium: any = (mod as any).default ?? mod;
    args = chromium.args;
    headless = chromium.headless;
  }

  const executablePath = await getExecutablePath();

  cachedBrowser = await puppeteer.launch({
    args: [
      ...args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
    ],
    executablePath,
    headless: headless as any,
  });
  lastBrowserOpenedAt = now;
  return cachedBrowser!;
}

export interface RenderHtmlToPdfOptions {
  /** A complete HTML document. Must include its own <head>/styles. */
  html: string;
  /** Document direction. Defaults to 'rtl' since the caller is the AR path. */
  dir?: 'rtl' | 'ltr';
  /** Page format — "A4" (default) or "Letter". */
  format?: 'A4' | 'Letter';
  /** Margins in CSS units. Defaults: 18mm/16mm/18mm/16mm. */
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
}

/**
 * Render an HTML string to a PDF Buffer. The HTML should include all the
 * fonts and styles it needs — no implicit base styles are injected.
 */
export async function renderHtmlToPdf(opts: RenderHtmlToPdfOptions): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(opts.html, { waitUntil: 'networkidle0', timeout: 30_000 });
    // Wait one extra frame so web fonts (Cairo from Google) are fully painted.
    await page.evaluateHandle('document.fonts.ready');
    const pdf = await page.pdf({
      format: opts.format ?? 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top:    opts.margin?.top    ?? '18mm',
        right:  opts.margin?.right  ?? '16mm',
        bottom: opts.margin?.bottom ?? '18mm',
        left:   opts.margin?.left   ?? '16mm',
      },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => { /* swallow */ });
  }
}
