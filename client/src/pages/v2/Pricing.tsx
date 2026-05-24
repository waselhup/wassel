import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';
import CheckoutModal from '@/components/v2/CheckoutModal';

type Cycle = 'monthly' | 'annual';

interface Plan {
  id: string;
  name_ar: string; name_en: string;
  tagline_ar: string | null; tagline_en: string | null;
  // Prices come back as JSON numbers from PostgREST (numeric → number) but we
  // accept string|number defensively so a backend type drift can't crash the page.
  monthly_price_sar: string | number;
  annual_price_sar: string | number | null;
  monthly_tokens: number;
  is_featured: boolean; is_custom: boolean; is_free: boolean;
  badge_ar: string | null; badge_en: string | null;
  features?: Array<{
    feature_ar: string; feature_en: string;
    is_included: boolean; is_coming_soon: boolean; is_highlighted: boolean;
  }>;
}

// Coerce any numeric-ish value (string, number, null, undefined) to a finite
// number. Falls back to 0 so render math never produces NaN.
function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const FAQ_AR: { q: string; a: string }[] = [
  { q: 'هل أستطيع الإلغاء في أي وقت؟', a: 'نعم. الإلغاء فوري بدون التزام، ويمكنك الاستمرار حتى نهاية فترة الاشتراك المدفوع' },
  { q: 'هل تتجدّد التوكن شهرياً؟',     a: 'نعم. كل اشتراك يجدّد رصيد التوكن في تاريخ التجديد، ولا تتراكم التوكن غير المستخدمة' },
  { q: 'هل أستطيع الترقية أو التخفيض لاحقاً؟', a: 'نعم. الترقية تطبَّق فوراً بفرق سعر متناسب، والتخفيض يبدأ من فترة التجديد القادمة' },
  { q: 'كيف يتم الدفع؟', a: 'ندعم البطاقات السعودية ومدى وApple Pay عبر بوّابة Moyasar الآمنة. الفواتير تصل بالبريد فور الاشتراك' },
];

const FAQ_EN: { q: string; a: string }[] = [
  { q: 'Can I cancel anytime?', a: 'Yes. Cancellation is instant with no commitment — you keep access until the end of your paid period.' },
  { q: 'Do tokens reset monthly?', a: 'Yes. Every subscription refreshes your token balance on the renewal date. Unused tokens do not roll over.' },
  { q: 'Can I upgrade or downgrade later?', a: 'Yes. Upgrades take effect immediately with a prorated price difference. Downgrades start from your next renewal.' },
  { q: 'How do I pay?', a: 'We accept Saudi cards including Mada and Apple Pay through the secure Moyasar gateway. Invoices arrive by email after subscribing.' },
];

