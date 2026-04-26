import type { HTMLAttributes, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import NumDisplay from '@/components/v2/NumDisplay';
import Eyebrow from '@/components/v2/Eyebrow';

export interface DesktopSidebarItem {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
}

export interface DesktopSidebarProps extends HTMLAttributes<HTMLElement> {
  /** override default nav items */
  items?: DesktopSidebarItem[];
  /** show the token balance widget. Defaults to true. */
  showTokenWidget?: boolean;
  /** token balance to render in the widget */
  balance?: number;
  /** total token allowance */
  total?: number;
  /** user shortcut at the bottom — name */
  userName?: string;
  /** user shortcut — plan label */
  userPlan?: string;
}

const HomeIcon = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M3 8 L10 3 L17 8 V16 H3 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
const RadarIcon = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="10" cy="10" r="1" fill="currentColor" />
  </svg>
);
const PostsIcon = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M3 4 H14 M3 8 H17 M3 12 H14 M3 16 H17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const ActivityIcon = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M3 11 L7 11 L9 5 L12 16 L14 9 L17 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const defaultItems: DesktopSidebarItem[] = [
  { id: 'home',     label: 'الرئيسية', href: '/v2/home',     icon: HomeIcon },
  { id: 'analyze',  label: 'الرادار',   href: '/v2/analyze',  icon: RadarIcon },
  { id: 'posts',    label: 'المنشورات', href: '/v2/posts',    icon: PostsIcon },
  { id: 'activity', label: 'النشاط',   href: '/v2/activity', icon: ActivityIcon },
];

function DesktopSidebar({
  className,
  items = defaultItems,
  showTokenWidget = true,
  balance = 240,
  total = 300,
  userName = 'محمد',
  userPlan = 'الخطة الاحترافية',
  ...rest
}: DesktopSidebarProps) {
  const [location, navigate] = useLocation();

  const used = Math.max(0, total - balance);
  const usedPct = total > 0 ? Math.round((used / total) * 100) : 0;

  return (
    <aside
      aria-label="التنقل الجانبي"
      className={cn(
        'sticky top-16 flex h-[calc(100dvh-64px)] w-60 shrink-0 flex-col',
        // border-e = end side (left in RTL, right in LTR) — the edge that meets <main>
        'border-e border-v2-line bg-v2-surface',
        'animate-[v2-sidebar-in_300ms_var(--ease-out)_both]',
        className,
      )}
      {...rest}
    >
      <style>{`
        @keyframes v2-sidebar-in {
          0%   { opacity: 0; transform: translateX(8px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        :root[dir="rtl"] aside[aria-label="التنقل الجانبي"] {
          animation-name: v2-sidebar-in-rtl;
        }
        @keyframes v2-sidebar-in-rtl {
          0%   { opacity: 0; transform: translateX(-8px); }
          100% { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <nav className="flex flex-col gap-0.5 p-3" aria-label="القوائم الرئيسية">
        {items.map((item) => {
          const isActive = location === item.href || location.startsWith(`${item.href}/`);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.href)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-3 h-10 ps-3 pe-3 rounded-v2-sm cursor-pointer',
                'font-ar text-[14px] transition-colors duration-200 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
                isActive
                  ? 'bg-teal-50 text-teal-700 font-semibold'
                  : 'text-v2-body hover:bg-v2-canvas-2 hover:text-v2-ink font-medium',
              )}
            >
              {/* RTL: active indicator on the start (right) edge — 4px */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 start-0 w-[3px] rounded-full bg-teal-600"
                />
              )}
              <span className={cn('shrink-0', isActive ? 'text-teal-700' : 'text-v2-mute group-hover:text-v2-body')}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="my-1 mx-3 h-px bg-v2-line" />

      {showTokenWidget && (
        <div className="px-3 py-2">
          <div className="rounded-v2-md border border-v2-line bg-v2-canvas px-3.5 py-3">
            <Eyebrow>TOKEN BALANCE</Eyebrow>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <NumDisplay className="text-[20px] font-bold leading-none text-v2-ink">
                {balance}
              </NumDisplay>
              <span className="font-ar text-[11px] text-v2-dim">/</span>
              <NumDisplay className="text-[12px] text-v2-dim">{total}</NumDisplay>
              <span className="font-ar text-[11px] text-v2-dim">توكن</span>
            </div>
            <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-v2-line">
              <div
                className="h-full rounded-full bg-teal-500"
                style={{ width: `${100 - usedPct}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => navigate('/v2/pricing')}
              className="mt-2 font-ar text-[12px] font-semibold text-teal-700 hover:text-teal-600 cursor-pointer"
            >
              شحن +
            </button>
          </div>
        </div>
      )}

      {/* Spacer pushes the user shortcut to the bottom */}
      <div className="flex-1" />

      <button
        type="button"
        onClick={() => navigate('/v2/me')}
        className={cn(
          'm-3 flex items-center gap-2.5 rounded-v2-sm border border-v2-line bg-v2-surface px-2.5 py-2',
          'text-start cursor-pointer hover:bg-v2-canvas-2 transition-colors duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
        )}
        aria-label={`الحساب — ${userName}`}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 font-ar text-[13px] font-bold text-white"
        >
          {userName.trim().charAt(0) || '?'}
        </span>
        <span className="min-w-0 flex-1 font-ar">
          <span className="block truncate text-[13px] font-semibold text-v2-ink">{userName}</span>
          <span className="block truncate text-[11px] text-v2-dim">{userPlan}</span>
        </span>
      </button>
    </aside>
  );
}

export default DesktopSidebar;
