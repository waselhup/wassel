import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import { COMPANY_LEGAL_INFO, COPYRIGHT_YEAR } from '@/lib/v2/companyInfo';

interface FooterColumn {
  eyebrowKey: string;
  links: { labelKey: string; href: string }[];
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    eyebrowKey: 'landing.footer.columns.product.eyebrow',
    links: [
      { labelKey: 'landing.footer.columns.product.radar',     href: '/v2/analyze' },
      { labelKey: 'landing.footer.columns.product.studio',    href: '/v2/posts' },
      { labelKey: 'landing.footer.columns.product.cvBuilder', href: '/v2/cvs' },
      { labelKey: 'landing.footer.columns.product.pricing',   href: '/v2/pricing' },
    ],
  },
  {
    eyebrowKey: 'landing.footer.columns.company.eyebrow',
    links: [
      { labelKey: 'landing.footer.columns.company.about',   href: '/v2/about' },
      { labelKey: 'landing.footer.columns.company.contact', href: '/v2/contact' },
    ],
  },
  {
    eyebrowKey: 'landing.footer.columns.legal.eyebrow',
    links: [
      { labelKey: 'landing.footer.columns.legal.terms',   href: '/v2/terms' },
      { labelKey: 'landing.footer.columns.legal.privacy', href: '/v2/privacy' },
      { labelKey: 'landing.footer.columns.legal.refund',  href: '/v2/refund' },
    ],
  },
];

const MOBILE_LINKS = [
  { labelKey: 'landing.footer.mobileLinks.about',   href: '/v2/about' },
  { labelKey: 'landing.footer.mobileLinks.terms',   href: '/v2/terms' },
  { labelKey: 'landing.footer.mobileLinks.privacy', href: '/v2/privacy' },
  { labelKey: 'landing.footer.mobileLinks.refund',  href: '/v2/refund' },
  { labelKey: 'landing.footer.mobileLinks.contact', href: '/v2/contact' },
];

function BrandMark() {
  const { t, i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const brand = isAr ? COMPANY_LEGAL_INFO.brandAr : COMPANY_LEGAL_INFO.brandEn;
  return (
    <span className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="9"   stroke="var(--teal-700)" strokeWidth="1.4" />
        <circle cx="11" cy="11" r="5"   stroke="var(--teal-700)" strokeWidth="1.4" />
        <circle cx="11" cy="11" r="1.4" fill="var(--teal-700)" />
      </svg>
      <span className="font-ar text-[16px] font-bold text-v2-ink">{brand || t('landing.brand')}</span>
    </span>
  );
}

/**
 * Footer used across the public marketing pages (Landing, About, Contact,
 * legal pages). Mobile renders a single dense bar; desktop renders the
 * 4-column layout matching the existing V2 Landing footer.
 */
export default function PublicFooter() {
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const cr = COMPANY_LEGAL_INFO.commercialRegistration;
  const city = isAr ? COMPANY_LEGAL_INFO.city : COMPANY_LEGAL_INFO.cityEn;
  const region = isAr ? COMPANY_LEGAL_INFO.regionAr : COMPANY_LEGAL_INFO.regionEn;
  const country = isAr ? COMPANY_LEGAL_INFO.country : COMPANY_LEGAL_INFO.countryEn;
  const locationSeparator = isAr ? '، ' : ', ';

  return (
    <>
      {/* Mobile: dense single-line bar with link strip */}
      <footer className="border-t border-v2-line pt-5 pb-6 lg:hidden">
        <div className="flex flex-col items-start gap-3 px-1">
          <div className="flex w-full items-center justify-between">
            <Eyebrow>© WASSEL · <NumDisplay>{COPYRIGHT_YEAR}</NumDisplay></Eyebrow>
            {cr && (
              <Eyebrow>{t('landing.footer.commercialRegistrationShort')} · <NumDisplay>{cr}</NumDisplay></Eyebrow>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 font-ar text-[11px] text-v2-dim">
            {MOBILE_LINKS.map((l) => (
              <button
                key={l.href}
                type="button"
                onClick={() => navigate(l.href)}
                className="hover:text-v2-body cursor-pointer transition-colors duration-200 ease-out"
              >
                {t(l.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </footer>

      {/* Desktop: 4-column legal-aware footer */}
      <footer className="hidden border-t border-v2-line lg:block lg:pt-16 lg:pb-10">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-10">
          <div>
            <BrandMark />
            <p className="mt-3 max-w-[280px] font-ar text-[13px] leading-relaxed text-v2-dim">
              {t('landing.footer.tagline')}
            </p>
            <div className="mt-4 space-y-1 font-ar text-[12px] text-v2-dim">
              {cr && (
                <div>
                  <span className="text-v2-mute">{t('landing.footer.commercialRegistrationLabel')} · </span>
                  <NumDisplay className="text-v2-body">{cr}</NumDisplay>
                </div>
              )}
              <div>
                <span className="text-v2-mute">{t('landing.footer.locationLabel')} · </span>
                <span className="text-v2-body">
                  {city}{locationSeparator}{region}{locationSeparator}{country}
                </span>
              </div>
            </div>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.eyebrowKey}>
              <Eyebrow className="mb-3 block">{t(col.eyebrowKey)}</Eyebrow>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {col.links.map((l) => (
                  <li key={l.labelKey}>
                    <button
                      type="button"
                      onClick={() => navigate(l.href)}
                      className="font-ar text-[13px] text-v2-body hover:text-teal-700 cursor-pointer transition-colors duration-200 ease-out"
                    >
                      {t(l.labelKey)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex items-center justify-between border-t border-v2-line pt-6">
          <Eyebrow>© WASSEL · <NumDisplay>{COPYRIGHT_YEAR}</NumDisplay></Eyebrow>
          <span className="font-ar text-[12px] text-v2-dim">{t('landing.footer.designedIn')}</span>
        </div>
      </footer>
    </>
  );
}
