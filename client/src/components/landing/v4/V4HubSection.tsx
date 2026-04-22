import { useTranslation } from 'react-i18next';

export default function V4HubSection() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const fontFamily = isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif';

  return (
    <section id="hub" style={{ position: 'relative', padding: '6rem 2rem', zIndex: 5, fontFamily }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div
          className="v4-reveal"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4rem',
            maxWidth: 1000,
            margin: '0 auto 4rem',
          }}
        >
          <h2 style={{ fontFamily, fontSize: '2rem', fontWeight: 500, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {t('landing_v4.hub.title')}
          </h2>
          <p style={{ fontFamily, color: 'var(--v4-text-body)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            {t('landing_v4.hub.desc')}
          </p>
        </div>

        {/* Browser mockup */}
        <div
          className="v4-reveal"
          style={{
            maxWidth: 900,
            margin: '0 auto',
            background: 'white',
            border: '1px solid var(--v4-border)',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 4px 30px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--v4-border-soft)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'var(--v4-bg-off)',
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--v4-text-faint)' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--v4-text-faint)' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--v4-text-faint)' }} />
          </div>

          <div style={{ padding: '1.5rem 2rem', minHeight: 320 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '1rem',
                borderBottom: '1px solid var(--v4-border-soft)',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--v4-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {t('landing_v4.hub.mockup_workflow')}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '0.25rem' }}>
                  {t('landing_v4.hub.mockup_overview')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--v4-text-body)' }}>
              <div>
                <strong style={{ color: 'var(--v4-text)', fontWeight: 600 }}>{t('landing_v4.hub.mockup_steps')}</strong>
              </div>
              <div style={{ color: 'var(--v4-text-muted)' }}>{t('landing_v4.hub.mockup_duration')}</div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'start' }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg,#fb923c,#ec4899)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                  {t('landing_v4.hub.mockup_card_title')}
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--v4-text-muted)', lineHeight: 1.4 }}>
                  {t('landing_v4.hub.mockup_card_desc')}
                </p>
              </div>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.45rem 0.85rem',
                  background: 'var(--v4-text)',
                  color: 'white',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  fontFamily,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {t('landing_v4.hub.mockup_start')}
              </button>
              <button
                style={{
                  padding: '0.45rem 0.85rem',
                  background: 'white',
                  color: 'var(--v4-text)',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid var(--v4-border)',
                  fontFamily,
                }}
              >
                {t('landing_v4.hub.mockup_preview')}
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0',
                fontSize: '0.7rem',
                color: 'var(--v4-text-muted)',
                borderBottom: '1px solid var(--v4-border-soft)',
              }}
            >
              <span>{t('landing_v4.hub.mockup_tasks')}</span>
              <span>{t('landing_v4.hub.mockup_status')}</span>
            </div>

            {[
              { nameKey: 'mockup_task_intake', metaKey: 'mockup_task_intake_meta', icon: '📋' },
              { nameKey: 'mockup_task_call', metaKey: 'mockup_task_call_meta', icon: '📞' },
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  padding: '0.7rem 0',
                  borderBottom: '1px solid var(--v4-border-soft)',
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
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
                  {row.icon}
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 500, flex: 1 }}>
                  {t(`landing_v4.hub.${row.nameKey}`)}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--v4-text-muted)' }}>
                  {t(`landing_v4.hub.${row.metaKey}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
