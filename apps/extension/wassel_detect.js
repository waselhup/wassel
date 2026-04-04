// Wassel Extension — Detection Script
// Injected on wassel-alpha.vercel.app to signal extension is installed
// This is a lightweight script — no LinkedIn scraping logic

(function () {
  'use strict';

  // Set attribute for React detection
  document.documentElement.setAttribute('data-wassel-extension', 'true');

  // Post message for window listener detection
  window.postMessage({ type: 'WASSEL_EXTENSION_INSTALLED', version: '1.1.0' }, '*');

  // Also set a marker div
  if (!document.getElementById('wassel-extension-marker')) {
    const marker = document.createElement('div');
    marker.id = 'wassel-extension-marker';
    marker.style.display = 'none';
    document.body.appendChild(marker);
  }

  // Listen for token requests from background.js
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_SUPABASE_TOKEN') {
      try {
        const keys = Object.keys(localStorage);
        const directToken = localStorage.getItem('supabase_token');
        if (directToken) {
          sendResponse({ token: directToken, source: 'supabase_token' });
          return;
        }

        const sbKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (sbKey) {
          try {
            const parsed = JSON.parse(localStorage.getItem(sbKey));
            const t = parsed?.access_token || parsed?.currentSession?.access_token;
            if (t) {
              sendResponse({ token: t, source: sbKey });
              return;
            }
          } catch {}
        }

        const fallbackKey = keys.find(k =>
          k.toLowerCase().includes('supabase') && k.toLowerCase().includes('auth')
        );
        if (fallbackKey) {
          try {
            const parsed = JSON.parse(localStorage.getItem(fallbackKey));
            const t = parsed?.access_token || parsed?.currentSession?.access_token;
            if (t) {
              sendResponse({ token: t, source: fallbackKey });
              return;
            }
          } catch {}
        }

        sendResponse({ token: null, source: null });
      } catch (e) {
        sendResponse({ token: null, error: e.message });
      }
    }
  });

  console.log('[Wassel Extension] Detection signal injected ✅');
})();
