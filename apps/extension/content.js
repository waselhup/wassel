// ============================================================
// WASSEL EXTENSION v2.1.0 — Content Script
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
    window.postMessage({ type: 'WASSEL_EXTENSION_INSTALLED', version: '2.0.2' }, '*');

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
            console.log('[Wassel-Content] Received WASSEL_PUBLISH_POST from web app, forwarding to background');
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
            console.log('[Wassel] Send invite requested, targetUrl:', message.targetUrl);
            doSendInvite(message.targetUrl || '', message.note || '').then(result => sendResponse(result));
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

    // ── LinkedIn: SEND INVITE ──
    async function doSendInvite(targetUrl, note) {
        try {
            var match = (targetUrl || '').match(/\/in\/([^/?]+)/);
            if (!match) return { ok: false, error: 'invalid_url' };
            var slug = match[1];

            console.log('[Wassel] INVITE: target slug =', slug);
            var cleanUrl = 'https://www.linkedin.com/in/' + slug + '/';

            // Navigate if not on the correct absolute page
            if (!window.location.href.includes('/in/' + slug)) {
                window.location.href = cleanUrl;
                await sleep(6000);
            }
            if (!window.location.href.includes('/in/' + slug)) {
                return { ok: false, error: 'wrong_page' };
            }

            await sleep(2000);
            var h1 = document.querySelector('h1');
            var profileName = h1 ? h1.textContent.trim() : '';
            console.log('[Wassel] Profile name:', profileName);

            // The absolute STRUCTURAL DIFFERENCE for the main Connect button is that it is
            // located within the top profile card (.ph5, .pv-top-card-v2-ctas, .pvs-profile-actions).
            // It is NEVER nested inside a list item `<li>` or an sidebar `<aside>`.
            
            var targetBtn = null;
            var topCard = document.querySelector('main .ph5') || document.querySelector('main .pv-top-card');

            // 1. Direct fetch inside the main top card container
            if (topCard) {
                var buttons = topCard.querySelectorAll('button');
                for (var i = 0; i < buttons.length; i++) {
                    var btn = buttons[i];
                    var text = (btn.textContent || '').trim().toLowerCase();
                    var aria = (btn.getAttribute('aria-label') || '').toLowerCase();
                    
                    if ((text === 'connect' || aria.includes('connect') || aria.includes('invite')) && 
                        !text.includes('disconnect') && !text.includes('pending') && !text.includes('connected')) {
                        targetBtn = btn;
                        break;
                    }
                }
            }

            // 2. Strict Fallback ensuring we exclude suggestion buttons
            if (!targetBtn) {
                var allButtons = document.querySelectorAll('button');
                for (var i = 0; i < allButtons.length; i++) {
                    var btn = allButtons[i];
                    
                    // STRUCTURAL DIFFERENCE REJECTION
                    if (btn.closest('li') || btn.closest('aside') || btn.closest('section.pv-profile-section') || btn.closest('.discover-entity-type-card') || btn.closest('.pv-browsemap-section')) {
                        continue;
                    }

                    var text = (btn.textContent || '').trim().toLowerCase();
                    var aria = (btn.getAttribute('aria-label') || '').toLowerCase();

                    if ((text === 'connect' || aria.includes('connect') || aria.includes('invite')) &&
                        !text.includes('disconnect') && !text.includes('pending')) {
                        targetBtn = btn;
                        break;
                    }
                }
            }

            // 3. Fallback to More Menu if not immediately visible
            if (!targetBtn && topCard) {
                var moreBtn = null;
                var mBtns = topCard.querySelectorAll('button');
                for (var m = 0; m < mBtns.length; m++) {
                    var mAria = (mBtns[m].getAttribute('aria-label') || '').toLowerCase();
                    if (mAria.includes('more action') || mAria === 'more' || mAria.includes('更多')) {
                        moreBtn = mBtns[m];
                        break;
                    }
                }
                
                if (moreBtn) {
                    moreBtn.click();
                    await sleep(1500);
                    var menuItems = document.querySelectorAll('[role="menuitem"], .artdeco-dropdown__item');
                    for (var j = 0; j < menuItems.length; j++) {
                        var mText = (menuItems[j].textContent || '').toLowerCase();
                        if (mText.includes('connect') && !mText.includes('disconnect')) {
                            targetBtn = menuItems[j];
                            break;
                        }
                    }
                }
            }

            if (!targetBtn) {
                // Determine if already connected or pending
                if (topCard && (topCard.innerText.toLowerCase().includes('message') || topCard.innerText.toLowerCase().includes('pending'))) {
                    return { ok: true, note: 'already_connected_or_pending' };
                }
                return { ok: false, error: 'no_main_connect_button_found' };
            }

            targetBtn.click();
            await sleep(3000);

            // Handle Note
            if (note && note.trim()) {
                var noteBtns = document.querySelectorAll('button');
                for (var n = 0; n < noteBtns.length; n++) {
                    var nAria = (noteBtns[n].getAttribute('aria-label') || '').toLowerCase();
                    var nText = (noteBtns[n].textContent || '').toLowerCase();
                    if (nText.includes('add a note') || nAria.includes('add a note')) {
                        noteBtns[n].click();
                        await sleep(1500);
                        var ta = document.querySelector('textarea');
                        if (ta) {
                            ta.focus();
                            var setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
                            setter.call(ta, note);
                            ta.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        break;
                    }
                }
            }

            await sleep(1500);
            
            // Click Send
            var sendBtns = document.querySelectorAll('button');
            for (var s = 0; s < sendBtns.length; s++) {
                var st = (sendBtns[s].textContent || '').trim().toLowerCase();
                var sAria = (sendBtns[s].getAttribute('aria-label') || '').trim().toLowerCase();
                if (st === 'send' || st === 'send now' || st === 'send without a note' || st === 'send invitation' || sAria.includes('send invitation')) {
                    sendBtns[s].click();
                    await sleep(2000);
                    console.log('[Wassel] ✅ SENT invite to:', profileName);
                    return { ok: true };
                }
            }

            var modal = document.querySelector('[role="dialog"]');
            if (modal) {
                var pBtns = modal.querySelectorAll('button.artdeco-button--primary');
                if (pBtns.length > 0) {
                    pBtns[0].click();
                    await sleep(2000);
                    return { ok: true };
                }
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
            msgBtn.click();
            await sleep(2000);

            // Find message input box
            const msgBox =
                document.querySelector('.msg-form__contenteditable[contenteditable="true"]') ||
                document.querySelector('[role="textbox"][contenteditable="true"]') ||
                document.querySelector('.msg-form__msg-content-container [contenteditable]');

            if (!msgBox) return { ok: false, error: 'Message box not found' };

            msgBox.focus();
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

            if (submitBtn && !submitBtn.disabled) {
                submitBtn.click();
                return { ok: true };
            }
            return { ok: false, error: 'Submit button not found or disabled' };
        } catch (err) {
            console.error('[Wassel] Message error:', err);
            return { ok: false, error: err.message };
        }
    }

    // ── LinkedIn 2026: fill post composer and AUTO-SUBMIT ──
    async function doLinkedInPost(content, postId) {
        try {
            console.log('[Wassel] doLinkedInPost starting, content length:', content.length);
            await sleep(2000);

            // Step 1: Click "Start a post"
            var startBtn = document.querySelector('button.share-box-feed-entry__trigger') || 
                           document.querySelector('#share-to-linkedin-modal-trigger') || 
                           document.querySelector('button[aria-label*="Start a post" i]');

            if (!startBtn) {
                showNotification('❌ لم يتم العثور على زر المنشور', 'error');
                return { ok: false, error: 'start_post_not_found' };
            }

            startBtn.click();
            await sleep(3500);

            // Step 2: Find Editor
            var editor = document.querySelector('.ql-editor[contenteditable="true"]') ||
                         document.querySelector('[role="textbox"][contenteditable="true"]');

            if (!editor) {
                showNotification('❌ لم يتم العثور على محرر النص', 'error');
                return { ok: false, error: 'editor_not_found' };
            }

            editor.focus();
            await sleep(300);
            editor.innerHTML = '';
            
            var lines = content.split('\n');
            for (var i = 0; i < lines.length; i++) {
                document.execCommand('insertText', false, lines[i]);
                if (i < lines.length - 1) {
                    document.execCommand('insertLineBreak');
                }
            }
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(2000);

            // Step 3: Verify and Click Post submit
            var postBtn = document.querySelector('button.share-actions__primary-action') ||
                          document.querySelector('div.share-box_actions button.artdeco-button--primary');

            if (postBtn && !postBtn.disabled) {
                postBtn.click();
                await sleep(3000);
                
                var stillOpen = document.querySelector('.ql-editor[contenteditable="true"]');
                if (stillOpen) {
                    return { ok: false, error: 'post_failed_to_submit' };
                }

                showNotification('✅ تم نشر المنشور بنجاح!', 'success');
                return { ok: true };
            }

            showNotification('⚠️ المحتوى جاهز — اضغط Post يدوياً', 'error');
            return { ok: false, error: 'post_button_not_found' };
        } catch (err) {
            console.error('[Wassel] Post error:', err);
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
            msgBtn.click();
            await sleep(3000);

            // Find message input
            const msgInput =
                document.querySelector('.msg-form__contenteditable[contenteditable="true"]') ||
                document.querySelector('[role="textbox"][contenteditable="true"]') ||
                document.querySelector('.msg-form__msg-content-container [contenteditable]');

            if (!msgInput) return { ok: false, error: 'Message input not found' };

            msgInput.focus();
            msgInput.innerHTML = '';
            document.execCommand('insertText', false, message);
            msgInput.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(800);

            // Click Send
            const sendBtn =
                document.querySelector('.msg-form__send-button') ||
                document.querySelector('button[type="submit"].msg-form__send-button');

            if (sendBtn && !sendBtn.disabled) {
                sendBtn.click();
                showNotification('✅ تم إرسال الرسالة', 'success');
                return { ok: true };
            }

            // Can't auto-send — show notification for manual send
            showNotification('✨ الرسالة جاهزة — اضغط Send', 'success');
            return { ok: true, manual: true };
        } catch (err) {
            console.error('[Wassel] sendDirectMessage error:', err);
            return { ok: false, error: err.message };
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

    console.log('[Wassel] Content script v2.1.0 loaded');
})();
