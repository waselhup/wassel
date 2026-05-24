import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import SpinningLogo from '@/components/v2/SpinningLogo';
import PublicFooter from '@/components/v2/PublicFooter';
import PublicTopbar from '@/components/v2/PublicTopbar';
import { COMPANY_LEGAL_INFO } from '@/lib/v2/companyInfo';

const COPY = {
  ar: {
    eyebrow: 'سياسة الخصوصية',
    h1: 'خصوصيتك وأمان بياناتك أولوية لدينا',
    lastUpdatedLabel: 'آخر تحديث',
    lastUpdated: 'يناير 2026',
    introTitle: 'مقدمة',
    intro: 'توضح هذه السياسة كيفية جمع بياناتك واستخدامها وحمايتها عند استخدام منصة وصل، مع الالتزام بحماية خصوصية المستخدمين والشفافية في التعامل مع المعلومات',
    collectTitle: 'البيانات التي نجمعها',
    accountTitle: 'بيانات الحساب',
    account: [
      'الاسم والبريد الإلكتروني',
      'بيانات تسجيل الدخول',
      'صورة الحساب (اختيارية)',
    ],
    analysisTitle: 'بيانات التحليل',
    analysis: [
      'معلومات الملف المهني التي تختار مشاركتها',
      'الخبرات والمهارات والتعليم',
      'أهدافك المهنية وتفضيلاتك',
    ],
    usageTitle: 'بيانات الاستخدام',
    usage: [
      'معلومات استخدام المنصة',
      'بيانات الجهاز والمتصفح',
      'سجلات الأخطاء لتحسين الأداء',
    ],
    useTitle: 'كيف نستخدم البيانات',
    useList: [
      'تقديم خدمات تحليل الملف المهني وإنشاء المحتوى والسير الذاتية',
      'تخصيص النتائج وفقاً لأهدافك المهنية',
      'تحسين جودة الخدمة وتجربة الاستخدام',
      'إرسال التحديثات والإشعارات المهمة فقط',
      'الدعم الفني وخدمة العملاء',
    ],
    shareTitle: 'مع من نشارك البيانات',
    share: 'لا نبيع بياناتك لأي طرف ثالث، وقد تتم مشاركة بيانات محدودة مع مزودي خدمات موثوقين لتشغيل المنصة ومعالجة المدفوعات وتقديم الخدمة',
    complianceTitle: 'الامتثال',
    compliance: [
      'حماية البيانات وفق الأنظمة المعمول بها',
      'حماية وتشفير البيانات',
      'الشفافية في إدارة المعلومات',
      'احترام خصوصية المستخدمين',
    ],
    rightsTitle: 'حقوقك',
    rights: [
      { title: 'حق الوصول',   body: 'يحقّ لك معرفة البيانات المخزّنة عنك ومعالجتها' },
      { title: 'حق التصحيح',  body: 'تعديل أو تحديث بياناتك في أي وقت من إعدادات الحساب' },
      { title: 'حق الحذف',    body: 'طلب حذف بياناتك وفق سياسات الاحتفاظ المعمول بها' },
      { title: 'حق النقل',    body: 'تصدير بياناتك بصيغة قابلة للقراءة' },
    ],
    retentionTitle: 'مدة الاحتفاظ',
    retention: 'يتم الاحتفاظ بالبيانات وفق الحاجة التشغيلية والمتطلبات النظامية المعمول بها',
    contactTitle: 'للتواصل بشأن الخصوصية',
    crLabel: 'السجل التجاري',
  },
  en: {
    eyebrow: 'PRIVACY POLICY',
    h1: 'Your privacy and data security are our priority',
    lastUpdatedLabel: 'Last updated',
    lastUpdated: 'January 2026',
    introTitle: 'Introduction',
    intro: 'This policy explains how your data is collected, used, and protected when using Wassel, with a commitment to protecting user privacy and transparency in how information is handled',
    collectTitle: 'Data we collect',
    accountTitle: 'Account data',
    account: [
      'Name and email address',
      'Sign-in credentials',
      'Account photo (optional)',
    ],
    analysisTitle: 'Analysis data',
    analysis: [
      'Professional profile information you choose to share',
      'Experiences, skills, and education',
      'Your career goals and preferences',
    ],
    usageTitle: 'Usage data',
    usage: [
      'Platform usage information',
      'Device and browser data',
      'Error logs to improve performance',
    ],
    useTitle: 'How we use the data',
    useList: [
      'Providing profile analysis, content creation, and CV services',
      'Personalizing results based on your career goals',
      'Improving service quality and user experience',
      'Sending important updates and notifications only',
      'Technical support and customer service',
    ],
    shareTitle: 'Who we share data with',
    share: 'We do not sell your data to any third party. Limited data may be shared with trusted service providers to operate the platform, process payments, and deliver the service',
    complianceTitle: 'Compliance',
    compliance: [
      'Data protection in line with applicable regulations',
      'Data protection and encryption',
      'Transparency in managing information',
      'Respect for user privacy',
    ],
    rightsTitle: 'Your rights',
    rights: [
      { title: 'Right of access',     body: 'You may know what data we hold about you and how it is processed' },
      { title: 'Right of correction', body: 'Edit or update your data anytime from account settings' },
      { title: 'Right of deletion',   body: 'Request deletion of your data in line with applicable retention policies' },
      { title: 'Right of portability', body: 'Export your data in a machine-readable format' },
    ],
    retentionTitle: 'Retention period',
    retention: 'Data is retained based on operational need and applicable regulatory requirements',
    contactTitle: 'Contact for privacy matters',
    crLabel: 'Commercial registration',
  },
} as const;

