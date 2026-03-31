// ============================================================
// WASSEL EXTENSION v2.0.1 — Content Script
// Handles: campaign execution, post publishing, auth bridge, detection
// Does NOT: scan/scrape prospects (Apify handles discovery now)
// ============================================================

(function () {
    'use strict';

    // Prevent double injection
    if (window.__wasselContentInjected) return;
    window.__wasselContentInjected = true;

    // ── Detection: mark the page so the web app knows extension is installed ──
    document.documentElement.setAttribute('data-wassel-extension', 'true');
    window.postMessage({ type: 'WASSEL_EXTENSION_INSTALLED', version: '2.0.1' }, '*');

    // Hidden marker element for legacy detection
    const marker = document.createElement('div');
    marker.id = 'wassel-extension-marker';
    marker.style.display = 'none';
    document.body.appendChild(marker);

    // ── Web app → extension bridge ──
    window.addEventListener('message', (event) => {
        if (event.data?.source !== 'wassel-web') return;

        // Auth token bridge
        if (event.data?.type === 'WASSEL_AUTH_TOKEN' && event.data?.token) {
            chrome.storage.local.set({ wasselToken: event.data.token });
            console.log('[Wassel] Token received via postMessage bridge');
        }

        // Publish post: web app asks extension to open LinkedIn and fill post
        if (event.data?.type === 'WASSEL_PUBLISH_POST' && event.data?.content) {
            chrome.runtime.sendMessage({
                type: 'PUBLISH_POST',
                content: event.data.content,
                postId: event.data.postId,
            });
        }

        // Send message to a prospect
        if (event.data?.type === 'WASSEL_SEND_MESSAGE' && event.data?.profileUrl) {
            chrome.runtime.sendMessage({
                type: 'SEND_MESSAGE_TO_PROSPECT',
                profileUrl: event.data.profileUrl,
                message: event.data.message,
            });
        }
    });

    // ── Message handler (from background.js) ──
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Heartbeat check from background.js
        if (message.type === 'PING') {
            sendResponse({ status: 'alive' });
            return true;
        }

        // Campaign: visit a LinkedIn profile
        if (message.type === 'VISIT_PROFILE' && message.url) {
            console.log('[Wassel] Visiting profile:', message.url);
            window.location.href = message.url;
            sendResponse({ ok: true });
            return true;
        }

        // Campaign: send a connection invite
        if (message.type === 'SEND_INVITE') {
            console.log('[Wassel] Send invite requested');
            doSendInvite(message.note).then(result => sendResponse(result));
            return true; // async
        }

        // Campaign: send a message in messaging window
        if (message.type === 'SEND_MESSAGE' && message.content) {
            console.log('[Wassel] Send message requested');
            doSendMessage(message.content).then(result => sendResponse(result));
            return true; // async
        }

        // Post publishing: fill in LinkedIn post composer
        if (message.type === 'DO_LINKEDIN_POST' && message.content) {
            console.log('[Wassel] DO_LINKEDIN_POST received');
            doLinkedInPost(message.content, message.postId).then(result => sendResponse(result));
            return true; // async
        }

        // PUBLISH_POST from background forwarding
        if (message.type === 'PUBLISH_POST' && message.content) {
            console.log('[Wassel] PUBLISH_POST received');
            doLinkedInPost(message.content, message.postId).then(result => sendResponse(result));
            return true; // async
        }

        // Direct message to a prospect (from Messages quick-send)
        if (message.type === 'SEND_DIRECT_MESSAGE' && message.profileUrl) {
            console.log('[Wassel] SEND_DIRECT_MESSAGE requested');
            sendDirectMessage(message.profileUrl, message.message).then(result => sendResponse(result));
            return true; // async
        }
    });

    // ── LinkedIn: click "Connect" button on a profile page ──
    async function doSendInvite(note) {
        try {
            await sleep(2000); // Wait for page to fully settle

            let connectBtn = null;

            // Method 1: aria-label with "Invite" or "Connect"
            connectBtn =
                document.querySelector('button[aria-label*="Invite"][aria-label*="connect" i]') ||
                document.querySelector('button.pvs-profile-actions__action[aria-label*="Connect" i]') ||
                document.querySelector('button.artdeco-button--primary[aria-label*="Connect" i]');

            // Method 2: Button text === "Connect" (exact match)
            if (!connectBtn) {
                const buttons = Array.from(document.querySelectorAll('button'));
                connectBtn = buttons.find(b => {
                    const text = (b.innerText || b.textContent || '').trim();
                    return text === 'Connect' || text === 'اتصال';
                }) || null;
            }

            // Method 3: "More" dropdown → Connect
            if (!connectBtn) {
                const moreBtn =
                    document.querySelector('button[aria-label="More actions"]') ||
                    document.querySelector('button[aria-label*="More" i][aria-label*="action" i]') ||
                    Array.from(document.querySelectorAll('button')).find(b =>
                        (b.innerText || '').trim() === 'More'
                    );

                if (moreBtn) {
                    moreBtn.click();
                    await sleep(1200);
                    // Find Connect in dropdown
                    const menuItems = Array.from(document.querySelectorAll(
                        '[role="menuitem"], .artdeco-dropdown__content-inner li, [role="option"]'
                    ));
                    const connectItem = menuItems.find(el =>
                        (el.textContent || '').toLowerCase().includes('connect') ||
                        (el.textContent || '').includes('اتصال')
                    );
                    if (connectItem) {
                        (connectItem as HTMLElement).click();
                        connectBtn = connectItem as HTMLElement;
                    }
                }
            }

            if (!connectBtn) {
                console.log('[Wassel] Connect button not found — may already be connected');
                return { ok: false, error: 'Connect button not found' };
            }

            // Only click if not already clicked via More menu
            if (!connectBtn.closest('[role="menu"]')) {
                connectBtn.click();
            }

            await sleep(2000);

            // Handle invite note
            if (note) {
                const addNoteBtn = Array.from(document.querySelectorAll('button')).find(b =>
                    (b.textContent || '').toLowerCase().includes('add a note') ||
                    (b.getAttribute('aria-label') || '').toLowerCase().includes('add a note')
                );
                if (addNoteBtn) {
                    addNoteBtn.click();
                    await sleep(1000);
                    const noteArea =
                        document.querySelector('textarea[name="message"]') ||
                        document.querySelector('#custom-message') ||
                        document.querySelector('textarea.connect-button-send-invite__custom-message');
                    if (noteArea) {
                        (noteArea as HTMLTextAreaElement).value = '';
                        (noteArea as HTMLTextAreaElement).focus();
                        document.execCommand('insertText', false, note);
                        noteArea.dispatchEvent(new Event('input', { bubbles: true }));
                        await sleep(500);
                    }
                }
            }

            await sleep(1000);

            // Click Send / Send without a note / Send now
            const sendBtn =
                document.querySelector('button[aria-label="Send now"]') ||
                document.querySelector('button[aria-label="Send without a note"]') ||
                document.querySelector('button.artdeco-button--primary[aria-label*="Send" i]') ||
                Array.from(document.querySelectorAll('button.artdeco-button--primary')).find(b =>
                    (b.textContent || '').trim().toLowerCase().includes('send') ||
                    (b.textContent || '').includes('إرسال')
                );

            if (sendBtn) {
                (sendBtn as HTMLElement).click();
                await sleep(1500);
                console.log('[Wassel] ✅ Invite sent');
                return { ok: true };
            }

            return { ok: false, error: 'Send button not found' };
        } catch (err) {
            console.error('[Wassel] Invite error:', err);
            return { ok: false, error: (err as Error).message };
        }
    }

    // ── LinkedIn: send a message via the messaging composer ──
    async function doSendMessage(content) {
        try {
            await sleep(2000);

            // Click "Message" button on profile page
            const msgBtn =
                document.querySelector('button[aria-label*="Message" i]:not([aria-label*="voice"])') ||
                Array.from(document.querySelectorAll('button')).find(b => {
                    const text = (b.innerText || b.textContent || '').trim();
                    return text === 'Message' || text === 'رسالة';
                });

            if (!msgBtn) return { ok: false, error: 'Message button not found' };
            (msgBtn as HTMLElement).click();
            await sleep(2000);

            // Find message input box
            const msgBox =
                document.querySelector('.msg-form__contenteditable[contenteditable="true"]') ||
                document.querySelector('[role="textbox"][contenteditable="true"]') ||
                document.querySelector('.msg-form__msg-content-container [contenteditable]');

            if (!msgBox) return { ok: false, error: 'Message box not found' };

            (msgBox as HTMLElement).focus();
            msgBox.innerHTML = '';
            document.execCommand('insertText', false, content);
            msgBox.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(600);

            // Click Send
            const submitBtn =
                document.querySelector('.msg-form__send-button') ||
                document.querySelector('button[type="submit"].msg-form__send-button') ||
                Array.from(document.querySelectorAll('button')).find(b =>
                    (b.getAttribute('type') === 'submit' && (b.textContent || '').toLowerCase().includes('send'))
                );

            if (submitBtn && !(submitBtn as HTMLButtonElement).disabled) {
                (submitBtn as HTMLElement).click();
                return { ok: true };
            }
            return { ok: false, error: 'Submit button not found or disabled' };
        } catch (err) {
            console.error('[Wassel] Message error:', err);
            return { ok: false, error: (err as Error).message };
        }
    }

    // ── LinkedIn: fill post composer and notify user to click Post ──
    async function doLinkedInPost(content, postId?) {
        try {
            await sleep(2000); // Wait for feed to load

            // Click "Start a post" — try multiple selectors
            let opened = false;

            // Try the share-box button directly
            const shareTrigger =
                document.querySelector('button.share-box-feed-entry__trigger') ||
                document.querySelector('[data-control-name="share.sharebox_text"]') ||
                document.querySelector('.share-box-feed-entry__top-bar') ||
                document.querySelector('[class*="share-box-feed-entry__top"]');

            if (shareTrigger) {
                (shareTrigger as HTMLElement).click();
                opened = true;
            }

            if (!opened) {
                // Fallback: look for any button with "start a post" text
                const btn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b =>
                    (b.textContent || '').toLowerCase().includes('start a post') ||
                    (b.getAttribute('aria-label') || '').toLowerCase().includes('start a post') ||
                    (b.getAttribute('placeholder') || '').toLowerCase().includes('start a post')
                );
                if (btn) {
                    (btn as HTMLElement).click();
                    opened = true;
                }
            }

            await sleep(3000);

            // Find the editor — LinkedIn uses contenteditable div
            const editor =
                document.querySelector('.ql-editor[contenteditable="true"]') ||
                document.querySelector('[data-placeholder][contenteditable="true"]') ||
                document.querySelector('[role="textbox"][contenteditable="true"]') ||
                document.querySelector('.editor-content [contenteditable="true"]') ||
                document.querySelector('[contenteditable="true"].share-creation-state__text-editor');

            if (!editor) {
                console.error('[Wassel] LinkedIn post editor not found');
                showNotification('❌ لم يتم العثور على محرر LinkedIn — افتح linkedin.com/feed أولاً', 'error');
                return { ok: false, error: 'Editor not found' };
            }

            (editor as HTMLElement).focus();
            await sleep(300);

            // Method 1: Clipboard paste (most reliable for LinkedIn)
            try {
                const dt = new DataTransfer();
                dt.setData('text/plain', content);
                const pasteEvent = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
                editor.dispatchEvent(pasteEvent);
                await sleep(300);
            } catch (_) {}

            // Method 2: execCommand
            if (!(editor as HTMLElement).innerText?.trim()) {
                (editor as HTMLElement).focus();
                document.execCommand('selectAll', false, undefined);
                document.execCommand('insertText', false, content);
                await sleep(300);
            }

            // Method 3: innerHTML fallback
            if (!(editor as HTMLElement).innerText?.trim()) {
                editor.innerHTML = content.split('\n').map(line =>
                    `<p>${line || '<br>'}</p>`
                ).join('');
                editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
            }

            await sleep(500);

            // Highlight Post button
            const postBtn = Array.from(document.querySelectorAll('button')).find(b => {
                const text = (b.textContent || '').trim();
                const label = b.getAttribute('aria-label') || '';
                return text === 'Post' || label === 'Post' || text === 'نشر';
            });
            if (postBtn) {
                postBtn.style.boxShadow = '0 0 0 3px #7c3aed, 0 0 24px rgba(124,58,237,0.6)';
                postBtn.style.transform = 'scale(1.05)';
                postBtn.style.transition = 'all 0.2s ease';
            }

            showNotification('✨ وصل — المحتوى جاهز! اضغط Post للنشر', 'success');
            console.log('[Wassel] ✅ Post content filled');
            return { ok: true };
        } catch (err) {
            console.error('[Wassel] Post helper error:', err);
            showNotification('❌ فشل تعبئة المنشور', 'error');
            return { ok: false, error: (err as Error).message };
        }
    }

    // ── LinkedIn: send a direct message to a connection by profile URL ──
    async function sendDirectMessage(profileUrl, message) {
        try {
            await sleep(2000);

            // Click "Message" button
            const msgBtn =
                document.querySelector('button[aria-label*="Message" i]:not([aria-label*="voice"])') ||
                Array.from(document.querySelectorAll('button')).find(b => {
                    const text = (b.innerText || b.textContent || '').trim();
                    return text === 'Message' || text === 'رسالة';
                });

            if (!msgBtn) return { ok: false, error: 'Message button not found on profile' };
            (msgBtn as HTMLElement).click();
            await sleep(3000);

            // Find message input
            const msgInput =
                document.querySelector('.msg-form__contenteditable[contenteditable="true"]') ||
                document.querySelector('[role="textbox"][contenteditable="true"]') ||
                document.querySelector('.msg-form__msg-content-container [contenteditable]');

            if (!msgInput) return { ok: false, error: 'Message input not found' };

            (msgInput as HTMLElement).focus();
            msgInput.innerHTML = '';
            document.execCommand('insertText', false, message);
            msgInput.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(800);

            // Click Send
            const sendBtn =
                document.querySelector('.msg-form__send-button') ||
                document.querySelector('button[type="submit"].msg-form__send-button');

            if (sendBtn && !(sendBtn as HTMLButtonElement).disabled) {
                (sendBtn as HTMLElement).click();
                showNotification('✅ تم إرسال الرسالة', 'success');
                return { ok: true };
            }

            // Can't auto-send — show notification for manual send
            showNotification('✨ الرسالة جاهزة — اضغط Send', 'success');
            return { ok: true, manual: true };
        } catch (err) {
            console.error('[Wassel] sendDirectMessage error:', err);
            return { ok: false, error: (err as Error).message };
        }
    }

    // ── Notification banner ──
    function showNotification(message, type: 'success' | 'error' = 'success') {
        const existing = document.getElementById('wassel-notify');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = 'wassel-notify';
        div.style.cssText = `
            position:fixed; bottom:24px; right:24px; z-index:999999;
            padding:16px 24px; border-radius:16px; font-size:14px;
            font-family:'Cairo',sans-serif; color:white; cursor:pointer;
            box-shadow:0 8px 32px rgba(0,0,0,0.3);
            ${type === 'success'
                ? 'background:linear-gradient(135deg,#6366f1,#8b5cf6);'
                : 'background:linear-gradient(135deg,#ef4444,#f97316);'}
        `;
        div.textContent = message;
        div.onclick = () => div.remove();
        document.body.appendChild(div);
        setTimeout(() => { if (div.parentNode) div.remove(); }, 15000);
    }

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    console.log('[Wassel] Content script v2.0.1 loaded');
})();
