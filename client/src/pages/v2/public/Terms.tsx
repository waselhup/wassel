import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
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
    eyebrow: 'شروط الاستخدام',
    h1: 'شروط استخدام واضحة وشفافة',
    lastUpdatedLabel: 'آخر تحديث',
    lastUpdated: 'يناير 2026',
    definitionTitle: 'تعريف الخدمة',
    definition: 'وصل منصة ذكية تساعد المحترفين على تطوير حضورهم المهني من خلال تحليل الملفات الشخصية، إنشاء المحتوى، وبناء سير ذاتية متوافقة مع ATS داخل تجربة موحدة وبسيطة',
    acceptanceTitle: 'قبول الشروط',
    acceptance: 'باستخدامك لمنصة وصل فإنك توافق على الالتزام بهذه الشروط والأحكام. إن لم توافق على بند منها، فضلاً امتنع عن استخدام الخدمة',
    usageTitle: 'حدود الاستخدام',
    allowedLabel: '✓ مسموح',
    allowed: [
      'تطوير حضورك المهني واستخدام الأدوات للأغراض الشخصية والمهنية',
      'إنشاء وتحليل المحتوى والملفات المهنية الخاصة بك',
      'إنشاء سير ذاتية احترافية باستخدام بياناتك',
      'الحصول على توصيات وملاحظات مهنية',
    ],
    prohibitedLabel: '✕ غير مسموح',
    prohibited: [
      'مخالفة شروط LinkedIn أو منصات الطرف الثالث',
      'تحليل ملفات الآخرين دون إذنهم خارج النطاق العام المتاح',
      'استخدام الخدمة لإرسال رسائل غير مرغوبة أو حملات مضايقة',
      'محاولة الوصول غير المصرح به أو إساءة استخدام المنصة',
      'إعادة بيع أو توزيع مخرجات المنصة أو خدماتها دون موافقة رسمية',
    ],
    accountsTitle: 'الحسابات والاشتراكات',
    accounts: [
      'تتحمل مسؤولية حماية بيانات الدخول الخاصة بك',
      'كل اشتراك مرتبط بشخص واحد ولا يجوز مشاركته',
      'يحق لنا تعليق الحسابات التي تنتهك هذه الشروط',
      'يمكن إلغاء الاشتراك في أي وقت من إعدادات الحساب',
    ],
    paymentTitle: 'الدفع',
    paymentBody: `تتم معالجة المدفوعات عبر مزود دفع معتمد بعملة ${PAYMENT_INFO.currencyAr}، ولا يتم تخزين بيانات بطاقات الدفع داخل منصة وصل. الوسائل المعتمدة:`,
    paymentFooter: 'للاطّلاع على شروط الاسترداد، راجع',
    refundLink: 'سياسة الاسترداد',
    ipTitle: 'الملكية الفكرية',
    ipBody: 'تحتفظ وصل بحقوق المنصة والعلامة التجارية والمحتوى المرتبط بالخدمة. تحتفظ أنت بحقوق المحتوى الذي تنشئه باستخدام الأدوات (السير الذاتية، المنشورات، التقارير) ويحق لك استخدامه بحرية',
    liabilityTitle: 'حدود المسؤولية',
    liabilityBody: 'تقدم التوصيات والتحليلات لأغراض إرشادية ولا تمثل ضماناً لنتائج مهنية محددة. لسنا مسؤولين عن قرارات اتخذت بناءً على مخرجات الخدمة دون مراجعة بشرية',
    jurisdictionTitle: 'القانون والاختصاص',
    jurisdictionBody: 'تخضع هذه الشروط للأنظمة المعمول بها في المملكة العربية السعودية',
    crLabel: 'السجل التجاري',
    changesTitle: 'تعديل الشروط',
    changesBody: 'سيتم إشعار المستخدمين بأي تغييرات جوهرية قبل تطبيقها',
    contactTitle: 'للتواصل',
  },
  en: {
    eyebrow: 'TERMS OF SERVICE',
    h1: 'Clear and transparent terms',
    lastUpdatedLabel: 'Last updated',
    lastUpdated: 'January 2026',
    definitionTitle: 'Service definition',
    definition: 'Wassel is a smart platform that helps professionals build a stronger career presence through profile analysis, content creation, and ATS-compatible CVs in one simple, unified experience',
    acceptanceTitle: 'Acceptance of terms',
    acceptance: 'By using Wassel you agree to be bound by these terms and conditions. If you do not agree, please refrain from using the service',
    usageTitle: 'Usage limits',
    allowedLabel: '✓ Allowed',
    allowed: [
      'Building your professional presence and using the tools for personal and professional purposes',
      'Creating and analyzing your own content and professional files',
      'Creating professional CVs using your own data',
      'Receiving career recommendations and feedback',
    ],
    prohibitedLabel: '✕ Not allowed',
    prohibited: [
      "Violating LinkedIn's terms or those of any third-party platform",
      "Analyzing other people's profiles without permission outside the publicly available scope",
      'Using the service to send unsolicited messages or harassment campaigns',
      'Attempting unauthorized access or misuse of the platform',
      'Reselling or redistributing platform outputs or services without written permission',
    ],
    accountsTitle: 'Accounts and subscriptions',
    accounts: [
      'You are responsible for protecting your sign-in credentials',
      'Each subscription is bound to one person and may not be shared',
      'We reserve the right to suspend accounts that violate these terms',
      'You may cancel your subscription anytime from account settings',
    ],
    paymentTitle: 'Payment',
    paymentBody: `Payments are processed through a certified payment provider in ${PAYMENT_INFO.currencyEn}. Card data is not stored inside Wassel. Accepted methods:`,
    paymentFooter: 'For refund terms, see the',
    refundLink: 'Refund Policy',
    ipTitle: 'Intellectual property',
    ipBody: 'Wassel retains the rights to the platform, brand, and service-related content. You retain the rights to the content you create using the tools (CVs, posts, reports) and may use it freely',
    liabilityTitle: 'Limitation of liability',
    liabilityBody: 'Recommendations and analyses are provided for guidance and do not represent a guarantee of any specific career outcome. We are not liable for decisions made on the basis of service outputs without human review',
    jurisdictionTitle: 'Law and jurisdiction',
    jurisdictionBody: 'These terms are governed by the laws applicable in the Kingdom of Saudi Arabia',
    crLabel: 'Commercial registration',
    changesTitle: 'Changes to the terms',
    changesBody: 'Users will be notified of any material changes before they take effect',
    contactTitle: 'Contact',
  },
} as const;

