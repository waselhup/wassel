import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import {
  Home, MessagesSquare, LayoutDashboard, Wallet, MoreHorizontal,
  Megaphone, Activity, HeartHandshake, TrendingUp, Microscope, ShieldCheck, X, User as UserIcon, Sparkles,
} from 'lucide-react';

const ADMIN_EMAILS = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];

export function isAdminEmail(email?: string | null): boolean {
  return ADMIN_EMAILS.includes(email || '');
}

type NavItem = {
  key: string;
  href: string;
  labelKey: string;
  Icon: any;
  color: string;
  match?: (loc: string) => boolean;
};

const PRIMARY_ITEMS: NavItem[] = [
  { key: 'home',      href: '/v2/home',      labelKey: 'adminNav.home',      Icon: Home,            color: '#14b8a6', match: (l) => l === '/v2/home' || l === '/v2' || l.startsWith('/v2/home') },
  { key: 'war_room',  href: '/v2/war-room',  labelKey: 'adminNav.warRoom',   Icon: MessagesSquare,  color: '#0F172A', match: (l) => l.startsWith('/v2/war-room') },
  { key: 'workforce', href: '/v2/workforce', labelKey: 'adminNav.workforce', Icon: LayoutDashboard, color: '#8B5CF6', match: (l) => l.startsWith('/v2/workforce') },
  { key: 'finance',   href: '/v2/finance',   labelKey: 'adminNav.finance',   Icon: Wallet,          color: '#D4AF37', match: (l) => l.startsWith('/v2/finance') },
];

const OVERFLOW_ITEMS: NavItem[] = [
  { key: 'ops',              href: '/v2/ops',              labelKey: 'personaSwitcher.ops',              Icon: Activity,       color: '#0EA5E9', match: (l) => l.startsWith('/v2/ops') },
  { key: 'growth',           href: '/v2/growth',           labelKey: 'personaSwitcher.growth',           Icon: Megaphone,      color: '#10B981', match: (l) => l.startsWith('/v2/growth') },
  { key: 'customer_success', href: '/v2/customer-success', labelKey: 'personaSwitcher.customer_success', Icon: HeartHandshake, color: '#F59E0B', match: (l) => l.startsWith('/v2/customer-success') },
  { key: 'revenue_lab',      href: '/v2/revenue-lab',      labelKey: 'personaSwitcher.revenue_lab',      Icon: TrendingUp,     color: '#EF4444', match: (l) => l.startsWith('/v2/revenue-lab') },
  { key: 'product_intel',    href: '/v2/product-intel',    labelKey: 'personaSwitcher.product_intel',    Icon: Microscope,     color: '#EC4899', match: (l) => l.startsWith('/v2/product-intel') },
  { key: 'compliance',       href: '/v2/compliance',       labelKey: 'personaSwitcher.compliance',       Icon: ShieldCheck,    color: '#6366F1', match: (l) => l.startsWith('/v2/compliance') },
  { key: 'beta',             href: '/v2/beta',             labelKey: 'personaSwitcher.beta',             Icon: Sparkles,       color: '#A855F7', match: (l) => l.startsWith('/v2/beta') },
];

// When opened from the USER app, also include "User" so Ali can identify where he started.
const USER_ITEM: NavItem = {
  key: 'user', href: '/v2/home', labelKey: 'personaSwitcher.user', Icon: UserIcon, color: '#14b8a6',
  match: (l) => l === '/v2/home' || l === '/v2' || l.startsWith('/v2/home'),
};

export interface AdminBottomSheetProps {
  open: boolean;
  onClose: () => void;
  /**
   * 'full' — show ALL admin destinations (used from user app, no other admin nav present).
   * 'overflow' — show only the 6 overflow personas (used from admin portal where 4 primaries are in nav).
   */
  mode?: 'full' | 'overflow';
}

/**
 * AdminBottomSheet — slide-up modal showing admin destinations.
 * Reusable from AdminMobileNav (portal pages) and BottomNav (user pages).
 */
