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

    // ── LinkedIn 2026: click "Connect" button on a profile page ──
    async function doSendInvite(targetUrl, note) {
        try {
            await sleep(3000); // Wait for profile to fully load

            // SAFETY CHECK: Verify we're on the correct profile page
            if (targetUrl && targetUrl.includes('/in/')) {
                const currentUrl = window.location.href.toLowerCase();
                const targetSlug = targetUrl.split('/in/')[1]?.split(/[?/#]/)[0]?.toLowerCase();

                if (targetSlug && !currentUrl.includes('/in/' + targetSlug)) {
                    console.log('[Wassel] Wrong page! Expected:', targetSlug, 'Got:', currentUrl);
                    window.location.href = targetUrl;
                    await sleep(5000);

                    const newUrl = window.location.href.toLowerCase();
                    if (!newUrl.includes('/in/' + targetSlug)) {
                        console.error('[Wassel] Navigation failed, still on wrong page');
                        return { ok: false, error: 'navigation_failed' };
                    }
                    // Wait for page to load after navigation
                    await sleep(3000);
                }
                console.log('[Wassel] Confirmed on correct profile:', targetSlug);
            }

            // Log the profile name for verification
            const profileName = (document.querySelector(
                'h1.text-heading-xlarge, h1.inline, .pv-top-card h1, h1'
            ) || {}).textContent;
            console.log('[Wassel] Profile name on page:', (profileName || '').trim());

            // ── PROFILE ACTION BAR — the main buttons section at the top of the profile ──
            // LinkedIn wraps the profile owner's action buttons in a specific container.
            // We MUST only search inside this container to avoid clicking sidebar "Connect" buttons
            // belonging to "People also viewed" / "People you may know" suggestions.
            const profileActionContainers = [
                '.pv-top-card-v2-ctas',                          // 2026 layout
                '.pvs-profile-actions',                          // alternate 2026 layout
                '.pv-top-card__action-buttons',                  // classic layout
                '.pv-top-card-v3__action-buttons',               // v3 layout
                'section.pv-top-card .ph5',                      // section-based layout
                '.scaffold-layout__main',                        // broad main content area
            ];

            let actionBar = null;
            for (const sel of profileActionContainers) {
                actionBar = document.querySelector(sel);
                if (actionBar) {
                    console.log('[Wassel] Found action bar via:', sel);
                    break;
                }
            }

            // Helper: find button by text ONLY within a container (or page-wide as last resort)
            function findByText(texts, container) {
                const scope = container || document;
                const all = scope.querySelectorAll('button, [role="button"]');
                for (const el of all) {
                    // SKIP buttons inside sidebar recommendation sections
                    if (!container && el.closest(
                        '.pv-browsemap-section, ' +
                        '.pv-right-rail, ' +
                        '[data-view-name="profile-browsemap"], ' +
                        '.aside-container, ' +
                        '.scaffold-layout__aside, ' +
                        '.artdeco-card--full-width, ' +
                        '[data-view-name="profile-card"]'
                    )) {
                        continue;
                    }
                    const t = (el.textContent || '').trim().toLowerCase();
                    const label = (el.getAttribute('aria-label') || '').toLowerCase();
                    for (const text of texts) {
                        if (t === text || (label.includes(text) && !label.includes('disconnect'))) {
                            return el;
                        }
                    }
                }
                return null;
            }

            // STEP 1: Find Connect button — FIRST inside the profile action bar, THEN page-wide with sidebar exclusion
            let connectBtn = null;
            if (actionBar) {
                connectBtn = findByText(['connect', 'اتصال'], actionBar);
                if (connectBtn) console.log('[Wassel] Found Connect in action bar ✓');
            }
            if (!connectBtn) {
                connectBtn = findByText(['connect', 'اتصال'], null);
                if (connectBtn) console.log('[Wassel] Found Connect via page-wide search (sidebar excluded) ✓');
            }

            // Pattern B: "More" dropdown → Connect (also scoped to action bar first)
            if (!connectBtn) {
                const moreBtn = findByText(['more', 'more actions', 'المزيد'], actionBar) ||
                                findByText(['more', 'more actions', 'المزيد'], null);
                if (moreBtn) {
                    moreBtn.click();
                    await sleep(1500);
                    // Search dropdown items (dropdowns render at document level, so search globally)
                    const dropdownItems = document.querySelectorAll(
                        '[role="menuitem"], .artdeco-dropdown__item, .artdeco-dropdown__content-inner li'
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
                // Check if already connected (Message button present)
                const msgBtn = findByText(['message', 'رسالة'], actionBar) ||
                               findByText(['message', 'رسالة'], null);
                if (msgBtn) {
                    console.log('[Wassel] Already connected (Message button found)');
                    return { ok: true, note: 'already_connected' };
                }
                console.log('[Wassel] No Connect button found');
                return { ok: false, error: 'no_connect_button' };
            }

            // SAFETY: Verify the Connect button is NOT inside a sidebar/recommendation card
            const dangerousParent = connectBtn.closest(
                '.pv-browsemap-section, .pv-right-rail, [data-view-name="profile-browsemap"], ' +
                '.aside-container, .scaffold-layout__aside, [data-view-name="profile-card"]'
            );
            if (dangerousParent) {
                console.error('[Wassel] ⚠️ BLOCKED: Connect button belongs to sidebar suggestion, NOT the profile owner!');
                return { ok: false, error: 'connect_button_in_sidebar' };
            }

            // Check if button says Pending or Connected
            const btnText = (connectBtn.textContent || '').trim().toLowerCase();
            if (btnText.includes('pending') || btnText.includes('connected')) {
                console.log('[Wassel] Already pending or connected');
                return { ok: true, note: 'already_pending_or_connected' };
            }

            console.log('[Wassel] Found Connect button, clicking...');
            connectBtn.click();
            await sleep(3000);

            // STEP 2: Handle the modal — "Add a note" or direct send
            if (note && note.trim()) {
                const addNoteBtn = findByText(['add a note', 'إضافة ملاحظة']);
                if (addNoteBtn) {
                    addNoteBtn.click();
                    await sleep(1500);
                    const textarea = document.querySelector('textarea');
                    if (textarea) {
                        textarea.focus();
                        var setter = Object.getOwnPropertyDescriptor(
                            HTMLTextAreaElement.prototype, 'value'
                        ).set;
                        setter.call(textarea, note);
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        await sleep(500);
                    }
                }
            }

            // STEP 3: Click Send
            await sleep(1000);
            let sendBtn = findByText(['send', 'send now', 'send without a note', 'send invitation', 'إرسال']);

            if (!sendBtn) {
                // Find primary button in modal
                var modal = document.querySelector('[role="dialog"], .artdeco-modal');
                if (modal) {
                    var btns = modal.querySelectorAll('button');
                    for (var b of btns) {
                        if (b.className.includes('primary') || b.className.includes('ml-auto')) {
                            sendBtn = b;
                            break;
                        }
                    }
                }
            }

            if (sendBtn) {
                sendBtn.click();
                await sleep(2000);
                console.log('[Wassel] Invite SENT successfully');
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
