import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { WasselLogo } from '../../WasselLogo';

export default function V4Footer() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const fontFamily = isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif';

  const linkStyle: React.CSSProperties = {
    color: 'var(--v4-text-body)',
    textDecoration: 'none',
    fontSize: '0.85rem',
    fontFamily,
  };

  return (
    <footer
      style={{
        padding: '4rem 2rem 2rem',
        borderTop: '1px solid var(--v4-border)',
        background: 'white',
        fontFamily,
      }}
    >
      {/* Top: copyright + badges */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '3rem',
          flexWrap: 'wrap',
          gap: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <WasselLogo size={28} />
          <div style={{ fontSize: '0.8rem', color: 'var(--v4-text-dim)', fontFamily }}>
            {t('landing_v4.footer.copyright')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            ['badge_forbes_1', 'badge_forbes_2'],
            ['badge_ph_1', 'badge_ph_2'],
            ['badge_g2_1', 'badge_g2_2'],
          ].map(([a, b]) => (
            <div
              key={a}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--v4-text-dim)' }}
            >
              <span style={{ fontWeight: 700, color: 'var(--v4-text)', fontSize: '0.85rem' }}>
                {t(`landing_v4.footer.${a}`)}
              </span>
              <span style={{ lineHeight: 1.3 }}>{t(`landing_v4.footer.${b}`)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Columns grid */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          paddingTop: '2rem',
          borderTop: '1px solid var(--v4-border-soft)',
          display: 'grid',
          gridTemplateColumns: '1fr repeat(4, 1fr)',
          gap: '2rem',
        }}
        className="v4-footer-grid"
      >
        <div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            {['𝕏', 'in', '▶'].map((s, i) => (
              <a
                key={i}
                href="#"
                style={{
                  width: 28,
                  height: 28,
                  border: '1px solid var(--v4-border)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--v4-text-body)',
                  textDecoration: 'none',
                  fontSize: '0.75rem',
                }}
              >
                {s}
              </a>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <Link href="/terms" style={{ ...linkStyle, fontSize: '0.8rem', color: 'var(--v4-text-dim)' }}>
              {t('landing_v4.footer.legal_terms')}
            </Link>
            <Link href="/privacy" style={{ ...linkStyle, fontSize: '0.8rem', color: 'var(--v4-text-dim)' }}>
              {t('landing_v4.footer.legal_privacy')}
            </Link>
          </div>
        </div>

        <FooterCol
          title={t('landing_v4.footer.col_account')}
          links={[
            { to: '/login', label: t('landing_v4.footer.account_login') },
            { to: '/signup', label: t('landing_v4.footer.account_signup') },
          ]}
          fontFamily={fontFamily}
        />
        <FooterCol
          title={t('landing_v4.footer.col_product')}
          links={[
            { to: '/app/profile-analysis', label: t('landing_v4.footer.product_profile') },
            { to: '/app/cv', label: t('landing_v4.footer.product_cv') },
            { to: '/app/posts', label: t('landing_v4.footer.product_posts') },
            { to: '/app/campaigns', label: t('landing_v4.footer.product_campaigns') },
            { to: '/pricing', label: t('landing_v4.footer.product_pricing') },
          ]}
          fontFamily={fontFamily}
        />
        <FooterCol
          title={t('landing_v4.footer.col_resources')}
          links={[
            { to: '#final-cta', label: t('landing_v4.footer.resources_demo'), external: true },
            { to: '/blog', label: t('landing_v4.footer.resources_blog') },
            { to: '#', label: t('landing_v4.footer.resources_help'), external: true },
            { to: '#', label: t('landing_v4.footer.resources_templates'), external: true },
            { to: '#', label: t('landing_v4.footer.resources_status'), external: true },
          ]}
          fontFamily={fontFamily}
        />
        <FooterCol
          title={t('landing_v4.footer.col_company')}
          links={[
            { to: '/about', label: t('landing_v4.footer.company_about') },
            { to: '#', label: t('landing_v4.footer.company_careers'), external: true },
            { to: '#', label: t('landing_v4.footer.company_news'), external: true },
          ]}
          fontFamily={fontFamily}
        />
      </div>
    </footer>
  );
}

interface FooterLink {
  to: string;
  label: string;
  external?: boolean;
}

function FooterCol({
  title,
  links,
  fontFamily,
}: {
  title: string;
  links: FooterLink[];
  fontFamily: string;
}) {
  return (
    <div>
      <h5
        style={{
          fontFamily,
          fontSize: '0.7rem',
          color: 'var(--v4-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '0.9rem',
          fontWeight: 600,
        }}
      >
        {title}
      </h5>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {links.map((l, i) => (
          <li key={i} style={{ padding: '0.2rem 0' }}>
            {l.external ? (
              <a
                href={l.to}
                style={{
                  color: 'var(--v4-text-body)',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontFamily,
                }}
              >
                {l.label}
              </a>
            ) : (
              <Link
                href={l.to}
                style={{
                  color: 'var(--v4-text-body)',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontFamily,
                }}
              >
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
