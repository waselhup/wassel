import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useCompanion } from './useCompanion';
import WelcomeMoment from './WelcomeMoment';
import Coachmarks from './Coachmarks';
import CompanionBubble from './CompanionBubble';

/**
 * CompanionMount — the single companion entry point, mounted once inside
 * ProtectedShell (so it covers every authenticated user-app page and nothing
 * public/portal). It owns:
 *
 *   1. The welcome moment + guided tour — fired ONCE, on the dashboard
 *      (/v2/home), in sequence (welcome → tour). A fresh user lands on /v2/home
 *      first, so this is where the first impression belongs.
 *   2. The floating bubble — on every protected page EXCEPT /v2/home (there the
 *      embedded CompanionCard stands in, rendered by Home itself).
 *   3. The adaptation seed — records a 'visit' signal once per session and a
 *      'page_view' signal as the route changes. Storage only.
 *
 * Everything degrades silently: if companion_state can't load, the bubble just
 * doesn't badge and the overlays don't fire. Nothing here can break a page.
 */
export default function CompanionMount() {
  const [location] = useLocation();
  const {
    language,
    needsWelcome,
    needsTour,
    markWelcomed,
    markTourDone,
  } = useCompanion();

  const isHome = location === '/v2/home';

  // ── Adaptation seed: one 'visit' per session ───────────────────────────
  const visitRecordedRef = useRef(false);
  useEffect(() => {
    if (visitRecordedRef.current) return;
    visitRecordedRef.current = true;
    trpc.dashboard.companion
      .recordSignal({ signalType: 'visit', route: location })
      .catch(() => {
        /* storage-only seed; failure is non-fatal */
      });
    // record once on mount; deliberately not re-running on location change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Adaptation seed: 'page_view' as the route changes ──────────────────
  const lastRouteRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastRouteRef.current === location) return;
    lastRouteRef.current = location;
    trpc.dashboard.companion
      .recordSignal({ signalType: 'page_view', route: location })
      .catch(() => {
        /* non-fatal */
      });
  }, [location]);

  return (
    <>
      {/* Welcome + tour: only on the dashboard, in sequence, each once. */}
      {isHome && needsWelcome && (
        <WelcomeMoment language={language} onClose={markWelcomed} />
      )}
      {isHome && !needsWelcome && needsTour && (
        <Coachmarks language={language} onDone={markTourDone} />
      )}

      {/* Floating bubble everywhere except Home (Home shows the embedded card). */}
      {!isHome && <CompanionBubble language={language} />}
    </>
  );
}
