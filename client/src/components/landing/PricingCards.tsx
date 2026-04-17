import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

interface Plan {
  id: string;
  name: { ar: string; en: string };
  priceMonthly: number | null; // null = custom
  priceLabel?: { ar: string; en: string };
  desc: { ar: string; en: string };
  features: Array<{ ar: string; en: string }>;
  highlight?: boolean;
  cta: { ar: string; en: string };
  href: string;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: { ar: 'مجاني', en: 'Free' },
    priceMonthly: 0,
    desc: { ar: 'للتجربة والاستكشاف', en: 'Explore the platform' },
    features: [
      { ar: '100 توكن هدية عند التسجيل', en: '100 tokens gift on signup' },
      { ar: 'الوصول لكل الخدمات الست', en: 'Access to all six services' },
      { ar: 'دعم عبر البريد الإلكتروني', en: 'Email support' },
    ],
    cta: { ar: 'ابدأ مجاناً', en: 'Start free' },
    href: '/signup',
  },
  {
    id: 'starter',
    name: { ar: 'ابتدائي', en: 'Starter' },
    priceMonthly: 99,
    desc: { ar: 'للأفراد النشطين', en: 'For active individuals' },
    features: [
      { ar: '10,000 توكن شهرياً', en: '10,000 tokens / month' },
      { ar: 'أولوية في المعالجة', en: 'Priority processing' },
      { ar: 'تصدير السيرة الذاتية المتقدم', en: 'Advanced CV exports' },
      { ar: 'دعم خلال 24 ساعة', en: '24-hour support' },
    ],
    cta: { ar: 'اشترك', en: 'Subscribe' },
    href: '/signup',
  },
  {
    id: 'pro',
    name: { ar: 'احترافي', en: 'Pro' },
    priceMonthly: 299,
    desc: { ar: 'الأكثر شعبية', en: 'Most popular' },
    features: [
      { ar: '50,000 توكن شهرياً', en: '50,000 tokens / month' },
      { ar: 'حتى 5 أعضاء للفريق', en: 'Up to 5 team members' },
      { ar: 'تحليلات متقدمة', en: 'Advanced analytics' },
      { ar: 'تكامل KB المخصّص', en: 'Custom KB integration' },
      { ar: 'دعم مخصّص', en: 'Dedicated support' },
    ],
    highlight: true,
    cta: { ar: 'ابدأ مع Pro', en: 'Get Pro' },
    href: '/signup',
  },
  {
    id: 'enterprise',
    name: { ar: 'المؤسسة', en: 'Enterprise' },
    priceMonthly: null,
    priceLabel: { ar: 'حسب الطلب', en: "Let's talk" },
    desc: { ar: 'للمؤسسات والفرق الكبيرة', en: 'For teams and companies' },
    features: [
      { ar: 'توكنز غير محدودة', en: 'Unlimited tokens' },
      { ar: 'مستخدمون غير محدودين', en: 'Unlimited users' },
      { ar: 'تدريب مخصص للفريق', en: 'Custom team training' },
      { ar: 'تكامل مع أنظمتكم', en: 'System integrations' },
      { ar: 'مدير حساب مخصّص', en: 'Dedicated account manager' },
    ],
    cta: { ar: 'تواصل معنا', en: 'Contact sales' },
    href: 'mailto:waselhup@gmail.com?subject=Wassel Enterprise inquiry',
  },
];

