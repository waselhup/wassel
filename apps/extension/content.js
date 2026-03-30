// ============================================================
// WASSEL EXTENSION v2.0.0 — Content Script
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
    window.postMessage({ type: 'WASSEL_EXTENSION_INSTALLED', version: '2.0.0' }, '*');

    // Hidden marker element for legacy detection
    const marker = document.createElement('div');
    marker.id = 'wassel-extension-marker';
    marker.style.display = 'none';
    document.body.appendChild(marker);

    // ── Auth token bridge: receive token from Wassel web app via postMessage ──
    window.addEventListener('message', (event) => {
        if (
            event.data?.source === 'wassel-web' &&
            event.data?.type === 'WASSEL_AUTH_TOKEN' &&
            event.data?.token
        ) {
            chrome.storage.local.set({ wasselToken: event.data.token });
            console.log('[Wassel] Token received via postMessage bridge');
        }
    });

    // ── Message handler ──
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

        // Campaign: send a message
        if (message.type === 'SEND_MESSAGE' && message.content) {
            console.log('[Wassel] Send message requested');
            doSendMessage(message.content).then(result => sendResponse(result));
            return true; // async
        }

        // Post publishing: fill in LinkedIn post composer
        if (message.type === 'PUBLISH_POST' && message.content) {
            console.log('[Wassel] PUBLISH_POST received');
            doLinkedInPost(message.content, message.postId).then(result => sendResponse(result));
            return true; // async
        }
    });

    // ── LinkedIn: click "Connect" button on a profile page ──
    async function doSendInvite(note) {
        try {
            const connectBtn = Array.from(document.querySelectorAll('button')).find(b =>
                (b.textContent || '').trim().toLowerCase() === 'connect' ||
                (b.getAttribute('aria-label') || '').toLowerCase().includes('connect')
            );
            if (!connectBtn) return { ok: false, error: 'Connect button not found' };

            connectBtn.click();
            await sleep(1500);

            if (note) {
                // Click "Add a note"
                const addNoteBtn = Array.from(document.querySelectorAll('button')).find(b =>
                    (b.textContent || '').toLowerCase().includes('add a note')
                );
                if (addNoteBtn) {
                    addNoteBtn.click();
                    await sleep(800);
                    const noteArea = document.querySelector('textarea#custom-message');
                    if (noteArea) {
                        noteArea.value = note;
                        noteArea.dispatchEvent(new Event('input', { bubbles: true }));
                        await sleep(300);
                    }
                }
            }

            // Click "Send" / "Done"
            const sendBtn = Array.from(document.querySelectorAll('button')).find(b =>
                ['send', 'send now', 'done'].includes((b.textContent || '').trim().toLowerCase())
            );
            if (sendBtn) {
                sendBtn.click();
                return { ok: true };
            }
            return { ok: false, error: 'Send button not found' };
        } catch (err) {
            console.error('[Wassel] Invite error:', err);
            return { ok: false, error: err.message };
        }
    }

    // ── LinkedIn: send a message via the messaging composer ──
    async function doSendMessage(content) {
        try {
            const msgBtn = Array.from(document.querySelectorAll('button')).find(b =>
                (b.textContent || '').trim().toLowerCase() === 'message' ||
                (b.getAttribute('aria-label') || '').toLowerCase().includes('message')
            );
            if (!msgBtn) return { ok: false, error: 'Message button not found' };

            msgBtn.click();
            await sleep(1500);

            const msgBox = document.querySelector('.msg-form__contenteditable, [role="textbox"][contenteditable="true"]');
            if (!msgBox) return { ok: false, error: 'Message box not found' };

            msgBox.focus();
            document.execCommand('insertText', false, content);
            await sleep(400);

            const submitBtn = document.querySelector('.msg-form__send-button, button[type="submit"]');
            if (submitBtn) {
                submitBtn.click();
                return { ok: true };
            }
            return { ok: false, error: 'Submit button not found' };
        } catch (err) {
            console.error('[Wassel] Message error:', err);
            return { ok: false, error: err.message };
        }
    }

    // ── LinkedIn: fill post composer and highlight Post button for user to click ──
    async function doLinkedInPost(content, postId) {
        try {
            // Click "Start a post" if not already open
            const startPostBtn =
                document.querySelector('[class*="share-box"] button') ||
                Array.from(document.querySelectorAll('button')).find(b =>
                    (b.textContent || '').toLowerCase().includes('start a post') ||
                    (b.getAttribute('aria-label') || '').toLowerCase().includes('start a post')
                );

            if (startPostBtn) {
                startPostBtn.click();
                await sleep(2000);
            }

            // Fill the content editable post area
            const postArea =
                document.querySelector('[role="textbox"][contenteditable="true"]') ||
                document.querySelector('.ql-editor') ||
                document.querySelector('[contenteditable="true"]');

            if (postArea) {
                postArea.focus();
                postArea.innerHTML = `<p>${content.replace(/\n/g, '</p><p>')}</p>`;
                postArea.dispatchEvent(new Event('input', { bubbles: true }));
            }

            await sleep(1000);

            // Highlight Post button — user must click it themselves
            const postBtn = Array.from(document.querySelectorAll('button')).find(b =>
                (b.textContent || '').trim() === 'Post' ||
                (b.getAttribute('aria-label') || '').includes('Post')
            );
            if (postBtn) {
                postBtn.style.boxShadow = '0 0 12px #7c3aed, 0 0 24px #ec4899';
                postBtn.style.border = '2px solid #7c3aed';
            }

            return { ok: true };
        } catch (err) {
            console.error('[Wassel] Post helper error:', err);
            return { ok: false, error: err.message };
        }
    }

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    console.log('[Wassel] Content script v2.0.0 loaded');
})();
