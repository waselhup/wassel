import { useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export interface UserMenuProps extends HTMLAttributes<HTMLDivElement> {
  /** display name shown next to avatar. If omitted, falls back to AuthContext profile/user. */
  name?: string;
  /** plan tier label rendered under the name in the dropdown header. */
  plan?: string;
  /** override default menu items */
  items?: UserMenuItem[];
}

export interface UserMenuItem {
  id: string;
  label: string;
  href?: string;
  onSelect?: () => void;
  /** render with rose tint (e.g. logout) */
  destructive?: boolean;
}

// Mirrors the canonical `plans` table (free / starter / growth / enterprise).
// Legacy pro/elite aliases map to the closest current tier.
const PLAN_LABELS_AR: Record<string, string> = {
  free: 'استكشف',
  starter: 'الانطلاق',
  growth: 'النمو',
  enterprise: 'المؤسسات',
  pro: 'الانطلاق',
  elite: 'النمو',
};

const PLAN_LABELS_EN: Record<string, string> = {
  free: 'Explore',
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
  pro: 'Starter',
  elite: 'Growth',
};

const ChevronDown = (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="M2 3.5 L5 6.5 L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return Array.from(trimmed)[0]!;
}

function firstNameOf(full: string | null | undefined, email: string | null | undefined): string {
  const trimmed = (full ?? '').trim();
  if (trimmed) return trimmed.split(/\s+/)[0]!;
  const local = (email ?? '').split('@')[0];
  return local || '';
}

function UserMenu({
  className,
  name: nameProp,
  plan: planProp,
  items,
  ...rest
}: UserMenuProps) {
  const [, navigate] = useLocation();
  const { user, profile, signOut } = useAuth();
  const { i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const planDict = isAr ? PLAN_LABELS_AR : PLAN_LABELS_EN;
  const resolvedName = nameProp ?? firstNameOf(profile?.full_name, profile?.email ?? user?.email) ?? '';
  const resolvedPlan = planProp ?? planDict[profile?.plan ?? 'free'] ?? planDict.free;
  const avatarUrl = profile?.avatar_url ?? null;
  const [avatarBroken, setAvatarBroken] = useState(false);
  // Reset broken flag whenever the URL changes (e.g. after re-sync from OAuth).
  useEffect(() => { setAvatarBroken(false); }, [avatarUrl]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/v2', { replace: true });
  };

  const defaultItems: UserMenuItem[] = items ?? [
    { id: 'profile',  label: isAr ? 'الملف الشخصي' : 'Profile',  href: '/v2/me' },
    { id: 'settings', label: isAr ? 'الإعدادات'    : 'Settings', href: '/v2/me' },
    { id: 'logout',   label: isAr ? 'تسجيل الخروج'  : 'Sign out', onSelect: handleSignOut, destructive: true },
  ];

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = getInitial(resolvedName);

  const handleSelect = (item: UserMenuItem) => {
    setOpen(false);
    if (item.onSelect) { item.onSelect(); return; }
    if (item.href) navigate(item.href);
  };

  return (
    <div ref={ref} className={cn('relative', className)} {...rest}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${isAr ? 'قائمة الحساب' : 'Account menu'} — ${resolvedName}`}
        className={cn(
          'flex items-center gap-1.5 h-9 ps-1 pe-2 rounded-v2-pill cursor-pointer',
          'border border-transparent hover:bg-v2-canvas-2 transition-colors duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
          open && 'bg-v2-canvas-2 border-v2-line',
        )}
      >
        {avatarUrl && !avatarBroken ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-7 w-7 rounded-full object-cover"
            aria-hidden="true"
            referrerPolicy="no-referrer"
            onError={() => setAvatarBroken(true)}
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 font-ar text-[13px] font-bold text-white"
          >
            {initial}
          </span>
        )}
        <span className="font-ar text-[13px] font-semibold text-v2-ink">{resolvedName}</span>
        <span className="text-v2-mute">{ChevronDown}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={isAr ? 'قائمة الحساب' : 'Account menu'}
          className={cn(
            'absolute top-[calc(100%+8px)] end-0 z-40 min-w-[224px]',
            'rounded-v2-md border border-v2-line bg-v2-surface shadow-lift',
            'overflow-hidden',
          )}
        >
          <div className="border-b border-v2-line px-4 py-3">
            <div className="font-ar text-[14px] font-semibold text-v2-ink">{resolvedName}</div>
            <div className="font-ar text-[12px] text-v2-dim">{resolvedPlan}</div>
          </div>
          <div className="py-1">
            {defaultItems.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(item)}
                className={cn(
                  'w-full text-start px-4 py-2 font-ar text-[13px] cursor-pointer',
                  'transition-colors duration-150 ease-out',
                  'focus-visible:outline-none focus-visible:bg-v2-canvas-2',
                  item.destructive
                    ? 'text-v2-rose hover:bg-v2-rose-50'
                    : 'text-v2-body hover:bg-v2-canvas-2 hover:text-v2-ink',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
