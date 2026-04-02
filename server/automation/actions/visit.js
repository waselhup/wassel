import { randomDelay } from '../browser.js';

export async function visitProfile(page, linkedinUrl) {
  await page.goto(linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await randomDelay(3000, 6000);

  // Get profile name from document.title (LinkedIn 2026 has NO h1)
  const name = await page.evaluate(() => {
    const title = document.title || '';
    return title.split('|')[0].split('–')[0].split('-')[0].trim();
  });

  console.log('[Visit] Visited:', name);
  return { ok: true, name };
}
