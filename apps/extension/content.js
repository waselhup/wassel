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
    // CRITICAL: Only searches MAIN profile section to avoid clicking on suggested people
    async function doSendInvite(targetUrl, note) {
        try {
            var targetSlug = (targetUrl || '').split('/in/')[1]?.split(/[?/]/)[0]?.toLowerCase();
            var currentSlug = window.location.href.split('/in/')[1]?.split(/[?/]/)[0]?.toLowerCase();

            if (targetSlug && currentSlug !== targetSlug) {
                console.log('[Wassel] Wrong page! Expected:', targetSlug, 'Got:', currentSlug);
                window.location.href = targetUrl;
                await sleep(5000);
            }

            await sleep(3000);

            // CRITICAL: Only search in MAIN profile section, not sidebar/suggestions
            var mainSection =
                document.querySelector('.pv-top-card') ||
                document.querySelector('.scaffold-layout__main') ||
                document.querySelector('main') ||
                document.querySelector('[data-view-name="profile-card"]');

            if (!mainSection) {
                console.error('[Wassel] Main profile section not found');
                return { ok: false, error: 'profile_section_not_found' };
            }

            var buttons = mainSection.querySelectorAll('button');
            var connectBtn = null;

            for (var btn of buttons) {
                var text = (btn.textContent || '').trim().toLowerCase();
                var label = (btn.getAttribute('aria-label') || '').toLowerCase();

                if ((text === 'connect' || label.includes('connect')) &&
                    !text.includes('disconnect') && !text.includes('connected') &&
                    !text.includes('pending')) {
                    connectBtn = btn;
                    break;
                }
            }

            // Try More dropdown in main section only
            if (!connectBtn) {
                var moreBtn = Array.from(mainSection.querySelectorAll('button')).find(function(b) {
                    var l = (b.getAttribute('aria-label') || '').toLowerCase();
                    return l.includes('more action');
                });

                if (moreBtn) {
                    moreBtn.click();
                    await sleep(1500);

                    var items = document.querySelectorAll('[role="menuitem"]');
                    for (var i = 0; i < items.length; i++) {
                        var t = (items[i].textContent || '').toLowerCase();
                        if (t.includes('connect') && !t.includes('disconnect')) {
                            connectBtn = items[i];
                            break;
                        }
                    }
                }
            }

            if (!connectBtn) {
                var msgBtn = Array.from(mainSection.querySelectorAll('button')).find(function(b) {
                    return (b.textContent || '').trim().toLowerCase() === 'message';
                });
                if (msgBtn) return { ok: true, note: 'already_connected' };
                return { ok: false, error: 'connect_not_found' };
            }

            // Safety: reject if button is too far down the page (in suggestions area)
            var rect = connectBtn.getBoundingClientRect();
            if (rect.top > 800) {
                console.error('[Wassel] Button too far down (y=' + rect.top + '), likely suggestion');
                return { ok: false, error: 'button_in_suggestions' };
            }

            console.log('[Wassel] Clicking Connect at y=' + rect.top);
            connectBtn.click();
            await sleep(3000);

            // Add note if provided
            if (note && note.trim()) {
                var noteBtn = Array.from(document.querySelectorAll('button')).find(function(b) {
                    return (b.textContent || '').toLowerCase().includes('add a note');
                });
                if (noteBtn) {
                    noteBtn.click();
                    await sleep(1500);
                    var ta = document.querySelector('textarea');
                    if (ta) {
                        ta.focus();
                        var setter = Object.getOwnPropertyDescriptor(
                            HTMLTextAreaElement.prototype, 'value'
                        ).set;
                        setter.call(ta, note);
                        ta.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            }

            // Click Send
            await sleep(1000);
            var sendBtn = Array.from(document.querySelectorAll('button')).find(function(b) {
                var t = (b.textContent || '').trim().toLowerCase();
                return t === 'send' || t === 'send now' || t === 'send without a note';
            });

            if (sendBtn) {
                sendBtn.click();
                await sleep(2000);
                console.log('[Wassel] Invite sent!');
                return { ok: true };
            }

            // Try primary button in modal
            var modal = document.querySelector('[role="dialog"]');
            if (modal) {
                var primary = modal.querySelector('button.artdeco-button--primary');
                if (primary) { primary.click(); await sleep(2000); return { ok: true }; }
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
