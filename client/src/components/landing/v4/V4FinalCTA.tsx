import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';

export default function V4FinalCTA() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const fontFamily = '"Thmanyah Sans", system-ui, sans-serif';
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (trimmed) {
      navigate(`/signup?email=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/signup');
    }
  };

  return (
    <section
      id="final-cta"
      className="v4-reveal v4-section-mobile"
      style={{
        textAlign: 'center',
        padding: '6rem 1.25rem 4rem',
        position: 'relative',
        fontFamily,
      }}
    >
      <div>
        <h2
          style={{
            fontFamily,
            fontSize: 'clamp(2rem, 4.5vw, 3rem)',
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            marginBottom: '0.75rem',
            maxWidth: 600,
            marginLeft: 'auto',
            marginRight: 'auto',
            color: 'var(--v4-text)',
          }}
        >
          {t('landing_v4.final_cta.title')}
        </h2>
        <p style={{ color: 'var(--v4-text-dim)', fontSize: '0.95rem', marginBottom: '2rem', fontFamily }}>
          {t('landing_v4.final_cta.desc')}
        </p>

        <form
          onSubmit={onSubmit}
          style={{
            display: 'flex',
            maxWidth: 500,
            margin: '0 auto 1rem',
            background: 'white',
            border: '1px solid var(--v4-border)',
            borderRadius: 10,
            overflow: 'hidden',
            padding: '0.25rem',
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('landing_v4.final_cta.placeholder')}
            style={{
              flex: 1,
              padding: '0.6rem 0.9rem',
              border: 'none',
              outline: 'none',
              fontFamily,
              fontSize: '0.9rem',
              color: 'var(--v4-text)',
              background: 'transparent',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.55rem 1.3rem',
              background: 'var(--v4-accent)',
              color: 'var(--v4-text)',
              border: 'none',
              borderRadius: 8,
              fontFamily,
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            {t('landing_v4.final_cta.build')}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d={isAr ? 'M19 12H5M12 5l-7 7 7 7' : 'M5 12h14M12 5l7 7-7 7'} />
            </svg>
          </button>
        </form>

        <p style={{ color: 'var(--v4-text-muted)', fontSize: '0.8rem', marginTop: '0.5rem', fontFamily }}>
          {t('landing_v4.final_cta.hint')}
        </p>
      </div>
    </section>
  );
}
