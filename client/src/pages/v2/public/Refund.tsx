import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import SpinningLogo from '@/components/v2/SpinningLogo';
import PublicFooter from '@/components/v2/PublicFooter';
import PublicTopbar from '@/components/v2/PublicTopbar';
import {
  COMPANY_LEGAL_INFO,
  PAYMENT_INFO,
  PAYMENT_METHODS,
} from '@/lib/v2/companyInfo';

const COPY = {
  ar: {
    eyebrow: 'سياسة الاسترداد',
    h1: 'تجربة واضحة وسياسة استرداد عادلة',
    intro: `يمكنك طلب الاسترداد خلال ${PAYMENT_INFO.refundPeriodDays} يوماً من تاريخ الدفع وفق سياسة الاسترداد الموضحة أدناه`,
    bannerTitle: `${PAYMENT_INFO.refundPeriodDays} يوماً لطلبات الاسترداد`,
    bannerBody: 'تتم مراجعة الطلبات بسرعة ووفق الشروط الموضحة',
    acceptedTitle: 'حالات مقبولة',
    accepted: [
      { title: 'مشكلة مؤثرة في الخدمة', body: 'إذا واجهت مشكلة تمنعك من استخدام المزايا الأساسية بشكل طبيعي' },
      { title: 'مشكلة تقنية غير محلولة', body: 'إذا تعذر حل المشكلة خلال وقت معقول' },
      { title: 'عملية دفع غير صحيحة',   body: 'في حال تكرار الخصم أو حدوث خطأ في عملية الدفع' },
    ],
    exceptionsTitle: 'حالات غير مشمولة',
    exceptions: [
      { title: 'استهلاك معظم الاستخدامات', body: 'الحسابات التي استهلكت جزءاً كبيراً من الاستخدامات المتاحة' },
      { title: 'إساءة الاستخدام',          body: 'إساءة استخدام الخدمة أو مخالفة الشروط' },
      { title: 'بعد انتهاء المدة',         body: 'الطلبات المقدمة بعد انتهاء المدة المحددة' },
    ],
    stepsEyebrow: 'طلب الاسترداد بأربع خطوات',
    stepsTitle: 'بدون عناء، بدون رسوم خفية',
    steps: [
      { num: '01', title: 'تواصل معنا',  body: `راسلنا على ${COMPANY_LEGAL_INFO.refundEmail} مع رقم الفاتورة` },
      { num: '02', title: 'اذكر التفاصيل', body: 'تاريخ الدفع، طريقة الدفع، وسبب طلب الاسترداد' },
      { num: '03', title: 'مراجعة',       body: 'تتم مراجعة الطلب وإرسال تحديث بحالته خلال أيام العمل' },
      { num: '04', title: 'الاسترداد',     body: `يصل المبلغ خلال ${PAYMENT_INFO.refundProcessingDaysMin}–${PAYMENT_INFO.refundProcessingDaysMax} أيام عمل بنفس وسيلة الدفع` },
    ],
    paymentEyebrow: 'الدفع الآمن',
    paymentBody: 'يتم الدفع عبر مزود دفع معتمد باستخدام تشفير آمن لحماية المعاملات. معاملات آمنة ومشفرة لحماية بيانات الدفع',
    contactEyebrow: 'للاسترداد والدعم',
    contactSubject: 'طلب استرداد',
  },
  en: {
    eyebrow: 'REFUND POLICY',
    h1: 'A clear experience and a fair refund policy',
    intro: `You can request a refund within ${PAYMENT_INFO.refundPeriodDays} days of payment, in line with the policy outlined below`,
    bannerTitle: `${PAYMENT_INFO.refundPeriodDays} days to request a refund`,
    bannerBody: 'Requests are reviewed quickly and according to the stated terms',
    acceptedTitle: 'Eligible cases',
    accepted: [
      { title: 'A service-impacting issue', body: 'If you face an issue that prevents you from using core features normally' },
      { title: 'Unresolved technical issue', body: 'If a technical problem cannot be resolved within a reasonable time' },
      { title: 'Incorrect payment',          body: 'In case of a duplicate charge or an error in the payment process' },
    ],
    exceptionsTitle: 'Cases not covered',
    exceptions: [
      { title: 'High usage already consumed', body: 'Accounts that have consumed a significant portion of available usage' },
      { title: 'Misuse of the service',       body: 'Misuse of the service or violation of the terms' },
      { title: 'After the period ends',       body: 'Requests submitted after the specified period has ended' },
    ],
    stepsEyebrow: 'Refund in four steps',
    stepsTitle: 'No hassle, no hidden fees',
    steps: [
      { num: '01', title: 'Contact us',    body: `Email ${COMPANY_LEGAL_INFO.refundEmail} with the invoice number` },
      { num: '02', title: 'Share details', body: 'Date of payment, method, and reason for the refund request' },
      { num: '03', title: 'Review',        body: 'We review the request and send a status update within business days' },
      { num: '04', title: 'Refund',        body: `Funds arrive in ${PAYMENT_INFO.refundProcessingDaysMin}–${PAYMENT_INFO.refundProcessingDaysMax} business days via the same payment method` },
    ],
    paymentEyebrow: 'Secure payment',
    paymentBody: 'Payments are processed through a certified payment provider using secure encryption to protect transactions',
    contactEyebrow: 'Refunds & support',
    contactSubject: 'Refund request',
  },
} as const;

