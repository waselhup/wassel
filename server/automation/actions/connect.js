import { randomDelay } from '../browser.js';

// Ported from content.js v4.1 — same logic, same exclusions
export async function sendInvite(page, linkedinUrl, note) {
  await page.goto(linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await randomDelay(3000, 5000);

  // Extract slug for verification
  const slugMatch = linkedinUrl.match(/\/in\/([^/?]+)/);
  const expectedSlug = slugMatch ? slugMatch[1].toLowerCase() : '';

  // Get name from document.title (NO h1 on LinkedIn 2026)
  const name = await page.evaluate(() => {
    const t = document.title || '';
    return t.split('|')[0].split('–')[0].split('-')[0].trim();
  });
  console.log('[Connect] On profile:', name, '| slug:', expectedSlug);

  // Verify URL
  const pageUrl = await page.url();
  if (expectedSlug && !pageUrl.toLowerCase().includes('/in/' + expectedSlug)) {
    return { ok: false, error: 'wrong_page: ' + pageUrl };
  }

  // Poll for Connect button (same v4 logic from content.js)
  const connectResult = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // Poll up to 20 seconds
    for (let attempt = 0; attempt < 20; attempt++) {
      const mainEl = document.querySelector('main') || document.body;
      const allBtns = mainEl.querySelectorAll('button');

      for (let i = 0; i < allBtns.length; i++) {
        const btn = allBtns[i];
        const text = (btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();

        const isConnect = (text === 'connect' || text === 'اتصال' ||
          aria.includes('invite') || aria.includes('connect') || aria.includes('اتصال'));
        if (!isConnect) continue;

        if (text.includes('disconnect') || text.includes('pending') ||
          text.includes('connected') || aria.includes('disconnect')) continue;

        // Exclude suggestion cards
        if (btn.closest('li') || btn.closest('aside') || btn.closest('[data-view-name]')) continue;

        const rect = btn.getBoundingClientRect();
        if (rect.top > 600 || rect.top <= 0 || rect.height === 0) continue;

        return { found: 'direct', index: i, y: rect.top };
      }

      await sleep(1000);
    }

    // Fallback: More dropdown
    const mainEl2 = document.querySelector('main') || document.body;
    const moreBtns = mainEl2.querySelectorAll('button');
    for (let m = 0; m < moreBtns.length; m++) {
      const mAria = (moreBtns[m].getAttribute('aria-label') || '').toLowerCase();
      const mText = (moreBtns[m].textContent || '').trim().toLowerCase();
      if (!(mAria.includes('more action') || mAria === 'more' || mText === 'more' ||
        mText === '...' || mText === 'المزيد')) continue;
      if (moreBtns[m].closest('li') || moreBtns[m].closest('aside')) continue;
      const mRect = moreBtns[m].getBoundingClientRect();
      if (mRect.top > 600 || mRect.top <= 0) continue;

      moreBtns[m].click();
      await sleep(1500);

      const menuItems = document.querySelectorAll('[role="menuitem"], .artdeco-dropdown__item');
      for (let j = 0; j < menuItems.length; j++) {
        const miText = (menuItems[j].textContent || '').toLowerCase();
        if (miText.includes('connect') && !miText.includes('disconnect')) {
          menuItems[j].click();
          return { found: 'more_dropdown' };
        }
      }
      break;
    }

    // Check already connected/pending
    const mainText = (document.querySelector('main') || document.body).innerText.substring(0, 2000).toLowerCase();
    if (mainText.includes('pending') || mainText.includes('message') || mainText.includes('رسالة')) {
      return { found: 'already_connected' };
    }

    return { found: null };
  });

  if (connectResult.found === 'already_connected') {
    return { ok: true, note: 'already_connected_or_pending', name };
  }

  if (!connectResult.found) {
    return { ok: false, error: 'no_connect_button', name };
  }

  // If direct button found, click it
  if (connectResult.found === 'direct') {
    await page.evaluate((idx) => {
      const mainEl = document.querySelector('main') || document.body;
      const btns = mainEl.querySelectorAll('button');
      btns[idx].click();
    }, connectResult.index);
  }

  await randomDelay(2000, 3000);

  // Handle note
  if (note && note.trim()) {
    const addedNote = await page.evaluate(async (noteText) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        const t = (btn.textContent || '').toLowerCase().trim();
        if (t.includes('add a note') || t.includes('إضافة ملاحظة') || t.includes('أضف ملاحظة')) {
          btn.click();
          await sleep(1500);
          const ta = document.querySelector('textarea');
          if (ta) {
            ta.focus();
            const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
            setter.call(ta, noteText);
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
        }
      }
      return false;
    }, note);
  }

  await randomDelay(1000, 2000);

  // Click Send
  const sent = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      const t = (btn.textContent || '').trim().toLowerCase();
      const a = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (t === 'send' || t.includes('send without') || t.includes('send now') ||
        t.includes('send invitation') || t === 'إرسال' || t.includes('إرسال بدون') ||
        t.includes('إرسال دعوة') || a.includes('send invitation') || a.includes('send without')) {
        btn.click();
        await sleep(2000);
        return true;
      }
    }
    // Fallback: primary button in modal
    const modal = document.querySelector('[role="dialog"]');
    if (modal) {
      const primary = modal.querySelector('button.artdeco-button--primary');
      if (primary) { primary.click(); await sleep(2000); return true; }
    }
    // Last resort: any primary with send text
    const primaryBtns = document.querySelectorAll('button.artdeco-button--primary');
    for (const pb of primaryBtns) {
      const pt = (pb.textContent || '').trim().toLowerCase();
      if (pt.includes('send') || pt.includes('إرسال')) { pb.click(); await sleep(2000); return true; }
    }
    return false;
  });

  if (sent) {
    console.log('[Connect] Invite SENT to:', name);
    return { ok: true, name };
  }

  return { ok: false, error: 'send_button_not_found', name };
}
