import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BottomNavItemId = 'home' | 'analyze' | 'tools' | 'profile' | 'posts' | 'activity';

export interface BottomNavItem {
  id: BottomNavItemId;
  label: string;
  icon: ReactNode;
  onSelect?: () => void;
}

export type FabIconName = 'plus' | 'arrow' | 'check';

export interface BottomNavProps extends HTMLAttributes<HTMLElement> {
  /** which item is currently active. The FAB is its own thing — it doesn't take active state. */
  active?: BottomNavItemId;
  /** override the default 4 items (home/analyze/tools/profile). FAB is rendered separately. */
  items?: BottomNavItem[];
  /** swap the FAB icon by route — `plus` on Home, `arrow` on Result, `check` on Posts. */
  fabIcon?: FabIconName;
  /** click handler for the central FAB */
  onFabClick?: () => void;
  /** accessible label for the FAB */
  fabLabel?: string;
}

const HomeIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M3 8 L10 3 L17 8 V16 H3 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
const RadarIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="10" cy="10" r="1" fill="currentColor" />
  </svg>
);
const ToolsIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="3"  y="3"  width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
    <rect x="11" y="3"  width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
    <rect x="3"  y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
    <rect x="11" y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
const ProfileIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4 17 a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const defaultItems: BottomNavItem[] = [
  { id: 'home',    label: 'الرئيسية', icon: HomeIcon },
  { id: 'analyze', label: 'الرادار',  icon: RadarIcon },
  { id: 'tools',   label: 'الأدوات',  icon: ToolsIcon },
  { id: 'profile', label: 'حسابي',    icon: ProfileIcon },
];

const fabIcons: Record<FabIconName, ReactNode> = {
  plus: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 4 V14 M4 9 H14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  arrow: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="rtl:rotate-180">
      <path d="M5 4 L11 9 L5 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 9 L8 13 L14 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function BottomNav({
  className,
  active,
  items = defaultItems,
  fabIcon = 'plus',
  onFabClick,
  fabLabel = 'إجراء',
  ...rest
}: BottomNavProps) {
  // The FAB is centered. We split the items into two halves so the FAB sits between them.
  const half = Math.ceil(items.length / 2);
  const left = items.slice(0, half);
  const right = items.slice(half);

  return (
    <nav
      className={cn(
        'absolute inset-x-0 bottom-0 z-20 border-t border-v2-line bg-v2-surface',
        className,
      )}
      style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 18px)` }}
      {...rest}
    >
      <div className="relative flex h-[60px] items-center justify-around">
        {left.map((it) => (
          <NavButton key={it.id} item={it} active={active === it.id} />
        ))}
        <button
          type="button"
          onClick={onFabClick}
          aria-label={fabLabel}
          className={cn(
            'flex h-12 w-12 -translate-y-3.5 items-center justify-center',
            'rounded-v2-lg bg-teal-600 text-white shadow-card cursor-pointer',
            'transition-colors duration-200 ease-out hover:bg-teal-700',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40',
          )}
        >
          {fabIcons[fabIcon]}
        </button>
        {right.map((it) => (
          <NavButton key={it.id} item={it} active={active === it.id} />
        ))}
      </div>
    </nav>
  );
}

function NavButton({ item, active }: { item: BottomNavItem; active: boolean }) {
  return (
    <button
      type="button"
      onClick={item.onSelect}
      aria-current={active ? 'page' : undefined}
      aria-label={item.label}
      className={cn(
        'flex min-w-[56px] flex-col items-center gap-0.5 px-1.5 py-1 cursor-pointer',
        'transition-colors duration-200 ease-out',
        active ? 'text-teal-700' : 'text-v2-mute hover:text-v2-body',
      )}
    >
      {item.icon}
      <span className={cn('text-[10px] leading-none font-ar', active ? 'font-semibold' : 'font-medium')}>
        {item.label}
      </span>
    </button>
  );
}

export default BottomNav;
