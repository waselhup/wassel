import { randomDelay } from '../browser.js';

export async function publishPost(page, content) {
  await page.goto('https://www.linkedin.com/feed/', {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  await randomDelay(3000, 5000);

  // Click Start a post
  const startClicked = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const btn = document.querySelector('button.share-box-feed-entry__trigger') ||
      document.querySelector('#share-to-linkedin-modal-trigger') ||
      document.querySelector('button[aria-label*="Start a post" i]');
    if (btn) { btn.click(); return true; }
    return false;
  });

  if (!startClicked) {
    return { ok: false, error: 'start_post_not_found' };
  }

  await randomDelay(2000, 3500);

  // Type content into editor
  const typed = await page.evaluate(async (text) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const editor = document.querySelector('.ql-editor[contenteditable="true"]') ||
      document.querySelector('[role="textbox"][contenteditable="true"]');
    if (!editor) return false;

    editor.focus();
    editor.innerHTML = '';
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      document.execCommand('insertText', false, lines[i]);
      if (i < lines.length - 1) document.execCommand('insertLineBreak');
    }
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, content);

  if (!typed) {
    return { ok: false, error: 'editor_not_found' };
  }

  await randomDelay(2000, 3000);

  // Click Post button
  const posted = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const postBtn = document.querySelector('button.share-actions__primary-action') ||
      document.querySelector('div.share-box_actions button.artdeco-button--primary');
    if (postBtn && !postBtn.disabled) {
      postBtn.click();
      await sleep(3000);
      return true;
    }
    return false;
  });

  if (posted) {
    console.log('[Post] Published successfully');
    return { ok: true };
  }

  return { ok: false, error: 'post_button_not_found' };
}
