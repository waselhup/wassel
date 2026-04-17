console.log('WASSEL v2.2 - BUILD ' + new Date().toISOString());

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';
import { initAnalytics } from './lib/analytics';
import { ErrorBoundary } from './components/ErrorBoundary';

initAnalytics();

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[unhandledrejection]', event.reason);
    try {
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: String(event.reason?.message || event.reason),
          stack: event.reason?.stack || '',
          type: 'unhandledrejection',
          url: window.location.href,
        }),
      }).catch(() => {});
    } catch {}
  });

  window.addEventListener('error', (event) => {
    console.error('[window.error]', event.error || event.message);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
