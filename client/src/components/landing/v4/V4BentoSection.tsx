import { useTranslation } from 'react-i18next';

export default function V4BentoSection() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const fontFamily = isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif';

  const services = [
    { key: 'profile', icon: '🎯' },
    { key: 'cv', icon: '📄' },
    { key: 'posts', icon: '✏️' },
    { key: 'campaigns', icon: '📊' },
  ];

  const chips = ['chip_soc2', 'chip_gdpr', 'chip_privacy', 'chip_permissions', 'chip_controls', 'chip_sharing'];

  return (
    <section className="v4-section-mobile" style={{ position: 'relative', padding: '6rem 2rem', zIndex: 5, fontFamily }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div
          className="v4-bento-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem',
          }}
        >
          {/* Services (tall) */}
          <div
            className="v4-reveal"
            style={{
              padding: '2rem',
              background: 'var(--v4-bg-off)',
              border: '1px solid var(--v4-border)',
              borderRadius: 16,
              minHeight: 380,
            }}
          >
            <h4 style={{ fontFamily, fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.3rem', letterSpacing: '-0.01em' }}>
              {t('landing_v4.bento.silos_title')}
            </h4>
            <p style={{ fontFamily, color: 'var(--v4-text-body)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {t('landing_v4.bento.silos_sub')}
            </p>

            <div style={{ background: 'white', border: '1px solid var(--v4-border)', borderRadius: 10, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.6rem 0.75rem',
                  borderBottom: '1px solid var(--v4-border-soft)',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                    borderRadius: 5,
                  }}
                />
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--v4-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {t('landing_v4.bento.services_label')}
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('landing_v4.bento.services_head')}</div>
                </div>
              </div>

              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  <div
                    style={{
                      padding: '0.25rem 0.6rem',
                      background: 'var(--v4-bg-off)',
                      border: '1px solid var(--v4-border-soft)',
                      borderRadius: 5,
                      fontSize: '0.7rem',
                      color: 'var(--v4-text-body)',
                    }}
                  >
                    {t('landing_v4.bento.services_all')} ▾
                  </div>
                  <div
                    style={{
                      padding: '0.25rem 0.6rem',
                      background: 'var(--v4-bg-off)',
                      border: '1px solid var(--v4-border-soft)',
                      borderRadius: 5,
                      fontSize: '0.7rem',
                      color: 'var(--v4-text-body)',
                    }}
                  >
                    + {t('landing_v4.bento.services_filter')}
                  </div>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--v4-text-muted)', marginBottom: '0.3rem' }}>
                  {t('landing_v4.bento.services_name')}
                </div>
                {services.map((s) => (
                  <div
                    key={s.key}
                    style={{
                      padding: '0.6rem 0',
                      borderTop: '1px solid var(--v4-border-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        background: 'var(--v4-bg-off)',
                        borderRadius: 5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                      }}
                    >
                      {s.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 500 }}>
                        {t(`landing_v4.bento.services_${s.key}`)}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--v4-text-muted)' }}>
                        {t(`landing_v4.bento.services_${s.key}_meta`)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: fields + compliance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div
              className="v4-reveal"
              style={{
                padding: '2rem',
                background: 'white',
                border: '1px solid var(--v4-border)',
                borderRadius: 16,
              }}
            >
              <h4 style={{ fontFamily, fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.3rem', letterSpacing: '-0.01em' }}>
                {t('landing_v4.bento.measure_title')}
              </h4>
              <p style={{ fontFamily, color: 'var(--v4-text-body)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                {t('landing_v4.bento.measure_sub')}
              </p>

              <div style={{ background: 'white', border: '1px solid var(--v4-border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    {t('landing_v4.bento.measure_head')}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--v4-text-muted)', marginBottom: '0.5rem' }}>
                    {t('landing_v4.bento.measure_help')}
                  </div>
                  <div>
                    {[
                      ['field_description', 'field_description_v'],
                      ['field_role', 'field_role_v'],
                      ['field_email', 'field_email_v'],
                    ].map(([lk, vk]) => (
                      <div
                        key={lk}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.45rem 0.75rem',
                          background: 'var(--v4-bg-off)',
                          borderRadius: 6,
                          marginBottom: '0.35rem',
                          fontSize: '0.72rem',
                        }}
                      >
                        <span style={{ color: 'var(--v4-text-body)' }}>{t(`landing_v4.bento.${lk}`)}</span>
                        <span style={{ color: 'var(--v4-text-muted)', fontSize: '0.65rem' }}>
                          {t(`landing_v4.bento.${vk}`)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="v4-reveal"
              style={{
                padding: '2rem',
                background: 'white',
                border: '1px solid var(--v4-border)',
                borderRadius: 16,
              }}
            >
              <h4 style={{ fontFamily, fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.3rem', letterSpacing: '-0.01em' }}>
                {t('landing_v4.bento.security_title')}
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '1rem' }}>
                {chips.map((c) => (
                  <div
                    key={c}
                    style={{
                      padding: '0.3rem 0.7rem',
                      background: 'white',
                      border: '1px solid var(--v4-border)',
                      borderRadius: 6,
                      fontSize: '0.7rem',
                      color: 'var(--v4-text-body)',
                      fontFamily,
                    }}
                  >
                    {t(`landing_v4.bento.${c}`)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
