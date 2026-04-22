import { useTranslation } from 'react-i18next';

export default function V4FitsSection() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const fontFamily = isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif';

  const stacks = [
    { cls: 's1', icon: '📊', labelKey: 'stack_analytics' },
    { cls: 's2', icon: '📁', labelKey: 'stack_campaigns' },
    { cls: 's3', icon: '🎯', labelKey: 'stack_profile' },
    { cls: 's4', icon: '📄', labelKey: 'stack_cv' },
    { cls: 's5', icon: '✏️', labelKey: 'stack_posts' },
  ];

  return (
    <section style={{ position: 'relative', padding: '6rem 2rem', zIndex: 5, fontFamily }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '5rem',
            alignItems: 'center',
            maxWidth: 1000,
            margin: '0 auto',
          }}
          className="v4-fits-wrap"
        >
          <div className="v4-fits-visual v4-reveal" style={{ position: 'relative', height: 260 }}>
            {stacks.map((s) => (
              <div key={s.cls} className={`v4-card-stack ${s.cls}`} style={{ fontFamily }}>
                <span style={{ color: 'var(--v4-text-muted)', fontSize: '0.8rem' }}>{s.icon}</span>
                {t(`landing_v4.fits.${s.labelKey}`)}
              </div>
            ))}
          </div>

          <div className="v4-reveal">
            <h3
              style={{
                fontFamily,
                fontSize: '1.5rem',
                fontWeight: 500,
                marginBottom: '1rem',
                letterSpacing: '-0.01em',
              }}
            >
              {t('landing_v4.fits.title')}
            </h3>
            <p style={{ fontFamily, color: 'var(--v4-text-body)', fontSize: '0.95rem', marginBottom: '1rem', lineHeight: 1.6 }}>
              {t('landing_v4.fits.desc1')}
            </p>
            <p style={{ fontFamily, color: 'var(--v4-text-body)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              {t('landing_v4.fits.desc2')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
