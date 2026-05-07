import { useState } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Globe, Menu, X } from 'lucide-react';
import { WasselLogo } from '../../WasselLogo';

export default function V4Nav() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const fontFamily = '"Thmanyah Sans", system-ui, sans-serif';
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleLang = () => {
    const next = isAr ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <nav
        style={{
          padding: '1rem 1.25rem',
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: 1200,
          margin: '0 auto',
          fontFamily,
          gap: 8,
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontWeight: 700,
            fontSize: '1.1rem',
            letterSpacing: '-0.02em',
            color: 'var(--v4-text)',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <WasselLogo size={28} />
          <span style={{ fontFamily }}>{isAr ? 'وصل' : 'Wassel'}</span>
        </Link>

        {/* Desktop nav */}
        <div
          className="hidden md:flex"
          style={{ gap: '2rem', alignItems: 'center' }}
        >
          <a
            href="#hub"
            style={{ color: 'var(--v4-text-body)', fontSize: '0.9rem', textDecoration: 'none', fontFamily }}
          >
            {t('landing_v4.nav.product')}
          </a>
          <Link
            href="/pricing"
            style={{ color: 'var(--v4-text-body)', fontSize: '0.9rem', textDecoration: 'none', fontFamily }}
          >
            {t('landing_v4.nav.pricing')}
          </Link>
          <Link
            href="/about"
            style={{ color: 'var(--v4-text-body)', fontSize: '0.9rem', textDecoration: 'none', fontFamily }}
          >
            {t('landing_v4.nav.about')}
          </Link>
          <Link
            href="/blog"
            style={{ color: 'var(--v4-text-body)', fontSize: '0.9rem', textDecoration: 'none', fontFamily }}
          >
            {t('landing_v4.nav.blog')}
          </Link>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={toggleLang}
            aria-label="Toggle language"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0.45rem 0.7rem',
              borderRadius: 8,
              border: '1px solid var(--v4-border)',
              background: 'white',
              color: 'var(--v4-text)',
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              letterSpacing: 0.5,
              minHeight: 36,
            }}
          >
            <Globe size={13} />
            {isAr ? 'EN' : 'AR'}
          </button>

          {/* Desktop CTAs */}
          <Link
            href="/login"
            className="hidden md:inline-flex"
            style={{
              padding: '0.5rem 1rem',
              color: 'var(--v4-text)',
              fontSize: '0.85rem',
              fontWeight: 500,
              textDecoration: 'none',
              border: '1px solid var(--v4-border)',
              borderRadius: 8,
              background: 'white',
              fontFamily,
              alignItems: 'center',
              minHeight: 36,
            }}
          >
            {t('landing_v4.nav.login')}
          </Link>

          <Link
            href="/signup"
            className="hidden md:inline-flex"
            style={{
              padding: '0.5rem 1.1rem',
              background: 'var(--v4-accent)',
              color: 'var(--v4-text)',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: 8,
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily,
              transition: 'all 0.15s',
              minHeight: 36,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--v4-accent-strong)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--v4-accent)')}
          >
            {t('landing_v4.nav.free_trial')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d={isAr ? 'M19 12H5M12 5l-7 7 7 7' : 'M5 12h14M12 5l7 7-7 7'} />
            </svg>
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            style={{
              padding: 8,
              background: 'transparent',
              border: '1px solid var(--v4-border)',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--v4-text)',
              minHeight: 36,
              minWidth: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Menu size={18} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div className="mobile-drawer-overlay" onClick={closeDrawer} />
          <div className="mobile-drawer" style={{ fontFamily }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--v4-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Link href="/" onClick={closeDrawer} style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, color: 'var(--v4-text)', textDecoration: 'none' }}>
                <WasselLogo size={26} />
                <span>{isAr ? 'وصل' : 'Wassel'}</span>
              </Link>
              <button onClick={closeDrawer} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--v4-text)' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <a href="#hub" onClick={closeDrawer} style={{ padding: '0.85rem 0.5rem', color: 'var(--v4-text)', fontSize: '0.95rem', textDecoration: 'none', borderRadius: 8 }}>
                {t('landing_v4.nav.product')}
              </a>
              <Link href="/pricing" onClick={closeDrawer} style={{ padding: '0.85rem 0.5rem', color: 'var(--v4-text)', fontSize: '0.95rem', textDecoration: 'none', borderRadius: 8 }}>
                {t('landing_v4.nav.pricing')}
              </Link>
              <Link href="/about" onClick={closeDrawer} style={{ padding: '0.85rem 0.5rem', color: 'var(--v4-text)', fontSize: '0.95rem', textDecoration: 'none', borderRadius: 8 }}>
                {t('landing_v4.nav.about')}
              </Link>
              <Link href="/blog" onClick={closeDrawer} style={{ padding: '0.85rem 0.5rem', color: 'var(--v4-text)', fontSize: '0.95rem', textDecoration: 'none', borderRadius: 8 }}>
                {t('landing_v4.nav.blog')}
              </Link>
            </div>
            <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--v4-border)' }}>
              <Link href="/login" onClick={closeDrawer} style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--v4-text)', border: '1px solid var(--v4-border)', borderRadius: 10, textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t('landing_v4.nav.login')}
              </Link>
              <Link href="/signup" onClick={closeDrawer} style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--v4-text)', background: 'var(--v4-accent)', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t('landing_v4.nav.free_trial')}
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