const CheckIcon = ({ primary }: { primary?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
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
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);

  const isAr = i18n.language === 'ar';
  const FAQ = isAr ? FAQ_AR : FAQ_EN;

  useEffect(() => {
    let cancelled = false;
    trpc.pricing.getPlans()
      .then((data) => {
        if (cancelled) return;
        // Defensive: accept anything that's array-like; drop entries that
        // don't have an id so a single bad row can't crash the whole page.
        const safe = Array.isArray(data)
          ? (data as Plan[]).filter((p) => p && typeof p.id === 'string')
          : [];
        setPlans(safe);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error('[Pricing] getPlans failed:', e);
          setError(e?.message || 'Failed to load plans');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const t = (ar: string, en: string) => isAr ? ar : en;

  const handleCta = (plan: Plan) => {
    if (plan.is_free) {
      navigate(user ? '/v2/home' : '/v2/signup');
      return;
    }
    if (plan.is_custom) {
      window.location.href = 'mailto:sales@wasselhub.com?subject=Enterprise%20Plan%20Inquiry';
      return;
    }
    // Paid plan — open the checkout modal whether logged in or not. The
    // modal collects name/phone/email for guests and auto-provisions a
    // Supabase user before redirecting to Moyasar, so we always know who
    // paid even when they never explicitly "signed up".
    setCheckoutPlan(plan);
  };

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2')}
        title={t('الباقات', 'Pricing')}
        bg="canvas"
        showPulse={false}
        showJobsIndicator={false}
      />

      <div className="flex-1 px-[22px] pb-12 pt-5 lg:mx-auto lg:max-w-[1280px] lg:px-0 lg:pt-0 lg:pb-0">

        {/* HERO */}
        <section className="mb-6 lg:mb-0 lg:py-20 lg:text-center">
          <Eyebrow className="mb-2 block !text-teal-700 lg:mb-3">PRICING</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[26px] lg:text-[48px]">
            {t('اختر الباقة المناسبة', 'Pick the plan that fits.')}
          </h1>
          <p className="mt-2 font-ar leading-relaxed text-v2-body text-[14px] lg:mx-auto lg:mt-4 lg:max-w-[560px] lg:text-[17px]">
            {t('ابدأ مجاناً، ارقَ متى احتجت، الغِ متى شئت', 'Start free, upgrade when you need it, cancel anytime.')}
          </p>
        </section>

        {/* CYCLE TOGGLE */}
        <div
          role="tablist"
          aria-label={t('دورة الفوترة', 'Billing cycle')}
          className="mb-6 flex items-center gap-1 rounded-v2-pill border border-v2-line bg-v2-canvas-2 p-1 lg:mx-auto lg:mb-12 lg:max-w-[320px]"
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
                {c === 'monthly' ? t('شهري', 'Monthly') : t('سنوي', 'Annual')}
                {c === 'annual' && (
                  <span className="rounded-v2-sm bg-teal-50 px-1.5 py-0.5 font-en text-[10px] font-bold tabular-nums text-teal-700">
                    {t('وفّر شهرين', '2 months free')}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TIERS */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="rounded-v2-md border border-red-200 bg-red-50 p-4 text-center font-ar text-red-700 text-[13px]">
            {t('تعذّر تحميل الباقات. حاول مرة أخرى', 'Could not load plans. Please retry.')}
          </div>
        )}

        {!loading && !error && plans.length > 0 && (
          <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-4 lg:items-start lg:gap-5">
            {plans.map((plan) => {
              const monthly = num(plan.monthly_price_sar);
              const annual = num(plan.annual_price_sar);
              const annualMonthlyEquiv = annual ? Math.round(annual / 12) : monthly;
              const price = cycle === 'annual' ? annualMonthlyEquiv : monthly;
              const showAnnualSavings = cycle === 'annual' && annual > 0 && annualMonthlyEquiv < monthly;
              const dark = !!plan.is_featured;
              const name = (isAr ? plan.name_ar : plan.name_en) || plan.id;
              const tagline = isAr ? plan.tagline_ar : plan.tagline_en;
              const badge = isAr ? plan.badge_ar : plan.badge_en;
              const monthlyTokens = num(plan.monthly_tokens);
              const features = Array.isArray(plan.features) ? plan.features : [];

              const ctaLabel = plan.is_free
                ? t('ابدأ مجاناً', 'Start free')
                : plan.is_custom
                  ? t('تواصل معنا', 'Contact us')
                  : t('اشترك', 'Subscribe');

              const tokensLabel = plan.is_custom
                ? t('حسب الاحتياج', 'Custom volume')
                : t(`${monthlyTokens} توكن شهرياً`, `${monthlyTokens} tokens / month`);

              const priceLabel = plan.is_custom
                ? t('سعر مخصّص', 'Custom')
                : plan.is_free
                  ? t('مجاناً', 'Free')
                  : null;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-v2-md border p-5 ${
                    dark
                      ? 'border-v2-ink bg-v2-ink text-white shadow-card'
                      : 'border-v2-line bg-v2-surface'
                  }
                    lg:rounded-v2-lg lg:p-6
                    ${dark ? 'lg:scale-[1.05] lg:shadow-lift' : ''}
                  `}
                >
                  {badge && (
                    <span
                      className="absolute -top-2.5 end-4 rounded-v2-pill bg-teal-500 px-2.5 py-1 font-ar text-[10px] font-bold tracking-[0.04em]"
                      style={{ color: '#0a3530' }}
                    >
                      {badge}
                    </span>
                  )}

                  <div className="mb-3.5 lg:mb-5">
                    <div className={`font-ar text-[18px] font-bold lg:text-[20px] ${dark ? 'text-white' : 'text-v2-ink'}`}>
                      {name}
                    </div>
                    {tagline && (
                      <div className={`mt-0.5 font-ar text-[12px] lg:text-[13px] ${dark ? 'text-white/60' : 'text-v2-dim'}`}>
                        {tagline}
                      </div>
                    )}
                  </div>

                  <div className="mb-3 lg:mb-5">
                    {priceLabel ? (
                      <div className={`font-ar text-[24px] font-bold leading-none lg:text-[32px] ${dark ? 'text-white' : 'text-v2-ink'}`}>
                        {priceLabel}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1">
                          <NumDisplay className={`text-[28px] font-bold leading-none lg:text-[36px] ${dark ? 'text-white' : 'text-v2-ink'}`}>
                            {price}
                          </NumDisplay>
                          <span className={`font-ar text-[11px] lg:text-[13px] ${dark ? 'text-white/60' : 'text-v2-dim'}`}>
                            {t('ر.س / شهر', 'SAR / mo')}
                          </span>
                        </div>
                        {showAnnualSavings && (
                          <NumDisplay
                            className={`mt-1 block text-[10px] line-through lg:text-[12px] ${
                              dark ? 'text-white/50' : 'text-v2-mute'
                            }`}
                          >
                            {monthly} {t('ر.س', 'SAR')}
                          </NumDisplay>
                        )}
                      </>
                    )}
                  </div>

                  <div
                    className={`pb-3 mb-3 border-b font-ar text-[13px] lg:pb-4 lg:mb-4 lg:text-[14px] ${
                      dark ? 'border-white/10 text-white/70' : 'border-v2-line text-v2-body'
                    }`}
                  >
                    {tokensLabel}
                  </div>

                  <ul className="m-0 mb-5 list-none p-0 lg:mb-6">
                    {features.map((f, i) => {
                      const featureText = isAr ? f.feature_ar : f.feature_en;
                      return (
                        <li
                          key={i}
                          className={`flex items-start gap-2.5 py-1.5 font-ar text-[13px] lg:text-[14px] ${
                            f.is_included
                              ? dark ? 'text-white/85' : 'text-v2-body'
                              : dark ? 'text-white/40 line-through' : 'text-v2-mute line-through'
                          }`}
                        >
                          <CheckIcon primary={dark} />
                          <span>
                            {featureText}
                            {f.is_coming_soon && (
                              <span className={`ms-1.5 inline-block rounded-v2-sm px-1.5 py-0.5 font-en text-[9px] font-bold ${
                                dark ? 'bg-white/10 text-white/70' : 'bg-amber-50 text-amber-700'
                              }`}>
                                {t('قريباً', 'Soon')}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {dark ? (
                    <button
                      type="button"
                      onClick={() => handleCta(plan)}
                      className="w-full rounded-v2-md bg-teal-500 px-4 py-3 font-ar text-[14px] font-semibold cursor-pointer transition-opacity duration-200 ease-out hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/40"
                      style={{ color: '#0a3530' }}
                    >
                      {ctaLabel}
                    </button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="md"
                      fullWidth
                      onClick={() => handleCta(plan)}
                    >
                      {ctaLabel}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TRUST STRIP */}
        <section className="mt-7 grid grid-cols-3 gap-2 border-t border-v2-line pt-5 text-center lg:mt-20 lg:gap-10 lg:border-y lg:py-10">
          {[
            { t: t('آمن', 'Secure'),    d: t('SSL مشفّر', 'SSL encrypted') },
            { t: t('الغِ متى', 'Cancel anytime'), d: t('بدون التزام', 'No commitment') },
            { t: t('دعم', 'Support'),    d: t('عربي 24/7', 'Arabic 24/7') },
          ].map((item, i) => (
            <div key={i}>
              <div className="font-ar font-semibold text-v2-ink text-[13px] lg:text-[16px]">{item.t}</div>
              <div className="mt-0.5 font-ar text-v2-dim text-[11px] lg:text-[13px]">{item.d}</div>
            </div>
          ))}
        </section>

        {/* FAQ */}
        <section className="mt-8 lg:mt-20 lg:pb-24">
          <h2 className="mb-3 font-ar font-semibold text-v2-ink text-[17px] lg:mb-8 lg:text-center lg:text-[28px] lg:font-bold">
            {t('أسئلة شائعة', 'Frequently asked')}
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

      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          billingCycle={cycle}
          onClose={() => setCheckoutPlan(null)}
        />
      )}
    </Phone>
  );
}

export default Pricing;
