import Phone from '@/components/v2/Phone';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import SpinningLogo from '@/components/v2/SpinningLogo';
import PublicFooter from '@/components/v2/PublicFooter';
import {
  COMPANY_LEGAL_INFO,
  PAYMENT_INFO,
  PAYMENT_METHODS,
} from '@/lib/v2/companyInfo';

const ACCEPTED = [
  {
    title: 'عدم الرضا عن الخدمة',
    body: 'إذا لم تلبِّ الخدمة توقعاتك خلال أوّل تجربة استخدام.',
  },
  {
    title: 'مشاكل تقنية',
    body: 'إذا واجهتَ مشكلة تقنية لم نتمكن من حلّها في وقت معقول.',
  },
  {
    title: 'خصم متكرر بالخطأ',
    body: 'إذا تمّ خصم اشتراك بالخطأ أو دون إذن.',
  },
];

const EXCEPTIONS = [
  {
    title: 'الاستخدام المخالف للشروط',
    body: 'الاستخدام بطريقة تنتهك شروط الخدمة أو شروط منصّات الطرف الثالث.',
  },
  {
    title: 'بعد انتهاء المدة',
    body: 'الطلبات المقدّمة بعد مرور أكثر من 14 يوماً تُراجَع كاستثناء.',
  },
];

const STEPS = [
  { num: '01', title: 'تواصل معنا', body: `راسلنا على ${COMPANY_LEGAL_INFO.refundEmail} مع رقم الفاتورة.` },
  { num: '02', title: 'اذكر التفاصيل', body: 'تاريخ الدفع، طريقة الدفع، وسبب طلب الاسترداد.' },
  { num: '03', title: 'مراجعة سريعة', body: 'نراجع الطلب خلال 24 ساعة ونرسل تأكيداً بالنتيجة.' },
  {
    num: '04',
    title: 'الاسترداد',
    body: `يصل المبلغ خلال ${PAYMENT_INFO.refundProcessingDaysMin}–${PAYMENT_INFO.refundProcessingDaysMax} أيام عمل بنفس وسيلة الدفع.`,
  },
];

