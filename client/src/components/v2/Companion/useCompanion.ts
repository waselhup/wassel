import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trpc, type CompanionStateShape, type CompanionMessageShape } from '@/lib/trpc';

/**
 * useCompanion — shared companion state for the mount + card + bubble.
 *
 * Loads companion_state once, exposes the welcome/tour flags, and provides
 * stable callbacks to mark the welcome / tour done (optimistic: we flip local
 * state immediately so overlays close without waiting on the network).
 *
 * It never throws and never blocks the UI — every fetch degrades to a safe
 * default (state = null → treated as "fresh", which shows the welcome, the
 * correct default for a brand-new user).
 */
export function useCompanion() {
  const { i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const language: 'ar' | 'en' = isAr ? 'ar' : 'en';

  const [state, setState] = useState<CompanionStateShape | null>(null);
  const [stateLoaded, setStateLoaded] = useState(false);

  // Load companion state once.
  useEffect(() => {
    let cancelled = false;
    trpc.dashboard.companion
      .getState()
      .then((s) => {
        if (!cancelled) {
          setState(s);
          setStateLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setStateLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markWelcomed = useCallback(() => {
    // Optimistic: close the welcome immediately.
    setState((prev) =>
      prev
        ? { ...prev, welcomed_at: new Date().toISOString() }
        : prev,
    );
    trpc.dashboard.companion.markWelcomed().catch(() => {
      /* non-fatal; it'll just show once more next session at worst */
    });
  }, []);

  const markTourDone = useCallback(() => {
    setState((prev) =>
      prev ? { ...prev, tour_done_at: new Date().toISOString() } : prev,
    );
    trpc.dashboard.companion.markTourDone().catch(() => {
      /* non-fatal */
    });
  }, []);

  // welcomed/tour: when state hasn't loaded yet we DON'T show overlays (avoid a
  // flash before we know). Once loaded, null welcomed_at → not yet welcomed.
  const needsWelcome = stateLoaded && !!state && !state.welcomed_at;
  // The tour follows the welcome: only after the user has been welcomed.
  const needsTour =
    stateLoaded && !!state && !!state.welcomed_at && !state.tour_done_at;

  return {
    isAr,
    language,
    state,
    stateLoaded,
    needsWelcome,
    needsTour,
    markWelcomed,
    markTourDone,
  };
}

/**
 * useCompanionMessage — fetch the companion's contextual message (reused Next
 * Task + optional purchase guidance). Used by both the Home card and the
 * floating bubble. Returns loading + the message; never throws.
 */
export function useCompanionMessage(language: 'ar' | 'en') {
  const [message, setMessage] = useState<CompanionMessageShape | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    trpc.dashboard.companion
      .getMessage({ language })
      .then((m) => {
        if (!cancelled) {
          setMessage(m);
          loadedOnce.current = true;
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  return { message, loading };
}
