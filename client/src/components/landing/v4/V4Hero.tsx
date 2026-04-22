import { useTranslation } from 'react-i18next';
import V4FloatingCards from './V4FloatingCards';

export default function V4Hero() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const fontFamily = isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif';

  return (
    <section
      style={{
        position: 'relative',
        padding: '5rem 2rem 2rem',
        textAlign: 'center',
        overflow: 'hidden',
        fontFamily,
      }}
    >
      <div style={{ position: 'relative', zIndex: 3, maxWidth: 900, margin: '0 auto' }}>
        <h1
          style={{
            fontFamily,
            fontSize: 'clamp(2.5rem, 5.5vw, 4rem)',
            fontWeight: 500,
            lineHeight: 1.1,
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
            fontSize: '1rem',
            color: 'var(--v4-text-dim)',
            marginBottom: '2rem',
          }}
        >
          {t('landing_v4.hero.subtitle')}
        </p>
        <a
          href="#final-cta"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'var(--v4-accent)',
            color: 'var(--v4-text)',
            border: 'none',
            borderRadius: 10,
            fontFamily,
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            textDecoration: 'none',
            transition: 'all 0.2s',
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {t('landing_v4.hero.cta_demo')}
        </a>
      </div>

      <V4FloatingCards />
    </section>
  );
}
