import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { User as UserIcon, Megaphone, Wallet, Activity } from 'lucide-react';

const ADMIN_EMAILS = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];

type PersonaKey = 'user' | 'marketing' | 'finance' | 'ops';

interface Persona {
  key: PersonaKey;
  href: string;
  color: string;
  Icon: any;
  tooltipKey: string;
}

const PERSONAS: Persona[] = [
  { key: 'user', href: '/v2/home', color: '#14b8a6', Icon: UserIcon, tooltipKey: 'personaSwitcher.user' },
  { key: 'marketing', href: '/v2/marketing', color: '#8B5CF6', Icon: Megaphone, tooltipKey: 'personaSwitcher.marketing' },
  { key: 'finance', href: '/v2/finance', color: '#D4AF37', Icon: Wallet, tooltipKey: 'personaSwitcher.finance' },
  { key: 'ops', href: '/v2/ops', color: '#0EA5E9', Icon: Activity, tooltipKey: 'personaSwitcher.ops' },
];

function detectActive(location: string): PersonaKey {
  if (location.startsWith('/v2/marketing') || location.startsWith('/v2/admin')) return 'marketing';
  if (location.startsWith('/v2/finance')) return 'finance';
  if (location.startsWith('/v2/ops')) return 'ops';
  return 'user';
}

/**
 * Floating bottom-right persona FAB. Collapsed: shows the current persona
 * (color + icon) as a 48px circle. Expanded: 4 personas slide up in a
 * vertical column inside a white card. Auto-collapses 3s after pointer
 * leaves OR on persona selection. Admin-only.
 */
export default function PersonaSwitcher() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!ADMIN_EMAILS.includes(user?.email || '')) return null;

  const active = detectActive(location);
  const activePersona = PERSONAS.find((p) => p.key === active) || PERSONAS[0];

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 3000);
  }
  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  useEffect(() => () => cancelClose(), []);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 92, // leave room above FeedbackFAB (which sits at bottom: 24)
        insetInlineEnd: 24,
        zIndex: 90,
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      {/* Expanded cluster */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              padding: 8,
              display: 'inline-flex',
              flexDirection: 'column',
              gap: 6,
              border: '1px solid var(--border-subtle, #E5E7EB)',
              boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)',
            }}
          >
            {PERSONAS.map((p) => {
              const isActive = active === p.key;
              const { Icon } = p;
              return (
                <Link key={p.key} href={p.href}>
                  <a
                    onClick={() => setOpen(false)}
                    aria-label={t(p.tooltipKey)}
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 12px 6px 6px',
                      borderRadius: 999,
                      background: isActive ? p.color + '12' : 'transparent',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = '#F9FAFB';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <motion.span
                      whileHover={{ scale: 1.06 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: '#fff',
                        border: `2px solid ${isActive ? p.color : 'rgba(0,0,0,0.08)'}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} color={isActive ? p.color : '#6B7280'} strokeWidth={2.5} />
                    </motion.span>
                    <span
                      style={{
                        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                        fontWeight: 800,
                        fontSize: 12,
                        color: isActive ? p.color : 'var(--wsl-ink-2, #374151)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t(p.tooltipKey)}
                    </span>
                    {isActive && (
                      <motion.span
                        layoutId="persona-fab-active-dot"
                        style={{
                          marginInlineStart: 4,
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: p.color,
                          boxShadow: `0 0 0 3px ${p.color}33`,
                        }}
                      />
                    )}
                  </a>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed trigger */}
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={t(activePersona.tooltipKey)}
        aria-expanded={open}
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          border: 'none',
          cursor: 'pointer',
          background: `linear-gradient(135deg, ${activePersona.color}, ${activePersona.color}cc)`,
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 8px 22px ${activePersona.color}55`,
        }}
      >
        <activePersona.Icon size={20} strokeWidth={2.4} />
      </motion.button>
    </div>
  );
}
