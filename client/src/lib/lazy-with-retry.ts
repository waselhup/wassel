import { lazy, type ComponentType } from 'react';

/**
 * lazyWithRetry — wraps React.lazy() so that a failed dynamic import
 * (typically caused by a stale cached index.html referencing chunk
 * hashes that no longer exist after a deploy) triggers a one-shot
 * hard reload that flushes the cached HTML and pulls the new chunks.
 *
 * Without this guard, deploying causes a window where any user with
 * the old HTML cached gets a hard render-time exception when they
 * navigate to a lazy route — which the ErrorBoundary catches and shows
 * as "حدث خطأ غير متوقع". The user has no way to recover except
 * manually hard-reloading.
 *
 * The session-storage flag prevents an infinite reload loop if the
 * import is genuinely broken (e.g. server returning 500 for the chunk).
 */

const RELOAD_KEY = 'wassel:chunk-reload-attempted';

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    try {
      const mod = await importer();
      // Reset the flag on a successful load so future failures can retry once.
      try { window.sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ }
      return mod;
    } catch (err: any) {
      const isChunkError =
        err &&
        (
          err.name === 'ChunkLoadError' ||
          /Loading chunk/i.test(err.message || '') ||
          /Failed to fetch dynamically imported module/i.test(err.message || '') ||
          /error loading dynamically imported module/i.test(err.message || '')
        );

      if (!isChunkError) throw err;

      let alreadyReloaded = false;
      try {
        alreadyReloaded = window.sessionStorage.getItem(RELOAD_KEY) === '1';
      } catch { /* sessionStorage unavailable — fall through */ }

      if (alreadyReloaded) {
        // We already tried reloading once and the import is still failing.
        // Let the error bubble up so the ErrorBoundary shows the fallback.
        console.error('[lazyWithRetry] chunk import still failing after reload', err);
        throw err;
      }

      try { window.sessionStorage.setItem(RELOAD_KEY, '1'); } catch { /* ignore */ }
      console.warn('[lazyWithRetry] chunk import failed, hard-reloading to refresh cache', err);
      // location.reload() with `true` is non-standard; setting href forces a network load.
      window.location.reload();
      // Block on a never-resolving promise so React doesn't try to render
      // the error UI before the page has reloaded.
      return new Promise<never>(() => {});
    }
  });
}