export default function Refund() {
  const { i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const t = isAr ? COPY.ar : COPY.en;

  return (
    <Phone>
      <PublicTopbar />
      <div className="flex-1 px-[22px] pb-12 lg:px-0 lg:pb-0" dir={isAr ? 'rtl' : 'ltr'}>
        {/* HERO */}
        <section className="mb-8 mt-2 flex flex-col items-center text-center lg:mt-4 lg:mb-12 lg:py-12">
          <SpinningLogo size="lg" speed="slow" className="mb-5" />
          <Eyebrow className="mb-3 block !text-teal-700">{t.eyebrow}</Eyebrow>
          <h1 className="font-ar font-bold leading-[1.15] text-v2-ink text-[28px] lg:text-[44px] max-w-[640px]">
            {t.h1}
          </h1>
          <p className="mt-4 font-ar leading-relaxed text-v2-body text-[15px] lg:text-[17px] max-w-[600px]">
            {t.intro}
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
                {t.bannerTitle}
              </div>
              <p className="mt-1 font-ar leading-relaxed text-v2-body text-[13px] lg:text-[14px]">
                {t.bannerBody}
              </p>
            </div>
          </div>
        </Card>

        {/* CONDITIONS */}
        <section className="mb-10 lg:mb-16 lg:max-w-[1060px] lg:mx-auto">
          <div className="lg:grid lg:grid-cols-2 lg:gap-6">
            {/* Accepted */}
            <Card padding="lg" radius="lg" className="mb-4 lg:mb-0">
              <Eyebrow className="mb-3 block !text-teal-700">{t.acceptedTitle}</Eyebrow>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {t.accepted.map((c) => (
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
              <Eyebrow className="mb-3 block !text-amber-700">{t.exceptionsTitle}</Eyebrow>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {t.exceptions.map((c) => (
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
          <Eyebrow className="mb-3 block lg:text-center">{t.stepsEyebrow}</Eyebrow>
          <h2 className="hidden font-ar font-bold text-v2-ink lg:mx-auto lg:mb-10 lg:block lg:max-w-[640px] lg:text-center lg:text-[32px] lg:leading-tight">
            {t.stepsTitle}
          </h2>
          <div className="flex flex-col lg:grid lg:grid-cols-4 lg:gap-4 lg:max-w-[1060px] lg:mx-auto">
            {t.steps.map((s, i) => (
              <Card
                key={s.num}
                padding="lg"
                radius="lg"
                className={`mb-3 lg:mb-0 ${i === t.steps.length - 1 ? 'mb-0' : ''}`}
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
            <Eyebrow className="mb-3 block">{t.paymentEyebrow}</Eyebrow>
            <p className="font-ar text-[13px] leading-relaxed text-v2-body lg:text-[14px]">
              {t.paymentBody}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <span
                  key={m.id}
                  className="rounded-v2-pill border border-v2-line bg-v2-canvas-2 px-3 py-1.5 font-ar text-[12px] font-medium text-v2-body"
                >
                  {isAr ? m.ar : m.en}
                </span>
              ))}
            </div>
          </Card>
        </section>

        {/* CONTACT */}
        <section className="mb-10 lg:mb-0 lg:py-8">
          <Card padding="lg" radius="lg" className="lg:max-w-[860px] lg:mx-auto">
            <Eyebrow className="mb-2 block">{t.contactEyebrow}</Eyebrow>
            <a
              href={`mailto:${COMPANY_LEGAL_INFO.refundEmail}?subject=${encodeURIComponent(t.contactSubject)}`}
              className="font-ar text-[16px] font-semibold text-teal-700 hover:text-teal-800 underline-offset-2 hover:underline"
            >
              {COMPANY_LEGAL_INFO.refundEmail}
            </a>
            <div className="mt-2 font-ar text-[13px] text-v2-dim">
              {isAr ? COMPANY_LEGAL_INFO.businessHoursAr : COMPANY_LEGAL_INFO.businessHoursEn} · {COMPANY_LEGAL_INFO.timezone}
            </div>
          </Card>
        </section>

        <PublicFooter />
      </div>
    </Phone>
  );
}
