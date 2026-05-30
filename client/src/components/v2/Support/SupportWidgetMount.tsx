import { lazy, Suspense, type ReactElement } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';

// Code-split the widget so its bundle only loads when it's actually rendered.
const SupportWidget = lazy(() => import('./SupportWidget'));

/**
 * SupportWidgetMount — single global entry point for the support chat widget,
 * mounted once next to <V2Routes/> so it appears on BOTH the public landing
 * and inside the authenticated app.
 *
 * Mode: 'user' when authenticated, else 'visitor'. The server enforces the
 * correct cap per mode regardless of what we send.
 *
 * Visibility (non-intrusive): hidden on auth, onboarding, and checkout routes
 * where a floating launcher would distract from a focused flow. The widget
 * never auto-opens — it's a collapsed launcher until the user taps it.
 */

// Hide on focused flows where a chat launcher would be in the way.
const HIDE_PREFIXES = [
  '/v2/login',
  '/v2/signup',
  '/v2/onboarding',
  '/v2/checkout',
];

function shouldHide(pathname: string): boolean {
  return HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export default function SupportWidgetMount(): ReactElement | null {
  const [location] = useLocation();
  const { user, loading } = useAuth();

  // Only run inside the v2 surface (App mounts us alongside <V2Routes/>).
  if (!location.startsWith('/v2')) return null;
  if (shouldHide(location)) return null;
  // While auth state is resolving, don't flash the widget in the wrong mode.
  if (loading) return null;

  const mode: 'visitor' | 'user' = user ? 'user' : 'visitor';

  return (
    <Suspense fallback={null}>
      <SupportWidget mode={mode} />
    </Suspense>
  );
}
