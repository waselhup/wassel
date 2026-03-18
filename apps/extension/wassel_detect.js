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

  console.log('[Wassel Extension] Detection signal injected ✅');
})();
