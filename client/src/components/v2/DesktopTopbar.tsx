import type { HTMLAttributes, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import PulseBar from '@/components/v2/PulseBar';
import JobsIndicator from '@/components/v2/JobsIndicator';
import UserMenu from '@/components/v2/UserMenu';

export interface DesktopNavLink {
  id: string;
  label: string;
  href: string;
  /** render this link as a primary-styled CTA button instead of a text link */
  cta?: boolean;
}

export interface DesktopTopbarProps extends HTMLAttributes<HTMLElement> {
  /** Horizontal nav links shown after the logo (RTL: to the start of avatar) */
  navLinks?: DesktopNavLink[];
  /** Show the JobsIndicator + UserMenu cluster on the end side. Public pages pass false. */
  showAccountCluster?: boolean;
  /** Render the PulseBar under the topbar. Defaults to true. */
  showPulse?: boolean;
  /** Override end-slot content (replaces JobsIndicator + UserMenu). */
  trailing?: ReactNode;
}

const defaultNavLinks: DesktopNavLink[] = [
  { id: 'home',     label: 'الرئيسية', href: '/v2/home' },
  { id: 'analyze',  label: 'الرادار',   href: '/v2/analyze' },
  { id: 'posts',    label: 'المنشورات',  href: '/v2/posts' },
  { id: 'activity', label: 'النشاط',    href: '/v2/activity' },
];

const Logo = (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="9"   stroke="var(--teal-700)" strokeWidth="1.4" />
    <circle cx="11" cy="11" r="5"   stroke="var(--teal-700)" strokeWidth="1.4" />
    <circle cx="11" cy="11" r="1.4" fill="var(--teal-700)" />
  </svg>
);

function DesktopTopbar({
  className,
  navLinks = defaultNavLinks,
  showAccountCluster = true,
  showPulse = true,
  trailing,
  ...rest
}: DesktopTopbarProps) {
  const [location, navigate] = useLocation();

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-v2-line bg-v2-canvas/95 backdrop-blur-md',
        className,
      )}
      {...rest}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-8">
        {/* Start (RTL: right) — Logo + brand + nav links */}
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={() => navigate('/v2/home')}
            className="flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 rounded-v2-sm px-1"
            aria-label="الرئيسية"
          >
            {Logo}
            <span className="font-ar text-[17px] font-bold text-v2-ink">وصّل</span>
          </button>

          {navLinks.some((l) => !l.cta) && (
            <nav className="flex items-center gap-1" aria-label="التنقل الرئيسي">
              {navLinks.filter((l) => !l.cta).map((link) => {
                const isActive = location === link.href || location.startsWith(`${link.href}/`);
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => navigate(link.href)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'h-9 px-3 rounded-v2-sm font-ar text-[14px] cursor-pointer',
                      'transition-colors duration-200 ease-out',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
                      isActive
                        ? 'font-semibold text-teal-700 bg-teal-50'
                        : 'font-medium text-v2-body hover:text-v2-ink hover:bg-v2-canvas-2',
                    )}
                  >
                    {link.label}
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* End (RTL: left) — CTAs from navLinks, then JobsIndicator + UserMenu, or custom trailing */}
        <div className="flex items-center gap-2">
          {trailing ?? (
            <>
              {navLinks.filter((l) => l.cta).map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => navigate(link.href)}
                  className={cn(
                    'inline-flex items-center justify-center h-9 px-4 rounded-v2-sm cursor-pointer',
                    'bg-teal-600 text-white font-ar text-[14px] font-semibold border border-teal-600',
                    'shadow-card transition-colors duration-200 ease-out',
                    'hover:bg-teal-700 active:bg-teal-700',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
                  )}
                >
                  {link.label}
                </button>
              ))}
              {showAccountCluster && (
                <>
                  <JobsIndicator />
                  <UserMenu />
                </>
              )}
            </>
          )}
        </div>
      </div>
      {showPulse && <PulseBar />}
    </header>
  );
}

export default DesktopTopbar;
