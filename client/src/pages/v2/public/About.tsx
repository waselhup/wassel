import { useLocation } from 'wouter';
import Phone from '@/components/v2/Phone';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import Button from '@/components/v2/Button';
import NumDisplay from '@/components/v2/NumDisplay';
import SpinningLogo from '@/components/v2/SpinningLogo';
import PublicFooter from '@/components/v2/PublicFooter';
import {
  COMPANY_LEGAL_INFO,
  COMPLIANCE_AR,
} from '@/lib/v2/companyInfo';

const VALUES = [
  {
    eyebrow: '01',
    title: 'التميّز التقني',
    body:
      'نستخدم أحدث تقنيات الذكاء الاصطناعي ومعايير هندسة البرمجيات لتقديم تجربة سريعة، آمنة، ومُختبَرة في السوق السعودي.',
  },
  {
    eyebrow: '02',
    title: 'خدمة العميل',
    body:
      'دعم متواصل بالعربية ومساعدة شخصية لضمان نجاحك المهني، مع توثيق واضح في كل خطوة.',
  },
  {
    eyebrow: '03',
    title: 'الامتثال والشفافية',
    body:
      'التزام كامل بالأنظمة السعودية، احترام شروط منصّات الطرف الثالث، وشفافية تامّة في كيفية استخدام بياناتك.',
  },
];

