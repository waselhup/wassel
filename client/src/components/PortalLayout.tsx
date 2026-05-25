import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowLeft, Globe, type LucideIcon } from 'lucide-react';
import PersonaSwitcher from './PersonaSwitcher';

export interface PortalLayoutProps {
  persona: 'marketing' | 'finance';
  title: string;
  accentColor: string;
  Icon: LucideIcon;
  children: React.ReactNode;
}

/**
 * Full-screen portal shell used by Marketing + Finance portals. Strips the
 * user-app sidebar/nav and shows a slim top bar with PersonaSwitcher (left),
 * portal title (center), and Back-to-User button (right). The right rail
 * the user dashboard shows (plan/tokens/avatar) is intentionally absent —
 * portals are founder-mode screens, not user screens.
 */
export default function PortalLayout({
  persona: _persona,
  title,
  accentColor,
  Icon,
  children,
}: PortalLayoutProps) {
  const { t, i18n } = useTranslation();
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
      <PersonaSwitcher />

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--wsl-border, #E5E7EB)',
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: '0 auto',
            padding: '14px 24px 14px 80px', // 80px left padding clears persona switcher
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Title block (center-left after the persona switcher) */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Icon size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 900,
                  fontSize: 18,
                  margin: 0,
                  color: 'var(--wsl-ink, #0F172A)',
                  lineHeight: 1.2,
                }}
              >
                {title}
              </h1>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: accentColor,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginTop: 2,
                }}
              >
                {t('portal.adminBadge')}
              </div>
            </div>
          </motion.div>

          {/* Right actions */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={toggleLang}
              aria-label="toggle-language"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                border: '1px solid var(--wsl-border, #E5E7EB)',
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
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
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
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <ArrowLeft size={12} style={{ transform: isAr ? 'scaleX(-1)' : undefined }} />
                {t('portal.backToUser')}
              </a>
            </Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 64px' }}>
        {children}
      </main>
    </div>
  );
}
