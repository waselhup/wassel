import { useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';

type Cycle = 'monthly' | 'annual';

interface Tier {
  id: 'free' | 'pro' | 'biz';
  name: string;
  description: string;
  monthly: number;
  annual: number;
  tokens: string;
  features: string[];
  cta: string;
  badge?: string;
  primary?: boolean;
  ctaTo: string;
}

const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'مجاني',
    description: 'للتجربة',
    monthly: 0,
    annual: 0,
    tokens: '100 توكن شهرياً',
    features: ['تحليل بروفايل واحد', 'صياغة 2 منشور', 'دعم البريد الإلكتروني'],
    cta: 'ابدأ مجاناً',
    ctaTo: '/v2/signup',
  },
  {
    id: 'pro',
    name: 'برو',
    description: 'للأفراد المحترفين',
    monthly: 99,
    annual: 79,
    tokens: '2000 توكن شهرياً',
    features: [
      'كل أدوات التحليل',
      'منشورات غير محدودة',
      'منشئ السيرة الذاتية',
      'دعم بأولوية',
    ],
    cta: 'اشترك',
    badge: 'الأكثر شيوعاً',
    primary: true,
    ctaTo: '/v2/signup',
  },
  {
    id: 'biz',
    name: 'أعمال',
    description: 'للفرق والشركات',
    monthly: 299,
    annual: 239,
    tokens: '10,000 توكن شهرياً',
    features: [
      'كل ميزات برو',
      'حسابات متعددة (5)',
      'إدارة فريق',
      'تقارير شهرية',
      'مدير حساب مخصّص',
    ],
    cta: 'تواصل مع المبيعات',
    ctaTo: '/v2',
  },
];

const FAQ: { q: string; a: string }[] = [
  { q: 'هل أستطيع الإلغاء في أي وقت؟', a: 'نعم. الإلغاء فوري بدون التزام، ويمكنك الاستمرار حتى نهاية فترة الاشتراك المدفوع.' },
  { q: 'هل تتجدّد التوكن شهرياً؟',     a: 'نعم. كل اشتراك يجدّد رصيد التوكن في تاريخ التجديد، ولا تتراكم التوكن غير المستخدمة.' },
  { q: 'هل أستطيع الترقية أو التخفيض لاحقاً؟', a: 'نعم. الترقية تطبَّق فوراً بفرق سعر متناسب، والتخفيض يبدأ من فترة التجديد القادمة.' },
  { q: 'كيف يتم الدفع؟', a: 'ندعم البطاقات السعودية ومدى وApple Pay عبر بوّابة Moyasar الآمنة. الفواتير تصل بالبريد فور الاشتراك.' },
];