export default function PricingCards() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [annual, setAnnual] = useState(false);

  function priceFor(p: Plan): { main: string; sub: string } {
    if (p.priceMonthly === null) {
      return { main: isAr ? (p.priceLabel?.ar || '—') : (p.priceLabel?.en || '—'), sub: '' };
    }
    if (p.priceMonthly === 0) {
      return { main: '0', sub: isAr ? 'SAR / شهر' : 'SAR / mo' };
    }
    const monthly = p.priceMonthly;
    const annualMonthly = Math.round(monthly * 0.8); // 20% off
    const main = String(annual ? annualMonthly : monthly);
    const sub = isAr ? 'SAR / شهر' : 'SAR / mo';
    return { main, sub };
  }

  return (
    <section id="pricing" style={{ padding: '100px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, ease }}
          style={{ textAlign: 'center', marginBottom: 40, maxWidth: 720, marginInline: 'auto' }}
        >
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              color: '#0F766E',
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            {isAr ? 'الأسعار' : 'Pricing'}
          </div>
          <h2
            style={{
              fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
              fontSize: 'clamp(30px, 4vw, 44px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: '#0B1220',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {isAr ? 'بسيطة. شفافة. بالريال السعودي.' : 'Simple. Transparent. In SAR.'}
          </h2>
          <p
            style={{
              fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
              fontSize: 16,
              color: '#475569',
              marginTop: 12,
              lineHeight: 1.6,
            }}
          >
            {isAr
              ? 'ابدأ مجاناً. ارفع باقتك فقط عند الحاجة.'
              : 'Start free. Upgrade only when you need to.'}
          </p>
        </motion.div>

        {/* Billing toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{ display: 'flex', justifyContent: 'center', marginBottom: 48 }}
        >
          <div
            style={{
              display: 'inline-flex',
              padding: 4,
              background: '#F1F5F9',
              borderRadius: 12,
              gap: 4,
            }}
          >
            {[
              { v: false, label: isAr ? 'شهري' : 'Monthly' },
              { v: true, label: isAr ? 'سنوي' : 'Annual' },
            ].map((opt) => (
              <button
                key={String(opt.v)}
                onClick={() => setAnnual(opt.v)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 9,
                  border: 'none',
                  background: annual === opt.v ? '#fff' : 'transparent',
                  color: annual === opt.v ? '#0B1220' : '#64748B',
                  fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: annual === opt.v ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
                  transition: 'all 180ms',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {opt.label}
                {opt.v && (
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: 'rgba(15,118,110,0.12)',
                      color: '#0F766E',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: 0.3,
                    }}
                  >
                    -20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        <div
          className="landing-pricing"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          {PLANS.map((p, i) => {
            const { main, sub } = priceFor(p);
            const highlight = !!p.highlight;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.5, ease, delay: i * 0.06 }}
                style={{
                  position: 'relative',
                  background: '#fff',
                  border: highlight ? '2px solid #0F766E' : '1px solid rgba(15,23,42,0.08)',
                  borderRadius: 20,
                  padding: '32px 26px',
                  transform: highlight ? 'scale(1.03)' : 'scale(1)',
                  boxShadow: highlight
                    ? '0 24px 60px -18px rgba(15,118,110,0.35)'
                    : '0 1px 2px rgba(15,23,42,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: highlight ? 2 : 1,
                }}
              >
                {highlight && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -14,
                      insetInlineStart: '50%',
                      transform: 'translateX(-50%)',
                      background: '#0F766E',
                      color: '#fff',
                      fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '5px 12px',
                      borderRadius: 999,
                      letterSpacing: 0.3,
                      boxShadow: '0 4px 12px rgba(15,118,110,0.4)',
                    }}
                  >
                    {isAr ? 'الأكثر شعبية' : 'Most popular'}
                  </div>
                )}

                <div
                  style={{
                    fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#0B1220',
                    letterSpacing: '-0.01em',
                    marginBottom: 4,
                  }}
                >
                  {isAr ? p.name.ar : p.name.en}
                </div>
                <div
                  style={{
                    fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                    fontSize: 12,
                    color: '#64748B',
                    marginBottom: 18,
                  }}
                >
                  {isAr ? p.desc.ar : p.desc.en}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 44,
                      fontWeight: 800,
                      color: '#0B1220',
                      letterSpacing: '-0.04em',
                      lineHeight: 1,
                    }}
                  >
                    {main}
                  </span>
                  {sub && (
                    <span
                      style={{
                        fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                        fontSize: 13,
                        color: '#64748B',
                      }}
                    >
                      {sub}
                    </span>
                  )}
                </div>
                {annual && p.priceMonthly && p.priceMonthly > 0 && (
                  <div
                    style={{
                      fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                      fontSize: 11,
                      color: '#0F766E',
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    {isAr ? `تُفوتر ${p.priceMonthly * 12 * 0.8} SAR سنوياً` : `Billed ${p.priceMonthly * 12 * 0.8} SAR yearly`}
                  </div>
                )}

                <div style={{ height: 1, background: 'rgba(15,23,42,0.06)', marginTop: 18, marginBottom: 18 }} />

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {p.features.map((f, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                        fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                        fontSize: 13.5,
                        color: '#334155',
                        lineHeight: 1.5,
                      }}
                    >
                      <Check size={14} style={{ color: '#0F766E', flexShrink: 0, marginTop: 3 }} />
                      <span>{isAr ? f.ar : f.en}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={p.href}
                  style={{
                    marginTop: 24,
                    display: 'block',
                    textAlign: 'center',
                    padding: '12px 18px',
                    borderRadius: 10,
                    fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                    fontSize: 14,
                    fontWeight: 700,
                    background: highlight ? '#0F766E' : '#fff',
                    color: highlight ? '#fff' : '#0F766E',
                    border: highlight ? 'none' : '1px solid rgba(15,118,110,0.3)',
                    textDecoration: 'none',
                    boxShadow: highlight ? '0 4px 14px rgba(15,118,110,0.3)' : 'none',
                    transition: 'background 180ms, color 180ms',
                  }}
                >
                  {isAr ? p.cta.ar : p.cta.en}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .landing-pricing { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .landing-pricing { grid-template-columns: 1fr !important; }
          .landing-pricing > * { transform: scale(1) !important; }
        }
      `}</style>
    </section>
  );
}