export default function Privacy() {
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
          {/* INTRO */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.introTitle}</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              {t.intro}
            </p>
          </Card>

          {/* DATA COLLECTED */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.collectTitle}</Eyebrow>
            <div className="space-y-4 font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              <div>
                <div className="font-semibold text-v2-ink">{t.accountTitle}</div>
                <ul className="mt-1.5 list-disc ps-6">
                  {t.account.map((l) => <li key={l}>{l}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-v2-ink">{t.analysisTitle}</div>
                <ul className="mt-1.5 list-disc ps-6">
                  {t.analysis.map((l) => <li key={l}>{l}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-v2-ink">{t.usageTitle}</div>
                <ul className="mt-1.5 list-disc ps-6">
                  {t.usage.map((l) => <li key={l}>{l}</li>)}
                </ul>
              </div>
            </div>
          </Card>

          {/* USAGE */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.useTitle}</Eyebrow>
            <ul className="m-0 list-disc ps-6 font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              {t.useList.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </Card>

          {/* SHARING */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.shareTitle}</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              {t.share}
            </p>
          </Card>

          {/* COMPLIANCE */}
          <Card padding="lg" radius="lg" className="mb-4 border-teal-200 bg-teal-50">
            <Eyebrow className="mb-3 block !text-teal-700">{t.complianceTitle}</Eyebrow>
            <ul className="m-0 list-none p-0 font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px] flex flex-col gap-1.5">
              {t.compliance.map((l) => <li key={l}>✓ {l}</li>)}
            </ul>
          </Card>

          {/* RIGHTS */}
          <section className="mb-4">
            <Eyebrow className="mb-3 block">{t.rightsTitle}</Eyebrow>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {t.rights.map((r) => (
                <Card key={r.title} padding="md" radius="md">
                  <div className="font-ar text-[14px] font-semibold text-v2-ink">{r.title}</div>
                  <div className="mt-1 font-ar text-[13px] leading-relaxed text-v2-body">{r.body}</div>
                </Card>
              ))}
            </div>
          </section>

          {/* RETENTION */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.retentionTitle}</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              {t.retention}
            </p>
          </Card>

          {/* CONTACT */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">{t.contactTitle}</Eyebrow>
            <a
              href={`mailto:${COMPANY_LEGAL_INFO.privacyEmail}`}
              className="font-ar text-[15px] font-semibold text-teal-700 hover:text-teal-800 underline-offset-2 hover:underline"
            >
              {COMPANY_LEGAL_INFO.privacyEmail}
            </a>
            {COMPANY_LEGAL_INFO.commercialRegistration && (
              <p className="mt-3 font-ar text-[12px] text-v2-dim">
                {t.crLabel} · <span dir="ltr" className="text-v2-body">{COMPANY_LEGAL_INFO.commercialRegistration}</span>
              </p>
            )}
          </Card>
        </div>

        <PublicFooter />
      </div>
    </Phone>
  );
}
