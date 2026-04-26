import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import DesktopTopbar, { type DesktopNavLink } from '@/components/v2/DesktopTopbar';
import DesktopSidebar from '@/components/v2/DesktopSidebar';

export interface DesktopShellProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /**
   * Render the sidebar. Off for public pages (Landing/Auth/Pricing) and
   * on for protected app pages.
   */
  withSidebar?: boolean;
  /** Forwarded to DesktopTopbar — show JobsIndicator + UserMenu cluster. */
  showAccountCluster?: boolean;
  /** Forwarded to DesktopTopbar — render the PulseBar under the topbar. */
  showPulse?: boolean;
  /** Override default topbar nav links (use for public pages). */
  navLinks?: DesktopNavLink[];
}

/**
 * DesktopShell — desktop frame for v2 pages on >=1024px viewports.
 *
 * Layout (RTL):
 *   ┌─────────────────────────────────────────────┐
 *   │  Topbar (64px, sticky)                       │
 *   ├──────────────┬──────────────────────────────┤
 *   │              │                               │
 *   │   Main       │   Sidebar (240px, sticky)     │
 *   │  (flex-1)    │                               │
 *   │              │                               │
 *   └──────────────┴──────────────────────────────┘
 *
 * In LTR the columns swap: sidebar lands on the left.
 */
function DesktopShell({
  className,
  children,
  withSidebar = true,
  showAccountCluster = true,
  showPulse = true,
  navLinks,
  ...rest
}: DesktopShellProps) {
  return (
    <div
      className={cn(
        'flex min-h-[100dvh] w-full flex-col bg-v2-canvas font-ar text-v2-ink',
        className,
      )}
      {...rest}
    >
      <DesktopTopbar
        showAccountCluster={showAccountCluster}
        showPulse={showPulse}
        {...(navLinks ? { navLinks } : {})}
      />

      {withSidebar ? (
        <div className="mx-auto flex w-full max-w-[1440px] flex-1">
          {/*
            DOM order: sidebar first, main second. With dir="rtl" on <html>,
            flex-row visually places the first DOM child on the start side
            (right in RTL), so the sidebar lands on the right where Arabic
            users expect it. main takes the remaining space via flex-1.
          */}
          <DesktopSidebar />
          <main className="flex-1 min-w-0 px-8 py-6">
            <div className="mx-auto w-full max-w-[1200px]">
              {children}
            </div>
          </main>
        </div>
      ) : (
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-8 py-6">
          <div className="mx-auto w-full max-w-[1200px]">
            {children}
          </div>
        </main>
      )}
    </div>
  );
}

export default DesktopShell;
