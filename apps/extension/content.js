// ============================================================
// WASSEL EXTENSION v5.0.0 — Content Script
// Cloud-first: All LinkedIn actions via Voyager API on server.
// Extension role: detect installation, auth bridge, cookie sync.
// ============================================================

(function () {
    'use strict';

    // Prevent double injection
    if (window.__wasselContentInjected) return;
    window.__wasselContentInjected = true;

    // ── Detection: mark the page so the web app knows extension is installed ──
    document.documentElement.setAttribute('data-wassel-extension', 'true');
    window.postMessage({ type: 'WASSEL_EXTENSION_INSTALLED', version: '5.0.0' }, '*');

    // Hidden marker element for legacy detection
    const marker = document.createElement('div');
    marker.id = 'wassel-extension-marker';
    marker.style.display = 'none';
    document.body.appendChild(marker);

    // ── Web app → extension bridge ──
    window.addEventListener('message', (event) => {
        if (event.data?.source !== 'wassel-web') return;

        // Auth token bridge — dashboard sends JWT to extension
        if (event.data?.type === 'WASSEL_AUTH_TOKEN' && event.data?.token) {
            chrome.storage.local.set({ wasselToken: event.data.token });
            console.log('[Wassel] Token received via postMessage bridge');
        }
    });

    // ── Message handler (from background.js) ──
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Heartbeat check from background.js
        if (message.type === 'PING') {
            sendResponse({ status: 'alive' });
            return true;
        }
    });

    console.log('[Wassel] Content script v5.0.0 loaded (cloud-only mode)');
})();
