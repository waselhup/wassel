import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import Button from '@/components/v2/Button';
import NumDisplay from '@/components/v2/NumDisplay';
import SpinningLogo from '@/components/v2/SpinningLogo';
import PublicFooter from '@/components/v2/PublicFooter';
import PublicTopbar from '@/components/v2/PublicTopbar';
import { COMPANY_LEGAL_INFO } from '@/lib/v2/companyInfo';

const COPY = {
  ar: {
    eyebrow: 'عن وصل',
    h1: 'نبني حضوراً مهنياً يفتح فرصاً أكثر',
    sub: 'وصل منصة ذكية تساعد المحترفين على تطوير حضورهم المهني من خلال تحليل الملفات الشخصية، إنشاء المحتوى، وبناء سير ذاتية متوافقة مع ATS داخل تجربة عربية موحدة وبسيطة',
    missionEyebrow: 'مهمتنا',
    missionH2: 'وفر وقتك وركّز على الفرص المهمة',
    missionP1: 'بناء حضور مهني قوي لا يجب أن يعني ساعات طويلة من البحث والكتابة والتعديل',
    missionP2: 'يساعدك وصل على فهم ملفك المهني، إنشاء محتوى احترافي، وإنشاء سيرة ذاتية جاهزة للتقديم داخل تجربة سهلة ومتكاملة',
    valuesEyebrow: 'قيمنا الأساسية',
    valuesH2: 'ثلاث قيم تقود قراراتنا',
    values: [
      { num: '01', title: 'تجربة أبسط',  body: 'نصمم أدوات سهلة الاستخدام تساعدك على الوصول لنتائج أسرع بدون تعقيد' },
      { num: '02', title: 'قيمة حقيقية', body: 'نبني مزايا تساعدك على تطوير حضورك المهني وتحقيق نتائج ملموسة' },
      { num: '03', title: 'ثقة وشفافية', body: 'نوضح طريقة عمل المنصة ونحافظ على خصوصية بياناتك وأمانها' },
    ],
    legalEyebrow: 'معلومات الشركة',
    legalH2: 'شفافية كاملة، التزام واضح',
    officialEyebrow: 'البيانات الرسمية',
    crLabel: 'السجل التجاري',
    locationLabel: 'الموقع',
    timezoneLabel: 'التوقيت',
    contactEyebrow: 'التواصل',
    emailLabel: 'البريد',
    hoursLabel: 'ساعات العمل',
    complianceEyebrow: 'الامتثال',
    compliance: [
      'نحمي بياناتك وفقاً لنظام حماية البيانات الشخصية (PDPL)',
      'نلتزم بالشفافية في استخدام البيانات',
      'نعمل وفق الأنظمة واللوائح المعمول بها',
      'نستخدم حلولاً وتقنيات متوافقة مع شروط الاستخدام الخاصة بالمنصات المختلفة',
    ],
    ctaEyebrow: 'استكشف اليوم',
    ctaH2: '🎁 جرّب أولى ميزات وصل · بدون بطاقة ائتمان',
    ctaPrimary: 'إنشاء حساب',
    ctaSecondary: 'تواصل معنا',
  },
  en: {
    eyebrow: 'ABOUT WASSEL',
    h1: 'We build a professional presence that opens more opportunities',
    sub: 'Wassel is a smart platform that helps professionals develop their career presence through profile analysis, content creation, and ATS-compatible CVs — in one simple, unified Arabic-first experience',
    missionEyebrow: 'Our mission',
    missionH2: 'Save your time and focus on the opportunities that matter',
    missionP1: "Building a strong professional presence shouldn't mean long hours of searching, writing, and editing",
    missionP2: 'Wassel helps you understand your professional profile, create professional content, and build a CV ready to submit — all in one simple, integrated experience',
    valuesEyebrow: 'Our core values',
    valuesH2: 'Three values that guide our decisions',
    values: [
      { num: '01', title: 'A simpler experience', body: 'We design easy-to-use tools that help you reach results faster without complexity' },
      { num: '02', title: 'Real value',           body: 'We build features that help you grow your professional presence and achieve tangible results' },
      { num: '03', title: 'Trust and transparency', body: 'We make how the platform works clear and protect the privacy and security of your data' },
    ],
    legalEyebrow: 'Company info',
    legalH2: 'Full transparency, clear commitment',
    officialEyebrow: 'Official details',
    crLabel: 'Commercial registration',
    locationLabel: 'Location',
    timezoneLabel: 'Time zone',
    contactEyebrow: 'Contact',
    emailLabel: 'Email',
    hoursLabel: 'Business hours',
    complianceEyebrow: 'Compliance',
    compliance: [
      'We protect your data in line with the Personal Data Protection Law (PDPL)',
      'We are transparent in how data is used',
      'We operate in line with applicable regulations',
      'We use solutions and technologies aligned with the terms of use of the platforms we integrate with',
    ],
    ctaEyebrow: 'Explore today',
    ctaH2: "🎁 Try Wassel's first features · No credit card",
    ctaPrimary: 'Create an account',
    ctaSecondary: 'Contact us',
  },
} as const;

