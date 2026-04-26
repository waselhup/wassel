import { useEffect, useState, type ReactNode } from 'react';
import Phone from '@/components/v2/Phone';
import DesktopShell, { type DesktopShellProps } from '@/components/v2/DesktopShell';

export const DESKTOP_BREAKPOINT = '(min-width: 1024px)';

/**
 * useMediaQuery — SSR-safe matchMedia hook. Defaults to `false` on the first
 * render (matching the mobile branch) so server-rendered HTML matches the
 * smallest viewport, then upgrades to the real value once mounted.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    if (mql.addEventListener) {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }
    // Older Safari (<14) fallback.
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, [query]);

  return matches;
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_BREAKPOINT);
}

export interface ResponsiveShellProps
  extends Omit<DesktopShellProps, 'children'> {
  children?: ReactNode;
}

/**
 * ResponsiveShell — picks the right outer chrome based on viewport.
 *   <1024px  → <Phone>{children}</Phone>             (mobile column, BottomNav lives inside the page)
 *   ≥1024px  → <DesktopShell ...>{children}</DesktopShell>
 *
 * All DesktopShell-specific props (withSidebar, showAccountCluster, showPulse)
 * are forwarded; on mobile they're ignored.
 */
function ResponsiveShell({ children, ...desktopProps }: ResponsiveShellProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return <DesktopShell {...desktopProps}>{children}</DesktopShell>;
  }

  return <Phone>{children}</Phone>;
}

export default ResponsiveShell;