export function AdminBottomSheet({ open, onClose, mode = 'overflow' }: AdminBottomSheetProps) {
  const { t } = useTranslation();
  const [location] = useLocation();

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on route change
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const items: NavItem[] =
    mode === 'full'
      ? [USER_ITEM, ...PRIMARY_ITEMS.filter((p) => p.key !== 'home'), ...OVERFLOW_ITEMS]
      : OVERFLOW_ITEMS;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="lg:hidden fixed inset-0 z-50 bg-black/50"
            aria-hidden
          />
          {/* Sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('adminNav.morePortals')}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-2xl"
            style={{
              paddingBottom: 'env(safe-area-inset-bottom, 16px)',
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <span className="block h-1 w-10 rounded-full bg-gray-300" aria-hidden />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <h2
                style={{
                  fontWeight: 900,
                  fontSize: 16,
                  margin: 0,
                  color: 'var(--wsl-ink, #0F172A)',
                }}
              >
                {mode === 'full' ? t('adminNav.adminTitle') : t('adminNav.morePortals')}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close', 'Close')}
                className="flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
                style={{ width: 36, height: 36, border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pb-6 grid grid-cols-2 gap-3">
              {items.map((item) => {
                const Icon = item.Icon;
                const active = item.match?.(location) ?? false;
                return (
                  <Link key={item.key} href={item.href}>
                    <a
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className="flex items-center gap-3 rounded-2xl"
                      style={{
                        minHeight: 64,
                        padding: '12px 14px',
                        background: active ? `${item.color}14` : '#F9FAFB',
                        border: `1px solid ${active ? `${item.color}44` : 'transparent'}`,
                        textDecoration: 'none',
                        color: 'var(--wsl-ink, #0F172A)',
                      }}
                    >
                      <span
                        className="flex items-center justify-center rounded-full flex-shrink-0"
                        style={{
                          width: 40,
                          height: 40,
                          background: active ? item.color : '#fff',
                          border: `2px solid ${active ? item.color : 'rgba(0,0,0,0.08)'}`,
                          color: active ? '#fff' : '#6B7280',
                        }}
                      >
                        <Icon size={18} strokeWidth={2.4} />
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: active ? item.color : 'var(--wsl-ink, #0F172A)',
                          lineHeight: 1.2,
                        }}
                      >
                        {t(item.labelKey)}
                      </span>
                    </a>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * AdminMobileNav — bottom-fixed navigation visible on mobile (< lg).
 * Mounted by PortalLayout (admin portals). Admin-only.
 * 5 destinations + "More" bottom-sheet (overflow personas).
 */
export default function AdminMobileNav() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!isAdminEmail(user?.email)) return null;

  // Active item among primary + overflow
  const isPrimaryActive = PRIMARY_ITEMS.some((p) => p.match?.(location));
  const overflowActive = !isPrimaryActive && OVERFLOW_ITEMS.find((p) => p.match?.(location));

  return (
    <>
      <nav
        aria-label="admin mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        }}
      >
        <div className="flex items-stretch justify-around h-16 px-1">
          {PRIMARY_ITEMS.map((item) => {
            const active = item.match?.(location) ?? false;
            const Icon = item.Icon;
            return (
              <Link key={item.key} href={item.href}>
                <a
                  aria-label={t(item.labelKey)}
                  aria-current={active ? 'page' : undefined}
                  className="relative flex flex-col items-center justify-center flex-1 min-w-0"
                  style={{
                    minHeight: 44,
                    textDecoration: 'none',
                    color: active ? item.color : '#6B7280',
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="admin-mobile-nav-indicator"
                      aria-hidden
                      className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full"
                      style={{ background: item.color }}
                    />
                  )}
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: active ? 800 : 600,
                      marginTop: 3,
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                  >
                    {t(item.labelKey)}
                  </span>
                </a>
              </Link>
            );
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label={t('adminNav.more')}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className="relative flex flex-col items-center justify-center flex-1 min-w-0 bg-transparent border-0 cursor-pointer"
            style={{
              minHeight: 44,
              color: overflowActive ? (overflowActive as NavItem).color : '#6B7280',
              fontFamily: 'inherit',
            }}
          >
            {overflowActive && (
              <span
                aria-hidden
                className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full"
                style={{ background: (overflowActive as NavItem).color }}
              />
            )}
            <MoreHorizontal size={22} strokeWidth={overflowActive ? 2.4 : 2} />
            <span
              style={{
                fontSize: 10,
                fontWeight: overflowActive ? 800 : 600,
                marginTop: 3,
                lineHeight: 1,
              }}
            >
              {t('adminNav.more')}
            </span>
          </button>
        </div>
      </nav>

      <AdminBottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} mode="overflow" />
    </>
  );
}