export default function About() {
  const [, navigate] = useLocation();
  const { i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const t = isAr ? COPY.ar : COPY.en;
  const cr = COMPANY_LEGAL_INFO.commercialRegistration;

  return (
    <Phone>
      <PublicTopbar />
      <div className="flex-1 px-[22px] pb-12 lg:px-0 lg:pb-0" dir={isAr ? 'rtl' : 'ltr'}>
        {/* HERO */}
        <section className="mb-8 mt-2 flex flex-col items-center text-center lg:mt-4 lg:mb-12 lg:py-12">
          <SpinningLogo size="xl" speed="slow" label={COMPANY_LEGAL_INFO.brandAr} className="mb-5" />
          <Eyebrow className="mb-3 block !text-teal-700">{t.eyebrow}</Eyebrow>
          <h1 className="font-ar font-bold leading-[1.15] text-v2-ink text-[32px] lg:text-[48px] max-w-[680px]">
            {t.h1}
          </h1>
          <p className="mt-4 font-ar leading-relaxed text-v2-body text-[15px] lg:text-[17px] max-w-[640px]">
            {t.sub}
          </p>
        </section>

        {/* MISSION */}
        <section className="mb-8 lg:mb-16 lg:py-16">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <Eyebrow className="mb-3 block">{t.missionEyebrow}</Eyebrow>
              <h2 className="font-ar font-bold leading-tight text-v2-ink text-[24px] lg:text-[36px]">
                {t.missionH2}
              </h2>
              <p className="mt-4 font-ar leading-relaxed text-v2-body text-[14px] lg:text-[16px]">
                {t.missionP1}
              </p>
              <p className="mt-3 font-ar leading-relaxed text-v2-body text-[14px] lg:text-[16px]">
                {t.missionP2}
              </p>
            </div>
            <div className="mt-8 hidden lg:mt-0 lg:flex lg:items-center lg:justify-center">
              <SpinningLogo size="xl" speed="slow" />
            </div>
          </div>
        </section>

        {/* VALUES */}
        <section className="mb-10 lg:mb-16 lg:py-16">
          <Eyebrow className="mb-3 block lg:text-center">{t.valuesEyebrow}</Eyebrow>
          <h2 className="hidden font-ar font-bold text-v2-ink lg:mx-auto lg:mb-12 lg:block lg:max-w-[640px] lg:text-center lg:text-[36px] lg:leading-tight">
            {t.valuesH2}
          </h2>
          <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-6">
            {t.values.map((v, i) => (
              <Card
                key={v.num}
                padding="lg"
                radius="lg"
                className={`mb-3 lg:mb-0 ${i === t.values.length - 1 ? 'mb-0' : ''}`}
              >
                <NumDisplay className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-teal-700 lg:text-[12px]">
                  {v.num}
                </NumDisplay>
                <div className="mt-2 font-ar text-[15px] font-semibold text-v2-ink lg:text-[18px]">
                  {v.title}
                </div>
                <div className="mt-1.5 font-ar leading-relaxed text-v2-body text-[13px] lg:text-[14px]">
                  {v.body}
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* LEGAL / COMPLIANCE */}
        <section className="mb-10 lg:mb-16 lg:py-16">
          <Eyebrow className="mb-3 block">{t.legalEyebrow}</Eyebrow>
          <h2 className="font-ar font-bold leading-tight text-v2-ink text-[22px] lg:text-[32px] mb-5 lg:mb-8">
            {t.legalH2}
          </h2>

          <Card padding="lg" radius="lg" className="mb-4 lg:max-w-[860px]">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-8">
              <div>
                <Eyebrow className="mb-3 block">{t.officialEyebrow}</Eyebrow>
                <ul className="m-0 flex list-none flex-col gap-2 p-0 font-ar text-[13px] text-v2-body lg:text-[14px]">
                  {cr && (
                    <li>
                      <span className="text-v2-dim">{t.crLabel} · </span>
                      <NumDisplay className="font-semibold text-v2-ink">{cr}</NumDisplay>
                    </li>
                  )}
                  <li>
                    <span className="text-v2-dim">{t.locationLabel} · </span>
                    <span className="text-v2-ink">
                      {isAr
                        ? `${COMPANY_LEGAL_INFO.city}، ${COMPANY_LEGAL_INFO.regionAr}، ${COMPANY_LEGAL_INFO.country}`
                        : `${COMPANY_LEGAL_INFO.cityEn}, ${COMPANY_LEGAL_INFO.regionEn}, ${COMPANY_LEGAL_INFO.countryEn}`}
                    </span>
                  </li>
                  <li>
                    <span className="text-v2-dim">{t.timezoneLabel} · </span>
                    <span className="text-v2-ink">{COMPANY_LEGAL_INFO.timezone}</span>
                  </li>
                </ul>
              </div>
              <div>
                <Eyebrow className="mb-3 block">{t.contactEyebrow}</Eyebrow>
                <ul className="m-0 flex list-none flex-col gap-2 p-0 font-ar text-[13px] text-v2-body lg:text-[14px]">
                  <li>
                    <span className="text-v2-dim">{t.emailLabel} · </span>
                    <a
                      href={`mailto:${COMPANY_LEGAL_INFO.email}`}
                      className="text-teal-700 hover:text-teal-800 underline-offset-2 hover:underline"
                    >
                      {COMPANY_LEGAL_INFO.email}
                    </a>
                  </li>
                  <li>
                    <span className="text-v2-dim">{t.hoursLabel} · </span>
                    <span className="text-v2-ink">{isAr ? COMPANY_LEGAL_INFO.businessHoursAr : COMPANY_LEGAL_INFO.businessHoursEn}</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>

          <Card padding="lg" radius="lg" className="lg:max-w-[860px]">
            <Eyebrow className="mb-3 block">{t.complianceEyebrow}</Eyebrow>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 font-ar text-[13px] leading-relaxed text-v2-body lg:text-[14px]">
              {t.compliance.map((line) => <li key={line}>✓ {line}</li>)}
            </ul>
          </Card>
        </section>

        {/* CTA */}
        <section className="mb-10 lg:mb-0 lg:py-12">
          <Card padding="lg" radius="xl" elevated className="text-center lg:mx-auto lg:max-w-[720px] lg:py-12">
            <Eyebrow className="mb-2 block !text-teal-700">{t.ctaEyebrow}</Eyebrow>
            <h2 className="font-ar font-bold text-v2-ink text-[22px] lg:text-[28px]">
              {t.ctaH2}
            </h2>
            <div className="mt-5 flex flex-col gap-2.5 lg:flex-row lg:justify-center lg:gap-3">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => navigate('/v2/signup')}
                className="lg:w-auto lg:px-8"
              >
                {t.ctaPrimary}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => navigate('/v2/contact')}
                className="lg:w-auto lg:px-8"
              >
                {t.ctaSecondary}
              </Button>
            </div>
          </Card>
        </section>

        <PublicFooter />
      </div>
    </Phone>
  );
}
