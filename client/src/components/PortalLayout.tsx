import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowLeft, Globe, type LucideIcon } from 'lucide-react';
import PersonaSwitcher from './PersonaSwitcher';
import AdminMobileNav from './AdminMobileNav';
import { WasselLogo } from './WasselLogo';
import UserAvatar from './UserAvatar';
import { useAuth } from '@/contexts/AuthContext';

export interface PortalLayoutProps {
  persona: 'marketing' | 'finance' | 'ops' | 'growth' | 'workforce' | 'customer_success' | 'revenue_lab' | 'product_intel' | 'compliance';
  title: string;
  accentColor: string;
  Icon: LucideIcon;
  children: React.ReactNode;
}

/**
 * Full-screen portal shell used by Marketing, Finance, and Operations
 * portals. Strips the user-app sidebar/nav. Slim header with WasselLogo
 * anchor (left), persona icon + title (center), language toggle +
 * back-to-user + admin avatar (right). PersonaSwitcher is mounted as a
 * floating FAB bottom-right.
 */
export default function PortalLayout({
  persona: _persona,
  title,
  accentColor,
  Icon,
  children,
}: PortalLayoutProps) {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const isAr = i18n.language === 'ar';
  const [, navigate] = useLocation();

  const toggleLang = () => {
    const next = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base, #FAF8F2)',
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(250, 248, 242, 0.92)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${accentColor}33`,
        }}
      >
        <div
          className="mx-auto flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-2.5 sm:py-3.5"
          style={{
            maxWidth: 1400,
            flexWrap: 'wrap',
          }}
        >
          {/* LEFT — Wassel brand anchor + persona title */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 sm:gap-3"
            style={{ minWidth: 0, flexShrink: 1 }}
          >
            <Link href="/v2">
              <a aria-label="Wassel home" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                <WasselLogo size={28} />
              </a>
            </Link>

            <span
              aria-hidden
              className="hidden sm:inline-block"
              style={{
                width: 1,
                height: 26,
                background: 'var(--border-subtle, #E5E7EB)',
                flexShrink: 0,
              }}
            />

            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <Icon size={16} />
            </div>

            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 900,
                  fontSize: 15,
                  margin: 0,
                  color: 'var(--wsl-ink, #0F172A)',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '40vw',
                }}
              >
                {title}
              </h1>
              <div
                className="hidden sm:block"
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: accentColor,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginTop: 2,
                }}
              >
                {t('portal.adminBadge')}
              </div>
            </div>
          </motion.div>

          {/* CENTER — always-visible persona switcher (desktop only, mobile uses bottom nav) */}
          <div className="hidden lg:inline-flex items-center" style={{ flexShrink: 0 }}>
            <PersonaSwitcher variant="inline" />
          </div>

          {/* RIGHT — language toggle, back-to-user, admin avatar */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={toggleLang}
              aria-label="toggle-language"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minWidth: 44,
                minHeight: 36,
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid var(--border-subtle, #E5E7EB)',
                background: '#fff',
                cursor: 'pointer',
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                fontWeight: 800,
                fontSize: 11,
                color: 'var(--wsl-ink-2, #374151)',
              }}
            >
              <Globe size={12} />
              {i18n.language === 'ar' ? 'EN' : 'AR'}
            </button>

            <Link href="/v2/home">
              <a
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/v2/home');
                }}
                aria-label={t('portal.backToUser')}
                className="inline-flex items-center gap-1.5 sm:gap-2"
                style={{
                  minHeight: 36,
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: accentColor,
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 800,
                  fontSize: 12,
                  textDecoration: 'none',
                  boxShadow: `0 4px 12px ${accentColor}40`,
                  transition: 'transform 100ms ease',
                  justifyContent: 'center',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <ArrowLeft size={14} style={{ transform: isAr ? 'scaleX(-1)' : undefined }} />
                <span className="hidden sm:inline">{t('portal.backToUser')}</span>
              </a>
            </Link>

            <UserAvatar
              avatarUrl={profile?.avatar_url}
              name={profile?.full_name}
              email={user?.email}
              size="sm"
            />
          </div>
        </div>

        {/* Persona-accent hairline divider */}
        <div
          aria-hidden
          style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, ${accentColor}88, transparent)`,
          }}
        />
      </header>

      <main
        className="mx-auto px-3 sm:px-6 pt-4 sm:pt-6 portal-main-pb"
        style={{ maxWidth: 1400 }}
      >
        {children}
      </main>

      {/* Mobile bottom navigation (lg:hidden inside component) */}
      <AdminMobileNav />
    </div>
  );
}
