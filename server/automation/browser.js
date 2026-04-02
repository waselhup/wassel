import puppeteer from 'puppeteer';

export async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1366,768',
    ],
  });
}

export async function createPageWithCookies(browser, liAt, jsessionId, userAgent) {
  const page = await browser.newPage();

  // Set realistic viewport
  await page.setViewport({ width: 1366, height: 768 });

  // Set user agent if provided
  if (userAgent) {
    await page.setUserAgent(userAgent);
  }

  // Inject LinkedIn session cookies
  await page.setCookie(
    { name: 'li_at', value: liAt, domain: '.linkedin.com', path: '/', httpOnly: true, secure: true },
    ...(jsessionId
      ? [{ name: 'JSESSIONID', value: jsessionId, domain: '.linkedin.com', path: '/', httpOnly: false, secure: true }]
      : [])
  );

  return page;
}

export function randomDelay(min, max) {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}