const CheckIcon = ({ primary }: { primary?: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    aria-hidden="true"
    className="mt-0.5 shrink-0"
  >
    <path
      d="M3 7 L6 10 L11 4"
      stroke={primary ? 'var(--teal-300)' : 'var(--teal-700)'}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function Pricing() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2')}
        title={t('v2.pricing.title', 'الباقات')}
        bg="canvas"
        showPulse={false}
        showJobsIndicator={false}
      />

      <div className="flex-1 px-[22px] pb-12 pt-5 lg:mx-auto lg:max-w-[1100px] lg:px-0 lg:pt-0 lg:pb-0">

        {/* HERO */}
        <section className="mb-6 lg:mb-0 lg:py-20 lg:text-center">
          <Eyebrow className="mb-2 block !text-teal-700 lg:mb-3">PRICING</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[26px] lg:text-[48px]">
            {t('v2.pricing.heading', 'اختر الباقة المناسبة.')}
          </h1>
          <p className="mt-2 font-ar leading-relaxed text-v2-body text-[14px] lg:mx-auto lg:mt-4 lg:max-w-[560px] lg:text-[17px]">
            ابدأ مجاناً، ارقَ متى احتجت، الغِ متى شئت.
          </p>
        </section>

        {/* CYCLE TOGGLE */}
        <div
          role="tablist"
          aria-label="دورة الفوترة"
          className="mb-6 flex items-center gap-1 rounded-v2-pill border border-v2-line bg-v2-canvas-2 p-1
            lg:mx-auto lg:mb-12 lg:max-w-[280px]"
        >
          {(['monthly', 'annual'] as Cycle[]).map((c) => {
            const active = cycle === c;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCycle(c)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-v2-pill px-3 py-2.5 font-ar text-[13px] cursor-pointer transition-all duration-200 ease-out ${
                  active
                    ? 'bg-v2-surface text-v2-ink font-semibold shadow-card'
                    : 'bg-transparent text-v2-dim font-medium hover:text-v2-body'
                }`}
              >
                {c === 'monthly' ? 'شهري' : 'سنوي'}
                {c === 'annual' && (
                  <span className="rounded-v2-sm bg-teal-50 px-1.5 py-0.5 font-en text-[10px] font-bold tabular-nums text-teal-700">
                    −20%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TIERS — stacked on mobile, 3-col grid on desktop */}
        <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
          {TIERS.map((t) => {
            const price = cycle === 'annual' ? t.annual : t.monthly;
            const showStrike = cycle === 'annual' && t.annual !== t.monthly;
            const dark = !!t.primary;

            return (
              <div
                key={t.id}
                className={`relative rounded-v2-md border p-5 ${
                  dark
                    ? 'border-v2-ink bg-v2-ink text-white shadow-card'
                    : 'border-v2-line bg-v2-surface'
                }
                  lg:rounded-v2-lg lg:p-7
                  ${dark ? 'lg:scale-[1.04] lg:shadow-lift' : ''}
                `}
              >
                {t.badge && (
                  <span
                    className="absolute -top-2.5 end-4 rounded-v2-pill bg-teal-500 px-2.5 py-1 font-ar text-[10px] font-bold tracking-[0.04em]"
                    style={{ color: '#0a3530' }}
                  >
                    {t.badge}
                  </span>
                )}

                <div className="mb-3.5 flex items-start justify-between lg:mb-5 lg:flex-col lg:items-start lg:gap-4">
                  <div>
                    <div className={`font-ar text-[18px] font-bold lg:text-[22px] ${dark ? 'text-white' : 'text-v2-ink'}`}>
                      {t.name}
                    </div>
                    <div className={`mt-0.5 font-ar text-[12px] lg:text-[13px] ${dark ? 'text-white/60' : 'text-v2-dim'}`}>
                      {t.description}
                    </div>
                  </div>
                  <div className="text-end lg:text-start">
                    <div className="flex items-baseline justify-end gap-1 lg:justify-start">
                      <NumDisplay className={`text-[28px] font-bold leading-none lg:text-[40px] ${dark ? 'text-white' : 'text-v2-ink'}`}>
                        {price}
                      </NumDisplay>
                      <span className={`font-ar text-[11px] lg:text-[13px] ${dark ? 'text-white/60' : 'text-v2-dim'}`}>
                        ر.س / شهر
                      </span>
                    </div>
                    {showStrike && (
                      <NumDisplay
                        className={`mt-1 block text-[10px] line-through lg:text-[12px] ${
                          dark ? 'text-white/50' : 'text-v2-mute'
                        }`}
                      >
                        {t.monthly} ر.س
                      </NumDisplay>
                    )}
                  </div>
                </div>

                <div
                  className={`pb-3 mb-3 border-b font-ar text-[13px] lg:pb-4 lg:mb-4 lg:text-[14px] ${
                    dark ? 'border-white/10 text-white/70' : 'border-v2-line text-v2-body'
                  }`}
                >
                  {t.tokens}
                </div>

                <ul className="m-0 mb-5 list-none p-0 lg:mb-7">
                  {t.features.map((f) => (
                    <li
                      key={f}
                      className={`flex items-start gap-2.5 py-1.5 font-ar text-[13px] lg:text-[14px] ${
                        dark ? 'text-white/85' : 'text-v2-body'
                      }`}
                    >
                      <CheckIcon primary={dark} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {dark ? (
                  <button
                    type="button"
                    onClick={() => navigate(t.ctaTo)}
                    className="w-full rounded-v2-md bg-teal-500 px-4 py-3 font-ar text-[14px] font-semibold cursor-pointer transition-opacity duration-200 ease-out hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/40"
                    style={{ color: '#0a3530' }}
                  >
                    {t.cta}
                  </button>
                ) : (
                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    onClick={() => navigate(t.ctaTo)}
                  >
                    {t.cta}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* TRUST STRIP */}
        <section className="mt-7 grid grid-cols-3 gap-2 border-t border-v2-line pt-5 text-center lg:mt-20 lg:gap-10 lg:border-y lg:py-10">
          {[
            { t: 'آمن',    d: 'SSL مشفّر' },
            { t: 'الغِ متى', d: 'بدون التزام' },
            { t: 'دعم',    d: 'عربي 24/7' },
          ].map((item) => (
            <div key={item.t}>
              <div className="font-ar font-semibold text-v2-ink text-[13px] lg:text-[16px]">{item.t}</div>
              <div className="mt-0.5 font-ar text-v2-dim text-[11px] lg:text-[13px]">{item.d}</div>
            </div>
          ))}
        </section>

        {/* FAQ — single column on mobile, 2-col grid on desktop */}
        <section className="mt-8 lg:mt-20 lg:pb-24">
          <h2 className="mb-3 font-ar font-semibold text-v2-ink text-[17px] lg:mb-8 lg:text-center lg:text-[28px] lg:font-bold">
            أسئلة شائعة
          </h2>
          <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-x-10">
            {FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={i}
                  className={`border-b border-v2-line ${i === 0 ? 'border-t' : ''}
                    lg:border-t lg:border-b lg:[&:nth-child(2)]:border-t`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-3 px-1 py-4 text-start cursor-pointer focus-visible:outline-none lg:py-5"
                  >
                    <span className="flex-1 font-ar font-medium text-v2-ink text-[14px] lg:text-[15px]">
                      {item.q}
                    </span>
                    <span className={`text-v2-mute transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M3 5 L7 9 L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                  {open && (
                    <p className="px-1 pb-4 font-ar leading-relaxed text-v2-body text-[13px] lg:pb-5 lg:text-[14px]">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Phone>
  );
}

export default Pricing;
