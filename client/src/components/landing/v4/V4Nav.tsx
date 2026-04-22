import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { WasselLogo } from '../../WasselLogo';

export default function V4Nav() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const fontFamily = isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif';

  const toggleLang = () => {
    const next = isAr ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <nav
      style={{
        padding: '1.5rem 2rem',
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: 1200,
        margin: '0 auto',
        fontFamily,
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
        }}
      >
        <WasselLogo size={30} />
        <span style={{ fontFamily }}>{isAr ? 'وصل' : 'Wassel'}</span>
      </Link>

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
        <a
          href="#final-cta"
          style={{ color: 'var(--v4-text-body)', fontSize: '0.9rem', textDecoration: 'none', fontFamily }}
        >
          {t('landing_v4.nav.book_demo')}
        </a>
        <Link
          href="/blog"
          style={{ color: 'var(--v4-text-body)', fontSize: '0.9rem', textDecoration: 'none', fontFamily }}
        >
          {t('landing_v4.nav.blog')}
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          onClick={toggleLang}
          aria-label="Toggle language"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '0.5rem 0.9rem',
            borderRadius: 8,
            border: '1px solid var(--v4-border)',
            background: 'white',
            color: 'var(--v4-text)',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            letterSpacing: 0.5,
          }}
        >
          <Globe size={13} />
          {isAr ? 'EN' : 'AR'}
        </button>

        <Link
          href="/login"
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
          }}
        >
          {t('landing_v4.nav.login')}
        </Link>

        <Link
          href="/signup"
          style={{
            padding: '0.5rem 1.1rem',
            background: 'var(--v4-accent)',
            color: 'var(--v4-text)',
            fontSize: '0.85rem',
            fontWeight: 600,
            textDecoration: 'none',
            borderRadius: 8,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontFamily,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--v4-accent-strong)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--v4-accent)')}
        >
          {t('landing_v4.nav.free_trial')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d={isAr ? 'M19 12H5M12 5l-7 7 7 7' : 'M5 12h14M12 5l7 7-7 7'} />
          </svg>
        </Link>
      </div>
    </nav>
  );
}
