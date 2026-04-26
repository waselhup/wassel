import { useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { useLocation } from 'wouter';
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

const PLAN_LABELS: Record<string, string> = {
  free: 'الخطة المجانية',
  starter: 'خطة البداية',
  pro: 'الخطة الاحترافية',
  elite: 'خطة إيليت',
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const resolvedName = nameProp ?? firstNameOf(profile?.full_name, profile?.email ?? user?.email) ?? '';
  const resolvedPlan = planProp ?? PLAN_LABELS[profile?.plan ?? 'free'] ?? 'الخطة المجانية';
  const avatarUrl = profile?.avatar_url ?? null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/v2', { replace: true });
  };

  const defaultItems: UserMenuItem[] = items ?? [
    { id: 'profile',  label: 'الملف الشخصي', href: '/v2/me' },
    { id: 'settings', label: 'الإعدادات',    href: '/v2/me' },
    { id: 'logout',   label: 'تسجيل الخروج',  onSelect: handleSignOut, destructive: true },
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
        aria-label={`قائمة الحساب — ${resolvedName}`}
        className={cn(
          'flex items-center gap-1.5 h-9 ps-1 pe-2 rounded-v2-pill cursor-pointer',
          'border border-transparent hover:bg-v2-canvas-2 transition-colors duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
          open && 'bg-v2-canvas-2 border-v2-line',
        )}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-7 w-7 rounded-full object-cover"
            aria-hidden="true"
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
          aria-label="قائمة الحساب"
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
