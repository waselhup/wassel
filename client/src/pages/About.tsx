import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { WasselLogo } from '../components/WasselLogo';
import TeamCard from '../components/about/TeamCard';

export default function About() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const font = isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif';

  const eyebrowStyle: React.CSSProperties = {
    display: 'inline-block',
    fontSize: '0.68rem',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontWeight: 600,
    marginBottom: '0.9rem',
    fontFamily: font,
  };

  const sectionHeadingStyle: React.CSSProperties = {
    fontSize: 'clamp(1.65rem, 3vw, 2.1rem)',
    fontWeight: 500,
    letterSpacing: '-0.025em',
    color: 'var(--text)',
    lineHeight: 1.2,
    margin: 0,
    fontFamily: font,
  };

  const sectionSubStyle: React.CSSProperties = {
    fontSize: '1rem',
    color: 'var(--text-dim)',
    lineHeight: 1.6,
    marginTop: '0.6rem',
    fontFamily: font,
  };

  const metaLabelStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontWeight: 600,
    marginBottom: '0.45rem',
    fontFamily: font,
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: font,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Soft concentric circles signature */}
      <div className="v4-bg-circles" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 960,
          margin: '0 auto',
          padding: '3rem 1.5rem 6rem',
        }}
      >
        {/* Top brand lockup */}
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: '3.5rem',
            textDecoration: 'none',
            color: 'var(--text)',
          }}
        >
          <WasselLogo size={28} />
          <span style={{ fontWeight: 600, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
            {isRTL ? 'وصل' : 'Wassel'}
          </span>
        </Link>

        {/* Hero */}
        <section style={{ textAlign: isRTL ? 'right' : 'left', marginBottom: '4rem' }}>
          <span style={eyebrowStyle}>{t('about.eyebrow')}</span>
          <h1
            style={{
              fontSize: 'clamp(2.2rem, 5vw, 3.2rem)',
              fontWeight: 500,
              letterSpacing: '-0.03em',
              color: 'var(--text)',
              lineHeight: 1.1,
              margin: 0,
              fontFamily: font,
            }}
          >
            {t('about.title')}
          </h1>
          <p
            style={{
              fontSize: '1.1rem',
              color: 'var(--text-dim)',
              lineHeight: 1.6,
              maxWidth: 640,
              marginTop: '1rem',
              marginInlineStart: 0,
              fontFamily: font,
            }}
          >
            {t('about.subtitle')}
          </p>
        </section>

        {/* Story */}
        <section
          style={{
            marginBottom: '5rem',
            maxWidth: 720,
          }}
        >
          <p
            style={{
              fontSize: '1.02rem',
              color: 'var(--text-body)',
              lineHeight: 1.85,
              marginBottom: '1.2rem',
              fontFamily: font,
            }}
          >
            {t('about.story_para1')}
          </p>
          <p
            style={{
              fontSize: '1.02rem',
              color: 'var(--text-body)',
              lineHeight: 1.85,
              margin: 0,
              fontFamily: font,
            }}
          >
            {t('about.story_para2')}
          </p>
        </section>

        {/* Team */}
        <section style={{ marginBottom: '5rem' }}>
          <div style={{ marginBottom: '2.25rem' }}>
            <span style={eyebrowStyle}>{t('about.team.eyebrow')}</span>
            <h2 style={sectionHeadingStyle}>{t('about.team.title')}</h2>
            <p style={sectionSubStyle}>{t('about.team.subtitle')}</p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
            }}
          >
            <TeamCard
              photoSrc="/images/team/hassan-almudhi.png"
              photoAlt={t('about.team.hassan.name')}
              name={t('about.team.hassan.name')}
              role={t('about.team.hassan.role')}
              bio={t('about.team.hassan.bio')}
              fontFamily={font}
            />
            <TeamCard
              photoSrc="/images/team/ali-alhashim.jpg"
              photoAlt={t('about.team.ali.name')}
              name={t('about.team.ali.name')}
              role={t('about.team.ali.role')}
              bio={t('about.team.ali.bio')}
              fontFamily={font}
            />
          </div>
        </section>

        {/* Location + Legal */}
        <section
          style={{
            marginBottom: '4.5rem',
            padding: '1.5rem 1.75rem',
            background: 'var(--bg-off)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem',
          }}
        >
          <div>
            <div style={metaLabelStyle}>{t('about.location_label')}</div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text)', fontWeight: 500, lineHeight: 1.5, fontFamily: font }}>
              {t('about.location_value')}
            </div>
          </div>
          <div>
            <div style={metaLabelStyle}>{t('about.legal_label')}</div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text)', fontWeight: 500, lineHeight: 1.5, fontFamily: font }}>
              {t('about.legal_value')}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section
          style={{
            textAlign: 'center',
            padding: '3.5rem 1.5rem',
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 16,
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: 500,
              letterSpacing: '-0.025em',
              color: 'var(--text)',
              lineHeight: 1.25,
              margin: '0 0 1.75rem',
              fontFamily: font,
            }}
          >
            {t('about.cta_title')}
          </h2>
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/signup"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '0.7rem 1.35rem',
                background: 'var(--brand)',
                color: 'white',
                borderRadius: 10,
                fontSize: '0.92rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'background 0.15s ease',
                fontFamily: font,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--brand)')}
            >
              {t('about.cta_primary')}
              {isRTL ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
            </Link>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0.7rem 1.1rem',
                background: 'transparent',
                color: 'var(--text-body)',
                borderRadius: 10,
                fontSize: '0.88rem',
                fontWeight: 500,
                textDecoration: 'none',
                fontFamily: font,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-body)')}
            >
              {t('about.cta_secondary')}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
