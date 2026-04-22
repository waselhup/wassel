import { useTranslation } from 'react-i18next';

export default function V4FloatingCards() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const fontFamily = isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif';

  const labelStyle: React.CSSProperties = { fontFamily };

  return (
    <div className="v4-hero-collage">
      {/* 1: Professional photo */}
      <div className="v4-float-card v4-fc-1">
        <div className="v4-fc-1-img" />
        <div style={{ padding: '0.75rem', fontFamily }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 2 }}>
            {t('landing_v4.floating.card1_name')}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--v4-text-muted)', letterSpacing: '0.05em' }}>
            {t('landing_v4.floating.card1_role')}
          </div>
        </div>
      </div>

      {/* 2: Profile analysis summary */}
      <div className="v4-float-card v4-fc-2" style={labelStyle}>
        <div className="v4-fc-label">{t('landing_v4.floating.card2_label')}</div>
        <div className="v4-fc-title">{t('landing_v4.floating.card2_title')}</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {[1, 2, 3, 4].map((i) => (
            <li
              key={i}
              style={{
                fontSize: '0.7rem',
                color: 'var(--v4-text-body)',
                padding: '0.25rem 0',
                display: 'flex',
                alignItems: 'start',
                gap: '0.4rem',
                lineHeight: 1.4,
              }}
            >
              <span style={{ color: 'var(--v4-text-muted)', flexShrink: 0 }}>•</span>
              {t(`landing_v4.floating.card2_line${i}`)}
            </li>
          ))}
        </ul>
      </div>

      {/* 3: CV preview */}
      <div className="v4-float-card v4-fc-3" style={labelStyle}>
        <div className="v4-fc-3-header" />
        <div style={{ padding: '0.9rem' }}>
          <div className="v4-fc-label">{t('landing_v4.floating.card3_label')}</div>
          <div className="v4-fc-title">{t('landing_v4.floating.card3_title')}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--v4-text-muted)', marginTop: '0.3rem' }}>
            {t('landing_v4.floating.card3_score')}
          </div>
        </div>
      </div>

      {/* 4: Posts workflow */}
      <div className="v4-float-card v4-fc-4" style={labelStyle}>
        <div className="v4-fc-label">{t('landing_v4.floating.card4_label')}</div>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, marginBottom: '0.4rem' }}>
          {t('landing_v4.floating.card4_title')}
        </div>
        <div
          style={{
            padding: '0.4rem 0.75rem',
            background: 'var(--v4-text)',
            color: 'white',
            borderRadius: 6,
            fontSize: '0.7rem',
            fontWeight: 500,
            textAlign: 'center',
            display: 'inline-block',
          }}
        >
          ▶ {t('landing_v4.floating.card4_cta')}
        </div>
        <div style={{ marginTop: '0.6rem' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                padding: '0.4rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.72rem',
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  background: 'white',
                  border: '1px solid var(--v4-border)',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  color: 'var(--v4-text-dim)',
                  flexShrink: 0,
                }}
              >
                {i}
              </span>
              {t(`landing_v4.floating.card4_step${i}`)}
            </div>
          ))}
        </div>
      </div>

      {/* 5: Campaign progress */}
      <div className="v4-float-card v4-fc-5" style={labelStyle}>
        <div className="v4-fc-label">{t('landing_v4.floating.card5_label')}</div>
        <div className="v4-fc-title">{t('landing_v4.floating.card5_title')}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--v4-text-muted)' }}>
          {t('landing_v4.floating.card5_meta')}
        </div>
        <div style={{ height: 6, background: 'var(--v4-bg-off)', borderRadius: 3, marginTop: '0.5rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '70%', background: 'var(--v4-accent-strong)', borderRadius: 3 }} />
        </div>
      </div>

      {/* 6: Prospects pipeline */}
      <div className="v4-float-card v4-fc-6" style={labelStyle}>
        <div className="v4-fc-label">{t('landing_v4.floating.card6_label')}</div>
        <div className="v4-fc-title" style={{ marginBottom: '0.4rem' }}>
          {t('landing_v4.floating.card6_title')}
        </div>
        {[
          { p: 'card6_p1', s: 'card6_s1', color: 'linear-gradient(135deg, var(--v4-card-blue), var(--v4-card-purple))' },
          { p: 'card6_p2', s: 'card6_s2', color: 'linear-gradient(135deg, var(--v4-accent-strong), #14b8a6)' },
          { p: 'card6_p3', s: 'card6_s3', color: 'linear-gradient(135deg, var(--v4-card-pink), var(--v4-card-orange))' },
        ].map((row, i, arr) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.35rem 0',
              fontSize: '0.72rem',
              borderBottom: i < arr.length - 1 ? '1px solid var(--v4-border-soft)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: row.color,
                  border: '1.5px solid white',
                }}
              />
              {t(`landing_v4.floating.${row.p}`)}
            </div>
            <div style={{ color: 'var(--v4-text-muted)' }}>{t(`landing_v4.floating.${row.s}`)}</div>
          </div>
        ))}
      </div>

      {/* 7: Profile Radar */}
      <div className="v4-float-card v4-fc-7" style={labelStyle}>
        <div style={{ padding: '0.85rem' }}>
          <div className="v4-fc-label">{t('landing_v4.floating.card7_label')}</div>
          <div className="v4-fc-title" style={{ marginBottom: '0.3rem' }}>
            {t('landing_v4.floating.card7_title')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex' }}>
              {['var(--v4-card-blue)', 'var(--v4-card-pink)', 'var(--v4-accent-strong)'].map((c, i) => (
                <div
                  key={i}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: '2px solid white',
                    background: c,
                    marginInlineStart: i === 0 ? 0 : -6,
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: '0.65rem', color: 'var(--v4-text-muted)' }}>
              {t('landing_v4.floating.card7_meta')}
            </span>
          </div>
        </div>
      </div>

      {/* 8: Announcement */}
      <div className="v4-float-card v4-fc-8" style={labelStyle}>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              background: 'var(--v4-accent-strong)',
              borderRadius: '50%',
              marginInlineEnd: '0.4rem',
            }}
          />
          {t('landing_v4.floating.card8_badge')}
        </div>
        <div className="v4-fc-title" style={{ marginTop: '0.4rem' }}>
          {t('landing_v4.floating.card8_title')}
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--v4-text-body)', lineHeight: 1.5, marginTop: '0.4rem' }}>
          {t('landing_v4.floating.card8_body')}
        </div>
      </div>

      {/* 9: PDF export */}
      <div className="v4-float-card v4-fc-9" style={labelStyle}>
        <div
          style={{
            width: 32,
            height: 40,
            background: 'white',
            border: '1px solid var(--v4-border)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.55rem',
            fontWeight: 700,
            color: 'var(--v4-text-muted)',
            flexShrink: 0,
          }}
        >
          PDF
        </div>
        <div>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.2, marginBottom: '0.15rem' }}>
            {t('landing_v4.floating.card9_title')}
          </h4>
          <p style={{ fontSize: '0.65rem', color: 'var(--v4-text-muted)' }}>
            {t('landing_v4.floating.card9_meta')}
          </p>
        </div>
      </div>
    </div>
  );
}
