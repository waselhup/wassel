import { randomDelay } from '../browser.js';

export async function sendMessage(page, linkedinUrl, message) {
  await page.goto(linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await randomDelay(3000, 5000);

  const name = await page.evaluate(() => {
    const t = document.title || '';
    return t.split('|')[0].split('–')[0].split('-')[0].trim();
  });
  console.log('[Message] On profile:', name);

  // Click Message button
  const msgClicked = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const mainEl = document.querySelector('main') || document.body;
    const btns = mainEl.querySelectorAll('button');
    for (const btn of btns) {
      const text = (btn.textContent || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      if ((text === 'message' || text === 'رسالة' || aria.includes('message')) &&
        !aria.includes('voice') && btn.getBoundingClientRect().top < 500) {
        btn.click();
        return true;
      }
    }
    return false;
  });

  if (!msgClicked) {
    return { ok: false, error: 'message_button_not_found', name };
  }

  await randomDelay(2000, 3000);

  // Type message
  const typed = await page.evaluate(async (msg) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const msgBox =
      document.querySelector('.msg-form__contenteditable[contenteditable="true"]') ||
      document.querySelector('[role="textbox"][contenteditable="true"]') ||
      document.querySelector('.msg-form__msg-content-container [contenteditable]');

    if (!msgBox) return false;

    msgBox.focus();
    msgBox.innerHTML = '';
    document.execCommand('insertText', false, msg);
    msgBox.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, message);

  if (!typed) {
    return { ok: false, error: 'message_input_not_found', name };
  }

  await randomDelay(1000, 2000);

  // Click Send
  const sent = await page.evaluate(async () => {
    const sendBtn =
      document.querySelector('.msg-form__send-button') ||
      document.querySelector('button[type="submit"].msg-form__send-button');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
      return true;
    }
    return false;
  });

  if (sent) {
    console.log('[Message] Sent to:', name);
    return { ok: true, name };
  }

  return { ok: false, error: 'send_button_not_found', name };
}
