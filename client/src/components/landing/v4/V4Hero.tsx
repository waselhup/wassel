import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import V4FloatingCards from './V4FloatingCards';

export default function V4Hero() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const fontFamily = isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif';

  return (
    <section
      className="v4-hero-section"
      style={{
        position: 'relative',
        padding: '4rem 1.25rem 2rem',
        textAlign: 'center',
        overflow: 'hidden',
        fontFamily,
      }}
    >
      <div style={{ position: 'relative', zIndex: 3, maxWidth: 900, margin: '0 auto' }}>
        <h1
          style={{
            fontFamily,
            fontSize: 'clamp(2rem, 5.5vw, 4rem)',
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: '-0.025em',
            marginBottom: '1rem',
            color: 'var(--v4-text)',
          }}
        >
          {t('landing_v4.hero.title')}
        </h1>
        <p
          style={{
            fontFamily,
            fontSize: 'clamp(0.95rem, 2vw, 1rem)',
            color: 'var(--v4-text-dim)',
            marginBottom: '2rem',
            padding: '0 0.5rem',
          }}
        >
          {t('landing_v4.hero.subtitle')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/signup"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1.6rem',
              background: 'var(--v4-accent)',
              color: 'var(--v4-text)',
              border: 'none',
              borderRadius: 10,
              fontFamily,
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'all 0.2s',
              minHeight: 48,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--v4-accent-strong)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--v4-accent)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {t('landing_v4.hero.cta_primary')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d={isAr ? 'M19 12H5M12 5l-7 7 7 7' : 'M5 12h14M12 5l7 7-7 7'} />
            </svg>
          </Link>
          <Link
            href="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1.4rem',
              background: 'white',
              border: '1px solid var(--v4-border)',
              borderRadius: 10,
              color: 'var(--v4-text)',
              fontFamily,
              fontWeight: 500,
              fontSize: '0.95rem',
              cursor: 'pointer',
              textDecoration: 'none',
              minHeight: 48,
            }}
          >
            {t('landing_v4.hero.cta_signin')}
          </Link>
        </div>
      </div>

      <V4FloatingCards />
    </section>
  );
}