export default function Terms() {
  const { i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const t = isAr ? COPY.ar : COPY.en;

  return (
    <Phone>
      <PublicTopbar />
      <div className="flex-1 px-[22px] pb-12 lg:px-0 lg:pb-0" dir={isAr ? 'rtl' : 'ltr'}>
        {/* HERO */}
        <section className="mb-8 mt-2 flex flex-col items-center text-center lg:mt-4 lg:mb-12 lg:py-10">
          <SpinningLogo size="md" speed="slow" className="mb-4" />
          <Eyebrow className="mb-3 block !text-teal-700">{t.eyebrow}</Eyebrow>
          <h1 className="font-ar font-bold leading-[1.15] text-v2-ink text-[28px] lg:text-[40px] max-w-[640px]">
            {t.h1}
          </h1>
          <p className="mt-3 font-ar text-[13px] text-v2-dim">{t.lastUpdatedLabel} · {t.lastUpdated}</p>
        </section>

        <div className="lg:max-w-[820px] lg:mx-auto">
          {/* DEFINITION */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.definitionTitle}</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              {t.definition}
            </p>
          </Card>

          {/* ACCEPTANCE */}
          <Card padding="lg" radius="lg" className="mb-4 border-teal-200 bg-teal-50">
            <Eyebrow className="mb-3 block !text-teal-700">{t.acceptanceTitle}</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              {t.acceptance}
            </p>
          </Card>

          {/* USAGE */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.usageTitle}</Eyebrow>
            <div className="space-y-4">
              <div>
                <div className="font-ar text-[14px] font-semibold text-teal-700">{t.allowedLabel}</div>
                <ul className="mt-1.5 list-disc ps-6 font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
                  {t.allowed.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-ar text-[14px] font-semibold text-rose-700">{t.prohibitedLabel}</div>
                <ul className="mt-1.5 list-disc ps-6 font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
                  {t.prohibited.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          {/* ACCOUNTS */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.accountsTitle}</Eyebrow>
            <ul className="m-0 list-disc ps-6 font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              {t.accounts.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </Card>

          {/* PAYMENT */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.paymentTitle}</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              {t.paymentBody}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <span
                  key={m.id}
                  className="rounded-v2-pill border border-v2-line bg-v2-canvas-2 px-3 py-1.5 font-ar text-[12px] font-medium text-v2-body"
                >
                  {isAr ? m.ar : m.en}
                </span>
              ))}
            </div>
            <p className="mt-3 font-ar text-[13px] text-v2-dim">
              {t.paymentFooter} <a href="/v2/refund" className="text-teal-700 hover:text-teal-800 underline-offset-2 hover:underline font-semibold">{t.refundLink}</a>
            </p>
          </Card>

          {/* IP */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.ipTitle}</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              {t.ipBody}
            </p>
          </Card>

          {/* LIABILITY */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.liabilityTitle}</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              {t.liabilityBody}
            </p>
          </Card>

          {/* JURISDICTION */}
          <Card padding="lg" radius="lg" className="mb-4 border-amber-200 bg-amber-50">
            <Eyebrow className="mb-3 block !text-amber-700">{t.jurisdictionTitle}</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              {t.jurisdictionBody}
            </p>
            {COMPANY_LEGAL_INFO.commercialRegistration && (
              <p className="mt-3 font-ar text-[13px] text-v2-body">
                {t.crLabel} · <span dir="ltr" className="font-semibold">{COMPANY_LEGAL_INFO.commercialRegistration}</span>
              </p>
            )}
          </Card>

          {/* CHANGES */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.changesTitle}</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              {t.changesBody}
            </p>
          </Card>

          {/* CONTACT */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.contactTitle}</Eyebrow>
            <a
              href={`mailto:${COMPANY_LEGAL_INFO.email}`}
              className="font-ar text-[15px] font-semibold text-teal-700 hover:text-teal-800 underline-offset-2 hover:underline"
            >
              {COMPANY_LEGAL_INFO.email}
            </a>
          </Card>
        </div>

        <PublicFooter />
      </div>
    </Phone>
  );
}
