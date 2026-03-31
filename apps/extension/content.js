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

    // ── LinkedIn 2026: click "Connect" button on a profile page ──
    async function doSendInvite(note) {
        try {
            await sleep(3000); // Wait for profile to fully load

            // STEP 1: Find Connect button
            let connectBtn = null;
            const allButtons = Array.from(document.querySelectorAll('button'));

            // Pattern A: scan all buttons for Connect text/aria-label
            for (const btn of allButtons) {
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                const text = (btn.textContent || '').trim().toLowerCase();
                if ((label.includes('connect') && !label.includes('disconnect')) ||
                    text === 'connect' || text === 'اتصال') {
                    connectBtn = btn;
                    break;
                }
            }

            // Pattern B: "More" dropdown → Connect
            if (!connectBtn) {
                const moreBtn = allButtons.find(btn => {
                    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                    return label.includes('more action') || label.includes('المزيد');
                }) || allButtons.find(btn => (btn.textContent || '').trim() === 'More');

                if (moreBtn) {
                    moreBtn.click();
                    await sleep(1500);
                    const dropdownItems = Array.from(
                        document.querySelectorAll('[role="menuitem"], .artdeco-dropdown__item, .artdeco-dropdown__content-inner li')
                    );
                    for (const item of dropdownItems) {
                        const text = (item.textContent || '').toLowerCase();
                        if (text.includes('connect') || text.includes('اتصال')) {
                            connectBtn = item;
                            break;
                        }
                    }
                }
            }

            if (!connectBtn) {
                console.log('[Wassel] No Connect button — possibly already connected');
                return { ok: false, error: 'no_connect_button' };
            }

            console.log('[Wassel] Found Connect button, clicking...');
            connectBtn.click();
            await sleep(2500);

            // STEP 2: Handle the modal — "Add a note" or direct send
            if (note && note.trim()) {
                const addNoteBtn = Array.from(document.querySelectorAll('button')).find(btn => {
                    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                    const text = (btn.textContent || '').trim().toLowerCase();
                    return label.includes('add a note') || text.includes('add a note') ||
                           text.includes('إضافة ملاحظة');
                });
                if (addNoteBtn) {
                    addNoteBtn.click();
                    await sleep(1500);
                    const textarea = document.querySelector(
                        'textarea[name="message"], textarea#custom-message, ' +
                        'textarea.connect-button-send-invite__custom-message, ' +
                        '.artdeco-modal textarea'
                    );
                    if (textarea) {
                        textarea.focus();
                        textarea.value = '';
                        textarea.value = note;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        textarea.dispatchEvent(new Event('change', { bubbles: true }));
                        await sleep(500);
                    }
                }
            }

            // STEP 3: Click Send
            await sleep(1000);
            const sendBtn = Array.from(document.querySelectorAll('button')).find(btn => {
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                const text = (btn.textContent || '').trim().toLowerCase();
                return label.includes('send') || text === 'send' ||
                       text === 'send without a note' || text === 'إرسال' ||
                       text === 'send now' || text === 'send invitation';
            });

            if (sendBtn) {
                sendBtn.click();
                await sleep(2000);
                console.log('[Wassel] ✅ Invite SENT successfully');
                return { ok: true };
            }

            // Fallback: click any primary button in modal
            const primaryBtn = document.querySelector(
                '.artdeco-modal button.artdeco-button--primary'
            );
            if (primaryBtn) {
                primaryBtn.click();
                await sleep(1500);
                console.log('[Wassel] ✅ Invite sent via primary button');
                return { ok: true };
            }

            return { ok: false, error: 'send_button_not_found' };
        } catch (err) {
            console.error('[Wassel] Invite error:', err);
            return { ok: false, error: err.message };
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

    // ── LinkedIn 2026: fill post composer and AUTO-SUBMIT ──
    async function doLinkedInPost(content, postId) {
        try {
            await sleep(2500); // Wait for feed to load

            // STEP 1: Click "Start a post"
            const startBtn = Array.from(document.querySelectorAll('button, div[role="button"]')).find(el => {
                const text = (el.textContent || '').toLowerCase();
                const label = (el.getAttribute('aria-label') || '').toLowerCase();
                return text.includes('start a post') || label.includes('start a post') ||
                       text.includes('ابدأ منشور') ||
                       el.classList.contains('share-box-feed-entry__trigger');
            });
            if (startBtn) {
                startBtn.click();
                await sleep(3000);
            } else {
                const shareBox = document.querySelector('.share-box-feed-entry__top-bar, .share-creation-state');
                if (shareBox) { shareBox.click(); await sleep(3000); }
            }

            // STEP 2: Find editor and fill content
            await sleep(1000);
            const editor = document.querySelector(
                '.ql-editor[contenteditable="true"], ' +
                '[role="textbox"][contenteditable="true"], ' +
                '.editor-content [contenteditable="true"], ' +
                '.share-creation-state__text-editor [contenteditable], ' +
                '[data-placeholder][contenteditable="true"]'
            );

            if (!editor) {
                console.error('[Wassel] Editor not found');
                showNotification('❌ لم يتم العثور على محرر LinkedIn', 'error');
                return { ok: false, error: 'Editor not found' };
            }

            editor.focus();
            await sleep(500);
            editor.innerHTML = '';

            // Insert text line by line using execCommand
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                document.execCommand('insertText', false, lines[i]);
                if (i < lines.length - 1) {
                    document.execCommand('insertLineBreak');
                }
            }
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(2000);

            // STEP 3: AUTO-CLICK the Post button
            const postBtn = Array.from(document.querySelectorAll('button')).find(btn => {
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                const text = (btn.textContent || '').trim().toLowerCase();
                const cls = btn.className || '';
                return (label.includes('post') && !label.includes('repost')) ||
                       (text === 'post') || (text === 'نشر') ||
                       cls.includes('share-actions__primary-action');
            });

            if (postBtn && !postBtn.disabled) {
                console.log('[Wassel] Auto-clicking Post button...');
                postBtn.click();
                await sleep(3000);
                console.log('[Wassel] ✅ Post published automatically!');
                showNotification('✅ تم نشر المنشور على LinkedIn', 'success');
                return { ok: true };
            }

            console.log('[Wassel] Post button not found or disabled');
            showNotification('⚠️ المحتوى جاهز — قد تحتاج الضغط على Post يدوياً', 'error');
            return { ok: false, error: 'post_button_not_found' };
        } catch (err) {
            console.error('[Wassel] Post error:', err);
            showNotification('❌ فشل تعبئة المنشور', 'error');
            return { ok: false, error: err.message };
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
    function showNotification(message, type = 'success') {
        const existing = document.getElementById('wassel-notify');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = 'wassel-notify';
        div.style.cssText = `
            position:fixed; bottom:24px; right:24px; z-index:999999;
            padding:16px 24px; border-radius:16px; font-size:14px;
            font-family:Cairo,sans-serif; color:white; cursor:pointer;
            box-shadow:0 8px 32px rgba(0,0,0,0.3);
            ${type === 'success'
                ? 'background:linear-gradient(135deg,#22c55e,#16a34a);'
                : 'background:linear-gradient(135deg,#f59e0b,#d97706);'}
        `;
        div.textContent = message;
        div.onclick = () => div.remove();
        document.body.appendChild(div);
        setTimeout(() => { if (div.parentNode) div.remove(); }, 10000);
    }

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    console.log('[Wassel] Content script v2.0.1 loaded');
})();