export default function Refund() {
  return (
    <Phone>
      <div className="flex-1 px-[22px] pb-12 lg:px-0 lg:pb-0">
        {/* HERO */}
        <section className="mb-8 mt-2 flex flex-col items-center text-center lg:mt-4 lg:mb-12 lg:py-12">
          <SpinningLogo size="lg" speed="slow" className="mb-5" />
          <Eyebrow className="mb-3 block !text-teal-700">سياسة الاسترداد</Eyebrow>
          <h1 className="font-ar font-bold leading-[1.15] text-v2-ink text-[28px] lg:text-[44px] max-w-[640px]">
            رضاك أولاً، أو يُسترد المبلغ.
          </h1>
          <p className="mt-4 font-ar leading-relaxed text-v2-body text-[15px] lg:text-[17px] max-w-[600px]">
            نوفر <NumDisplay>{PAYMENT_INFO.refundPeriodDays}</NumDisplay> يوماً ضمان استرداد كامل من تاريخ الدفع. نريد أن تثق بالخدمة قبل أن تستثمر فيها.
          </p>
        </section>

        {/* GUARANTEE BANNER */}
        <Card padding="lg" radius="xl" elevated className="mb-8 border-teal-200 bg-teal-50 lg:mb-14 lg:max-w-[860px] lg:mx-auto">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 font-en text-[14px] font-bold text-white">
              <NumDisplay>{PAYMENT_INFO.refundPeriodDays}</NumDisplay>
            </span>
            <div className="flex-1">
              <div className="font-ar text-[16px] font-bold text-v2-ink lg:text-[18px]">
                <NumDisplay>{PAYMENT_INFO.refundPeriodDays}</NumDisplay> يوماً ضمان كامل
              </div>
              <p className="mt-1 font-ar leading-relaxed text-v2-body text-[13px] lg:text-[14px]">
                طلب استرداد ميسّر، بدون أسئلة معقّدة. نؤمن بجودة خدمتنا.
              </p>
            </div>
          </div>
        </Card>

        {/* CONDITIONS */}
        <section className="mb-10 lg:mb-16 lg:max-w-[1060px] lg:mx-auto">
          <div className="lg:grid lg:grid-cols-2 lg:gap-6">
            {/* Accepted */}
            <Card padding="lg" radius="lg" className="mb-4 lg:mb-0">
              <Eyebrow className="mb-3 block !text-teal-700">حالات مقبولة</Eyebrow>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {ACCEPTED.map((c) => (
                  <li key={c.title} className="flex items-start gap-3">
                    <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6 L5 9 L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div>
                      <div className="font-ar text-[14px] font-semibold text-v2-ink">{c.title}</div>
                      <div className="mt-0.5 font-ar text-[13px] leading-relaxed text-v2-body">{c.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Exceptions */}
            <Card padding="lg" radius="lg">
              <Eyebrow className="mb-3 block !text-amber-700">حالات استثنائية</Eyebrow>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {EXCEPTIONS.map((c) => (
                  <li key={c.title} className="flex items-start gap-3">
                    <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 font-en text-[12px] font-bold text-amber-700">!</span>
                    <div>
                      <div className="font-ar text-[14px] font-semibold text-v2-ink">{c.title}</div>
                      <div className="mt-0.5 font-ar text-[13px] leading-relaxed text-v2-body">{c.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        {/* STEPS */}
        <section className="mb-10 lg:mb-16">
          <Eyebrow className="mb-3 block lg:text-center">طلب الاسترداد بأربع خطوات</Eyebrow>
          <h2 className="hidden font-ar font-bold text-v2-ink lg:mx-auto lg:mb-10 lg:block lg:max-w-[640px] lg:text-center lg:text-[32px] lg:leading-tight">
            بدون عناء، بدون رسوم خفية.
          </h2>
          <div className="flex flex-col lg:grid lg:grid-cols-4 lg:gap-4 lg:max-w-[1060px] lg:mx-auto">
            {STEPS.map((s, i) => (
              <Card
                key={s.num}
                padding="lg"
                radius="lg"
                className={`mb-3 lg:mb-0 ${i === STEPS.length - 1 ? 'mb-0' : ''}`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-v2-md bg-teal-50 font-en text-[13px] font-bold text-teal-700">
                  {s.num}
                </div>
                <div className="mt-3 font-ar text-[15px] font-semibold text-v2-ink lg:text-[16px]">
                  {s.title}
                </div>
                <div className="mt-1.5 font-ar text-[13px] leading-relaxed text-v2-body">
                  {s.body}
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* PAYMENT METHODS */}
        <section className="mb-10 lg:mb-16 lg:max-w-[860px] lg:mx-auto">
          <Card padding="lg" radius="lg">
            <Eyebrow className="mb-3 block">الدفع الآمن</Eyebrow>
            <p className="font-ar text-[13px] leading-relaxed text-v2-body lg:text-[14px]">
              يجري الدفع عبر مزود {PAYMENT_INFO.providerAr} بتشفير 256-bit SSL وتوافق PCI DSS. العملة المعتمدة: {PAYMENT_INFO.currencyAr} ({PAYMENT_INFO.currencyEn}).
            </p>
            {!PAYMENT_INFO.isLive && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-v2-pill bg-amber-50 px-3 py-1 font-ar text-[11px] font-semibold text-amber-700">
                <span aria-hidden>⏳</span>
                الدفع قيد التفعيل — تواصل معنا لتفاصيل الباقات
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <span
                  key={m.id}
                  className="rounded-v2-pill border border-v2-line bg-v2-canvas-2 px-3 py-1.5 font-ar text-[12px] font-medium text-v2-body"
                >
                  {m.ar}
                </span>
              ))}
            </div>
          </Card>
        </section>

        {/* CONTACT */}
        <section className="mb-10 lg:mb-0 lg:py-8">
          <Card padding="lg" radius="lg" className="lg:max-w-[860px] lg:mx-auto">
            <Eyebrow className="mb-2 block">للاسترداد والدعم</Eyebrow>
            <a
              href={`mailto:${COMPANY_LEGAL_INFO.refundEmail}?subject=${encodeURIComponent('طلب استرداد')}`}
              className="font-ar text-[16px] font-semibold text-teal-700 hover:text-teal-800 underline-offset-2 hover:underline"
            >
              {COMPANY_LEGAL_INFO.refundEmail}
            </a>
            <div className="mt-2 font-ar text-[13px] text-v2-dim">
              {COMPANY_LEGAL_INFO.businessHoursAr} · {COMPANY_LEGAL_INFO.timezone}
            </div>
          </Card>
        </section>

        <PublicFooter />
      </div>
    </Phone>
  );
}
