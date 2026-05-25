import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { User as UserIcon, Megaphone, Wallet } from 'lucide-react';

const ADMIN_EMAILS = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];

type PersonaKey = 'user' | 'marketing' | 'finance';

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
];

function detectActive(location: string): PersonaKey {
  if (location.startsWith('/v2/marketing') || location.startsWith('/v2/admin')) return 'marketing';
  if (location.startsWith('/v2/finance')) return 'finance';
  return 'user';
}

/**
 * Floating cluster of 3 persona avatars in the top corner. Only renders
 * for admin emails. Mount inside DashboardLayout AND PortalLayout so it
 * persists across both shells.
 */
export default function PersonaSwitcher() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [location] = useLocation();
  const [hover, setHover] = useState<PersonaKey | null>(null);

  if (!ADMIN_EMAILS.includes(user?.email || '')) return null;

  const active = detectActive(location);

  return (
    <div
      style={{
        position: 'fixed',
        top: 14,
        insetInlineStart: 14,
        zIndex: 50,
        display: 'inline-flex',
        gap: 6,
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: 5,
        borderRadius: 999,
        border: '1px solid var(--wsl-border, #E5E7EB)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      }}
    >
      {PERSONAS.map((p) => {
        const isActive = active === p.key;
        const isHover = hover === p.key;
        const { Icon } = p;
        return (
          <Link key={p.key} href={p.href}>
            <a
              onMouseEnter={() => setHover(p.key)}
              onMouseLeave={() => setHover(null)}
              aria-label={t(p.tooltipKey)}
              style={{
                position: 'relative',
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
                border: `2px solid ${isActive ? p.color : 'rgba(0,0,0,0.06)'}`,
                cursor: 'pointer',
                opacity: isActive ? 1 : 0.7,
                transition: 'all 150ms ease',
                textDecoration: 'none',
              }}
            >
              <motion.div
                initial={false}
                animate={{ scale: isHover ? 1.08 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                }}
              >
                <Icon size={16} color={isActive ? p.color : '#6B7280'} strokeWidth={2.5} />
              </motion.div>

              {/* Active dot indicator */}
              {isActive && (
                <motion.span
                  layoutId="persona-active-dot"
                  style={{
                    position: 'absolute',
                    bottom: -10,
                    insetInlineStart: '50%',
                    marginInlineStart: -3,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: p.color,
                    boxShadow: `0 0 0 3px ${p.color}33`,
                  }}
                />
              )}

              {/* Tooltip */}
              {isHover && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 14px)',
                    insetInlineStart: '50%',
                    transform: 'translateX(-50%)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: '#0F172A',
                    color: '#fff',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                    fontWeight: 700,
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  }}
                >
                  {t(p.tooltipKey)}
                </motion.div>
              )}
            </a>
          </Link>
        );
      })}
    </div>
  );
}
