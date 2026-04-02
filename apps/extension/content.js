// ============================================================
// WASSEL EXTENSION v4.1.0 — Content Script
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
    // v4.0 — NO h1 dependency. Polls directly for the Connect button.
    // LinkedIn 2026 has no <h1> on profile pages.
    async function doSendInvite(targetUrl, note) {
        try {
            var match = (targetUrl || '').match(/\/in\/([^/?]+)/);
            if (!match) return { ok: false, error: 'invalid_url' };
            var slug = match[1].toLowerCase();

            console.log('[Wassel] INVITE v4: slug =', slug, '| URL =', window.location.href);

            // STEP 1: URL VERIFICATION
            var currentPath = window.location.pathname.toLowerCase();
            if (!currentPath.includes('/in/' + slug)) {
                console.error('[Wassel] WRONG PAGE! slug:', slug, '| path:', currentPath);
                return { ok: false, error: 'wrong_page:' + currentPath };
            }

            // Get profile name from page title for logging (e.g. "John Doe | LinkedIn")
            var profileName = (document.title || '').split('|')[0].split('–')[0].split('-')[0].trim() || slug;

            // STEP 2: Poll for Connect button directly (up to 20 seconds)
            // No h1 needed — search <main> for Connect buttons, exclude suggestions
            var targetBtn = null;

            for (var attempt = 0; attempt < 20; attempt++) {
                var mainEl = document.querySelector('main') || document.body;
                var allBtns = mainEl.querySelectorAll('button');

                for (var i = 0; i < allBtns.length; i++) {
                    var btn = allBtns[i];
                    var text = (btn.textContent || '').trim().toLowerCase();
                    var aria = (btn.getAttribute('aria-label') || '').toLowerCase();

                    // Must match Connect
                    var isConnect = (text === 'connect' || text === 'اتصال' ||
                        aria.includes('invite') || aria.includes('connect') || aria.includes('اتصال'));
                    if (!isConnect) continue;

                    // Reject non-connect states
                    if (text.includes('disconnect') || text.includes('pending') ||
                        text.includes('connected') || aria.includes('disconnect')) continue;

                    // CRITICAL EXCLUSIONS: suggestion cards are always in <li>, <aside>, or data-view-name
                    if (btn.closest('li')) continue;
                    if (btn.closest('aside')) continue;
                    if (btn.closest('[data-view-name]')) continue;

                    // Position check: profile Connect is near the top of the page
                    var rect = btn.getBoundingClientRect();
                    if (rect.top > 600) continue;
                    if (rect.top <= 0 || rect.height === 0) continue; // hidden/not rendered

                    targetBtn = btn;
                    console.log('[Wassel] FOUND Connect button: y=' + rect.top + ' text="' + text + '" attempt=' + (attempt + 1));
                    break;
                }

                if (targetBtn) break;

                // Not found yet — wait and retry
                if (attempt < 19) {
                    console.log('[Wassel] Polling for Connect button... attempt', attempt + 1);
                    await sleep(1000);
                }
            }

            // STEP 3: Fallback — More dropdown menu
            if (!targetBtn) {
                console.log('[Wassel] No direct Connect — trying More dropdown');
                var mainEl2 = document.querySelector('main') || document.body;
                var moreBtns = mainEl2.querySelectorAll('button');

                for (var m = 0; m < moreBtns.length; m++) {
                    var mAria = (moreBtns[m].getAttribute('aria-label') || '').toLowerCase();
                    var mText = (moreBtns[m].textContent || '').trim().toLowerCase();

                    if (!(mAria.includes('more action') || mAria === 'more' || mText === 'more' ||
                          mText === '...' || mText === 'المزيد' || mAria.includes('更多'))) continue;

                    // Exclude More buttons in suggestion cards
                    if (moreBtns[m].closest('li') || moreBtns[m].closest('aside')) continue;

                    var mRect = moreBtns[m].getBoundingClientRect();
                    if (mRect.top > 600 || mRect.top <= 0) continue;

                    moreBtns[m].click();
                    await sleep(1500);

                    var menuItems = document.querySelectorAll('[role="menuitem"], .artdeco-dropdown__item');
                    for (var j = 0; j < menuItems.length; j++) {
                        var miText = (menuItems[j].textContent || '').toLowerCase();
                        if (miText.includes('connect') && !miText.includes('disconnect')) {
                            targetBtn = menuItems[j];
                            console.log('[Wassel] FOUND Connect in More dropdown');
                            break;
                        }
                    }
                    break;
                }
            }

            // STEP 4: Not found — check if already connected or pending
            if (!targetBtn) {
                var mainText = (document.querySelector('main') || document.body).innerText.substring(0, 2000).toLowerCase();
                if (mainText.includes('pending') || mainText.includes('message') || mainText.includes('رسالة')) {
                    console.log('[Wassel] Already connected or pending for:', profileName);
                    return { ok: true, note: 'already_connected_or_pending' };
                }
                console.error('[Wassel] No Connect button found after 20s on:', window.location.href);
                return { ok: false, error: 'no_connect_button' };
            }

            // STEP 5: Click Connect
            console.log('[Wassel] ══════════════════════════════════');
            console.log('[Wassel] CLICKING Connect for:', profileName);
            console.log('[Wassel] Target slug:', slug);
            console.log('[Wassel] URL:', window.location.href);
            console.log('[Wassel] Button y:', targetBtn.getBoundingClientRect ? targetBtn.getBoundingClientRect().top : '?');
            console.log('[Wassel] ══════════════════════════════════');

            targetBtn.click();
            await sleep(3000);

            // After clicking Connect, LinkedIn shows a modal/popup.
            // It may say: "Add a note" / "Send without a note" / "Send" / "Send invitation"
            // Log what buttons we see for debugging
            var allModalBtns = document.querySelectorAll('button');
            var btnTexts = [];
            for (var db = 0; db < allModalBtns.length; db++) {
                var dbText = (allModalBtns[db].textContent || '').trim();
                if (dbText.length > 0 && dbText.length < 40) btnTexts.push(dbText);
            }
            console.log('[Wassel] Buttons after Connect click:', JSON.stringify(btnTexts.slice(0, 20)));

            // Handle Note — if we have a note, click "Add a note" first
            if (note && note.trim()) {
                var noteBtns = document.querySelectorAll('button');
                for (var n = 0; n < noteBtns.length; n++) {
                    var nAria = (noteBtns[n].getAttribute('aria-label') || '').toLowerCase();
                    var nText = (noteBtns[n].textContent || '').toLowerCase().trim();
                    if (nText.includes('add a note') || nAria.includes('add a note') ||
                        nText.includes('إضافة ملاحظة') || nText.includes('أضف ملاحظة')) {
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

            // Click Send / Send without a note / Send invitation — use includes() not ===
            var sendBtns = document.querySelectorAll('button');
            for (var s = 0; s < sendBtns.length; s++) {
                var st = (sendBtns[s].textContent || '').trim().toLowerCase();
                var sAria = (sendBtns[s].getAttribute('aria-label') || '').trim().toLowerCase();

                var isSend = (
                    st === 'send' ||
                    st.includes('send without') ||
                    st.includes('send now') ||
                    st.includes('send invitation') ||
                    st === 'إرسال' ||
                    st.includes('إرسال بدون') ||
                    st.includes('إرسال دعوة') ||
                    st.includes('أرسل') ||
                    sAria.includes('send invitation') ||
                    sAria.includes('send without') ||
                    sAria.includes('إرسال')
                );

                if (isSend) {
                    console.log('[Wassel] Clicking send button: "' + st + '"');
                    sendBtns[s].click();
                    await sleep(2000);
                    console.log('[Wassel] RESULT: Invite SENT to:', profileName, '| slug:', slug);
                    return { ok: true, sentTo: profileName };
                }
            }

            // Fallback: any primary button in a modal/dialog
            var modal = document.querySelector('[role="dialog"]');
            if (modal) {
                var pBtns = modal.querySelectorAll('button.artdeco-button--primary, button[data-control-name="send"]');
                if (pBtns.length > 0) {
                    console.log('[Wassel] Clicking modal primary button: "' + (pBtns[0].textContent || '').trim() + '"');
                    pBtns[0].click();
                    await sleep(2000);
                    console.log('[Wassel] RESULT: Invite SENT (modal) to:', profileName, '| slug:', slug);
                    return { ok: true, sentTo: profileName };
                }
            }

            // Last resort: look for any artdeco-button--primary on page (invite confirmation)
            var primaryBtns = document.querySelectorAll('button.artdeco-button--primary');
            for (var pb = 0; pb < primaryBtns.length; pb++) {
                var pbText = (primaryBtns[pb].textContent || '').trim().toLowerCase();
                if (pbText.includes('send') || pbText.includes('إرسال') || pbText.includes('أرسل')) {
                    console.log('[Wassel] Clicking primary send button: "' + pbText + '"');
                    primaryBtns[pb].click();
                    await sleep(2000);
                    console.log('[Wassel] RESULT: Invite SENT (primary) to:', profileName, '| slug:', slug);
                    return { ok: true, sentTo: profileName };
                }
            }

            console.error('[Wassel] No send button found. Visible buttons:', JSON.stringify(btnTexts.slice(0, 15)));
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

    console.log('[Wassel] Content script v4.1.0 loaded');
})();
