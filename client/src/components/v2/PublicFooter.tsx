import { useLocation } from 'wouter';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import { COMPANY_LEGAL_INFO, COPYRIGHT_YEAR } from '@/lib/v2/companyInfo';

interface FooterColumn {
  eyebrow: string;
  links: { label: string; href: string }[];
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    eyebrow: 'المنتج',
    links: [
      { label: 'الرادار',         href: '/v2/analyze' },
      { label: 'الاستوديو',       href: '/v2/posts' },
      { label: 'منشئ السيرة',     href: '/v2/cvs' },
      { label: 'الأسعار',         href: '/v2/pricing' },
    ],
  },
  {
    eyebrow: 'الشركة',
    links: [
      { label: 'من نحن',          href: '/about' },
      { label: 'تواصل معنا',      href: '/contact' },
    ],
  },
  {
    eyebrow: 'القانوني',
    links: [
      { label: 'الشروط',          href: '/terms' },
      { label: 'الخصوصية',         href: '/privacy' },
      { label: 'سياسة الاسترداد',   href: '/refund' },
    ],
  },
];

const MOBILE_LINKS = [
  { label: 'من نحن',           href: '/about' },
  { label: 'الشروط',           href: '/terms' },
  { label: 'الخصوصية',          href: '/privacy' },
  { label: 'الاسترداد',          href: '/refund' },
  { label: 'تواصل',             href: '/contact' },
];

const BrandMark = () => (
  <span className="flex items-center gap-2">
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="9"   stroke="var(--teal-700)" strokeWidth="1.4" />
      <circle cx="11" cy="11" r="5"   stroke="var(--teal-700)" strokeWidth="1.4" />
      <circle cx="11" cy="11" r="1.4" fill="var(--teal-700)" />
    </svg>
    <span className="font-ar text-[16px] font-bold text-v2-ink">{COMPANY_LEGAL_INFO.brandAr}</span>
  </span>
);

/**
 * Footer used across the public marketing pages (Landing, About, Contact,
 * legal pages). Mobile renders a single dense bar; desktop renders the
 * 4-column layout matching the existing V2 Landing footer.
 */
export default function PublicFooter() {
  const [, navigate] = useLocation();
  const cr = COMPANY_LEGAL_INFO.commercialRegistration;

  return (
    <>
      {/* Mobile: dense single-line bar with link strip */}
      <footer className="border-t border-v2-line pt-5 pb-6 lg:hidden">
        <div className="flex flex-col items-start gap-3 px-1">
          <div className="flex w-full items-center justify-between">
            <Eyebrow>© WASSEL · <NumDisplay>{COPYRIGHT_YEAR}</NumDisplay></Eyebrow>
            {cr && (
              <Eyebrow>س.ت · <NumDisplay>{cr}</NumDisplay></Eyebrow>
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
                {l.label}
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
              منصّة الذكاء الاصطناعي لتطوير البروفايل المهني — مصمَّمة للسوق السعودي والخليجي.
            </p>
            <div className="mt-4 space-y-1 font-ar text-[12px] text-v2-dim">
              {cr && (
                <div>
                  <span className="text-v2-mute">السجل التجاري · </span>
                  <NumDisplay className="text-v2-body">{cr}</NumDisplay>
                </div>
              )}
              <div>
                <span className="text-v2-mute">الموقع · </span>
                <span className="text-v2-body">
                  {COMPANY_LEGAL_INFO.city}، {COMPANY_LEGAL_INFO.country}
                </span>
              </div>
            </div>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.eyebrow}>
              <Eyebrow className="mb-3 block">{col.eyebrow}</Eyebrow>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <button
                      type="button"
                      onClick={() => navigate(l.href)}
                      className="font-ar text-[13px] text-v2-body hover:text-teal-700 cursor-pointer transition-colors duration-200 ease-out"
                    >
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex items-center justify-between border-t border-v2-line pt-6">
          <Eyebrow>© WASSEL · <NumDisplay>{COPYRIGHT_YEAR}</NumDisplay></Eyebrow>
          <span className="font-ar text-[12px] text-v2-dim">صُمم في الرياض.</span>
        </div>
      </footer>
    </>
  );
}