export default function About() {
  const [, navigate] = useLocation();
  const cr = COMPANY_LEGAL_INFO.commercialRegistration;

  return (
    <Phone>
      <div className="flex-1 px-[22px] pb-12 lg:px-0 lg:pb-0">
        {/* HERO */}
        <section className="mb-8 mt-2 flex flex-col items-center text-center lg:mt-4 lg:mb-12 lg:py-12">
          <SpinningLogo size="xl" speed="slow" label="وصّل" className="mb-5" />
          <Eyebrow className="mb-3 block !text-teal-700">عن وصّل</Eyebrow>
          <h1 className="font-ar font-bold leading-[1.15] text-v2-ink text-[32px] lg:text-[48px] max-w-[680px]">
            نُبسّط البحث عن الفرص المهنية في السوق السعودي.
          </h1>
          <p className="mt-4 font-ar leading-relaxed text-v2-body text-[15px] lg:text-[17px] max-w-[640px]">
            وصّل منصّة ذكاء اصطناعي لتطوير البروفايل المهني، تساعد المهنيين السعوديين على اكتشاف وتجهيز الفرص المناسبة بكفاءة، مع التركيز على متطلبات السوق ورؤية المملكة 2030.
          </p>
        </section>

        {/* MISSION */}
        <section className="mb-8 lg:mb-16 lg:py-16">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <Eyebrow className="mb-3 block">مهمتنا</Eyebrow>
              <h2 className="font-ar font-bold leading-tight text-v2-ink text-[24px] lg:text-[36px]">
                وقتك أهم من البحث المتكرر.
              </h2>
              <p className="mt-4 font-ar leading-relaxed text-v2-body text-[14px] lg:text-[16px]">
                توفير الوقت في البحث عن الفرص لا يعني التنازل عن الجودة.
                نستخدم تحليل البروفايل بالذكاء الاصطناعي لاستخراج التوصيات الأعلى أثراً، نصوغ المنشورات بصوتك أنت، ونعدّل السيرة الذاتية لكل دور هدف — كل هذا داخل تجربة موحّدة باللغة العربية.
              </p>
              <p className="mt-3 font-ar leading-relaxed text-v2-body text-[14px] lg:text-[16px]">
                نخدم محترفين في القطاعات الرئيسية بالمملكة: التقنية، النفط والغاز، المالية، الاستشارات، الحكومة، والقطاع الأكاديمي.
              </p>
            </div>
            <div className="mt-8 hidden lg:mt-0 lg:flex lg:items-center lg:justify-center">
              <SpinningLogo size="xl" speed="slow" />
            </div>
          </div>
        </section>

        {/* VALUES */}
        <section className="mb-10 lg:mb-16 lg:py-16">
          <Eyebrow className="mb-3 block lg:text-center">قيمنا الأساسية</Eyebrow>
          <h2 className="hidden font-ar font-bold text-v2-ink lg:mx-auto lg:mb-12 lg:block lg:max-w-[640px] lg:text-center lg:text-[36px] lg:leading-tight">
            ثلاث قيم تقود قراراتنا.
          </h2>
          <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-6">
            {VALUES.map((v, i) => (
              <Card
                key={v.eyebrow}
                padding="lg"
                radius="lg"
                className={`mb-3 lg:mb-0 ${i === VALUES.length - 1 ? 'mb-0' : ''}`}
              >
                <NumDisplay className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-teal-700 lg:text-[12px]">
                  {v.eyebrow}
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
          <Eyebrow className="mb-3 block">معلومات الشركة</Eyebrow>
          <h2 className="font-ar font-bold leading-tight text-v2-ink text-[22px] lg:text-[32px] mb-5 lg:mb-8">
            شفافية كاملة، التزام واضح.
          </h2>

          <Card padding="lg" radius="lg" className="mb-4 lg:max-w-[860px]">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-8">
              <div>
                <Eyebrow className="mb-3 block">البيانات الرسمية</Eyebrow>
                <ul className="m-0 flex list-none flex-col gap-2 p-0 font-ar text-[13px] text-v2-body lg:text-[14px]">
                  {cr && (
                    <li>
                      <span className="text-v2-dim">السجل التجاري · </span>
                      <NumDisplay className="font-semibold text-v2-ink">{cr}</NumDisplay>
                    </li>
                  )}
                  <li>
                    <span className="text-v2-dim">الموقع · </span>
                    <span className="text-v2-ink">
                      {COMPANY_LEGAL_INFO.city}، {COMPANY_LEGAL_INFO.regionAr}، {COMPANY_LEGAL_INFO.country}
                    </span>
                  </li>
                  <li>
                    <span className="text-v2-dim">التوقيت · </span>
                    <span className="text-v2-ink">{COMPANY_LEGAL_INFO.timezone}</span>
                  </li>
                </ul>
              </div>
              <div>
                <Eyebrow className="mb-3 block">التواصل</Eyebrow>
                <ul className="m-0 flex list-none flex-col gap-2 p-0 font-ar text-[13px] text-v2-body lg:text-[14px]">
                  <li>
                    <span className="text-v2-dim">البريد · </span>
                    <a
                      href={`mailto:${COMPANY_LEGAL_INFO.email}`}
                      className="text-teal-700 hover:text-teal-800 underline-offset-2 hover:underline"
                    >
                      {COMPANY_LEGAL_INFO.email}
                    </a>
                  </li>
                  <li>
                    <span className="text-v2-dim">ساعات العمل · </span>
                    <span className="text-v2-ink">{COMPANY_LEGAL_INFO.businessHoursAr}</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>

          <Card padding="lg" radius="lg" className="lg:max-w-[860px]">
            <Eyebrow className="mb-3 block">الامتثال</Eyebrow>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 font-ar text-[13px] leading-relaxed text-v2-body lg:text-[14px]">
              <li>✓ {COMPLIANCE_AR.digitalRegulation}</li>
              <li>✓ {COMPLIANCE_AR.dataProtection}</li>
              <li>✓ {COMPLIANCE_AR.ecommerce}</li>
              <li>✓ {COMPLIANCE_AR.linkedin}</li>
            </ul>
          </Card>
        </section>

        {/* CTA */}
        <section className="mb-10 lg:mb-0 lg:py-12">
          <Card padding="lg" radius="xl" elevated className="text-center lg:mx-auto lg:max-w-[720px] lg:py-12">
            <Eyebrow className="mb-2 block !text-teal-700">ابدأ اليوم</Eyebrow>
            <h2 className="font-ar font-bold text-v2-ink text-[22px] lg:text-[28px]">
              <NumDisplay>100</NumDisplay> توكن مجاني · بدون بطاقة ائتمان
            </h2>
            <div className="mt-5 flex flex-col gap-2.5 lg:flex-row lg:justify-center lg:gap-3">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => navigate('/v2/signup')}
                className="lg:w-auto lg:px-8"
              >
                إنشاء حساب
              </Button>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => navigate('/contact')}
                className="lg:w-auto lg:px-8"
              >
                تواصل معنا
              </Button>
            </div>
          </Card>
        </section>

        <PublicFooter />
      </div>
    </Phone>
  );
}
