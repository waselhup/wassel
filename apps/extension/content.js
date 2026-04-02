// ============================================================
// WASSEL EXTENSION v2.0.2 — Content Script
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

    // ── LinkedIn 2026: click "Connect" — walk-up-from-h1 approach ──
    // Finds the h1 (profile name), walks UP to the card/section container,
    // then searches ONLY that container for Connect. Skips li/aside/footer.
    async function doSendInvite(targetUrl, note) {
        try {
            console.log('[Wassel] doSendInvite called for:', targetUrl);

            // Extract profile slug
            var slugMatch = (targetUrl || '').match(/\/in\/([^/?]+)/);
            if (!slugMatch) {
                console.error('[Wassel] Invalid LinkedIn URL:', targetUrl);
                return { ok: false, error: 'invalid_url' };
            }
            var slug = slugMatch[1];

            // Step 1: Make sure we are on the correct profile
            if (!window.location.href.includes('/in/' + slug)) {
                console.log('[Wassel] Navigating to profile:', slug);
                window.location.href = 'https://www.linkedin.com/in/' + slug + '/';
                await sleep(6000);
            }

            // Step 2: Double-check URL
            if (!window.location.href.includes('/in/' + slug)) {
                console.error('[Wassel] Failed to navigate to:', slug);
                return { ok: false, error: 'navigation_failed' };
            }

            // Step 3: Get the person's name from the page header
            await sleep(2000);
            var h1 = document.querySelector('h1');
            var pageName = h1 ? h1.textContent.trim() : 'unknown';
            console.log('[Wassel] On profile of:', pageName);

            // Step 4: Walk UP from h1 to find the card container
            var h1Element = document.querySelector('h1');
            if (!h1Element) {
                return { ok: false, error: 'no_h1_found' };
            }

            var container = h1Element;
            for (var ci = 0; ci < 10; ci++) {
                container = container.parentElement;
                if (!container) break;
                if (container.tagName === 'SECTION' ||
                    container.tagName === 'MAIN' ||
                    (container.className && container.className.includes('artdeco-card'))) {
                    break;
                }
            }

            if (!container) {
                container = document.querySelector('main') || document.body;
            }

            console.log('[Wassel] Searching in container:', container.tagName, (container.className || '').slice(0, 50));

            // Step 5: Find buttons ONLY in this container
            var connectBtn = null;
            var btns = container.querySelectorAll('button');

            for (var btn of btns) {
                var text = (btn.textContent || '').trim();
                var label = (btn.getAttribute('aria-label') || '');
                var textLower = text.toLowerCase();
                var labelLower = label.toLowerCase();

                // Must NOT be in a list item (those are suggestions)
                if (btn.closest('li')) continue;
                // Must NOT be inside an aside element
                if (btn.closest('aside')) continue;
                // Must NOT be inside a footer
                if (btn.closest('footer')) continue;

                if ((textLower === 'connect' ||
                     (labelLower.includes('connect') && !labelLower.includes('disconnect'))) &&
                    !textLower.includes('disconnect') &&
                    !textLower.includes('connected') &&
                    !textLower.includes('pending')) {

                    // Final check: must be visible and near top of page
                    var rect = btn.getBoundingClientRect();
                    if (rect.top < 600 && rect.width > 0) {
                        connectBtn = btn;
                        console.log('[Wassel] Found Connect button at y=' + rect.top + ' text=' + text);
                        break;
                    }
                }
            }

            // Step 6: If no Connect, try "More" dropdown
            if (!connectBtn) {
                console.log('[Wassel] No direct Connect, trying More...');
                var moreBtns = container.querySelectorAll('button');
                for (var mb of moreBtns) {
                    var mLabel = (mb.getAttribute('aria-label') || '').toLowerCase();
                    if (mLabel.includes('more action')) {
                        var mRect = mb.getBoundingClientRect();
                        if (mRect.top < 600) {
                            mb.click();
                            await sleep(2000);

                            var menuItems = document.querySelectorAll(
                                '.artdeco-dropdown__content-inner li, [role="menuitem"]'
                            );
                            for (var mi = 0; mi < menuItems.length; mi++) {
                                var mt = (menuItems[mi].textContent || '').toLowerCase();
                                if (mt.includes('connect') && !mt.includes('disconnect')) {
                                    connectBtn = menuItems[mi];
                                    console.log('[Wassel] Found Connect in More menu');
                                    break;
                                }
                            }
                            break;
                        }
                    }
                }
            }

            // Step 7: Check if already connected
            if (!connectBtn) {
                var allBtns = container.querySelectorAll('button');
                for (var ab of allBtns) {
                    var at = (ab.textContent || '').trim().toLowerCase();
                    if (at === 'message' && ab.getBoundingClientRect().top < 600) {
                        console.log('[Wassel] Already connected (Message button found)');
                        return { ok: true, note: 'already_connected' };
                    }
                    if (at === 'pending' || at.includes('pending')) {
                        console.log('[Wassel] Already pending');
                        return { ok: true, note: 'already_pending' };
                    }
                }
                console.error('[Wassel] No Connect button found anywhere');
                return { ok: false, error: 'connect_not_found' };
            }

            // Step 8: Click Connect
            console.log('[Wassel] Clicking Connect for:', pageName);
            connectBtn.click();
            await sleep(3000);

            // Step 9: Handle note
            if (note && note.trim()) {
                var allBtns2 = document.querySelectorAll('button');
                for (var nb of allBtns2) {
                    if ((nb.textContent || '').toLowerCase().includes('add a note')) {
                        nb.click();
                        await sleep(1500);
                        var ta = document.querySelector('textarea');
                        if (ta) {
                            ta.focus();
                            var setter = Object.getOwnPropertyDescriptor(
                                HTMLTextAreaElement.prototype, 'value'
                            ).set;
                            setter.call(ta, note);
                            ta.dispatchEvent(new Event('input', { bubbles: true }));
                            await sleep(500);
                        }
                        break;
                    }
                }
            }

            // Step 10: Click Send
            await sleep(1500);
            var allBtns3 = document.querySelectorAll('button');
            for (var sb of allBtns3) {
                var st = (sb.textContent || '').trim().toLowerCase();
                if (st === 'send' || st === 'send now' ||
                    st === 'send without a note' || st === 'send invitation') {
                    console.log('[Wassel] Clicking Send');
                    sb.click();
                    await sleep(2000);
                    console.log('[Wassel] Invite SENT to:', pageName);
                    return { ok: true };
                }
            }

            // Last resort: primary button in modal
            var modal = document.querySelector('[role="dialog"]');
            if (modal) {
                var primary = Array.from(modal.querySelectorAll('button')).find(function(b) {
                    return b.className.includes('primary');
                });
                if (primary) {
                    primary.click();
                    await sleep(2000);
                    console.log('[Wassel] Sent via modal primary');
                    return { ok: true };
                }
            }

            return { ok: false, error: 'send_not_found' };
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

            // STEP 1: Click "Start a post"
            console.log('[Wassel] Step 1: Looking for Start Post button...');
            var allClickable = document.querySelectorAll('button, div[role="button"], span[role="textbox"]');
            var startBtn = null;

            for (var el of allClickable) {
                var text = (el.textContent || '').toLowerCase();
                var label = (el.getAttribute('aria-label') || '').toLowerCase();
                var placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
                if (text.includes('start a post') || label.includes('start a post') ||
                    text.includes('ابدأ منشور') || placeholder.includes('start') ||
                    el.classList.contains('share-box-feed-entry__trigger') ||
                    el.classList.contains('share-box-feed-entry__top-bar')) {
                    startBtn = el;
                    break;
                }
            }

            if (!startBtn) {
                startBtn = document.querySelector(
                    '.share-box-feed-entry__trigger, ' +
                    '.share-box-feed-entry__top-bar, ' +
                    '.share-creation-state, ' +
                    '[data-control-name="share.sharebox_text"]'
                );
            }

            if (startBtn) {
                console.log('[Wassel] Found Start Post, clicking...');
                startBtn.click();
                await sleep(3500);
            } else {
                console.error('[Wassel] Start Post button NOT found');
                showNotification('❌ لم يتم العثور على زر المنشور', 'error');
                return { ok: false, error: 'start_post_not_found' };
            }

            // STEP 2: Find editor
            console.log('[Wassel] Step 2: Looking for editor...');
            await sleep(1500);

            var editor = document.querySelector('.ql-editor[contenteditable="true"]') ||
                document.querySelector('[role="textbox"][contenteditable="true"]') ||
                document.querySelector('.share-creation-state__text-editor [contenteditable="true"]') ||
                document.querySelector('[data-placeholder][contenteditable="true"]');

            // Broader search: find any large contenteditable
            if (!editor) {
                var allEditable = document.querySelectorAll('[contenteditable="true"]');
                for (var ed of allEditable) {
                    if (ed.offsetHeight > 50 && ed.offsetWidth > 200) {
                        editor = ed;
                        break;
                    }
                }
            }

            if (!editor) {
                console.error('[Wassel] Editor NOT found');
                showNotification('❌ لم يتم العثور على محرر النص', 'error');
                return { ok: false, error: 'editor_not_found' };
            }

            console.log('[Wassel] Step 3: Found editor, filling content...');
            editor.focus();
            await sleep(300);
            editor.innerHTML = '';

            // Insert text line by line using execCommand
            var lines = content.split('\n');
            for (var i = 0; i < lines.length; i++) {
                document.execCommand('insertText', false, lines[i]);
                if (i < lines.length - 1) {
                    document.execCommand('insertLineBreak');
                }
            }
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(500);

            // Verify content was inserted
            if (!(editor.textContent || '').trim()) {
                console.log('[Wassel] execCommand failed, trying innerHTML...');
                editor.innerHTML = lines.map(function(l) { return '<p>' + (l || '<br>') + '</p>'; }).join('');
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            }

            console.log('[Wassel] Content filled:', (editor.textContent || '').slice(0, 50));
            await sleep(2000);

            // STEP 4: Click Post button
            console.log('[Wassel] Step 4: Looking for Post button...');
            var allBtns = document.querySelectorAll('button');
            var postBtn = null;

            for (var btn of allBtns) {
                var btnText = (btn.textContent || '').trim().toLowerCase();
                var btnLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                if ((btnText === 'post' || btnText === 'نشر' || btnLabel.includes('post')) &&
                    !btnText.includes('repost') && !btnLabel.includes('repost') && !btn.disabled) {
                    postBtn = btn;
                    break;
                }
            }

            if (!postBtn) {
                postBtn = document.querySelector('button.share-actions__primary-action:not([disabled])');
            }

            if (postBtn) {
                console.log('[Wassel] Found Post button, clicking...');
                postBtn.click();
                await sleep(3000);
                console.log('[Wassel] Post published!');
                showNotification('✅ تم نشر المنشور بنجاح!', 'success');
                return { ok: true };
            }

            console.log('[Wassel] Post button not found or disabled');
            showNotification('⚠️ المحتوى جاهز — اضغط Post يدوياً', 'error');
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

    console.log('[Wassel] Content script v2.0.2 loaded');
})();
