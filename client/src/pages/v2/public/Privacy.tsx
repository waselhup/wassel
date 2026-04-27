import Phone from '@/components/v2/Phone';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import SpinningLogo from '@/components/v2/SpinningLogo';
import PublicFooter from '@/components/v2/PublicFooter';
import { COMPANY_LEGAL_INFO, COMPLIANCE_AR } from '@/lib/v2/companyInfo';

const LAST_UPDATED_AR = 'يناير 2026';

const RIGHTS = [
  { title: 'حق الوصول',  body: 'يحقّ لك معرفة البيانات المخزّنة عنك ومعالجتها.' },
  { title: 'حق التصحيح', body: 'تعديل أو تحديث بياناتك في أي وقت من إعدادات الحساب.' },
  { title: 'حق الحذف',   body: 'طلب حذف بياناتك نهائياً خلال 30 يوماً.' },
  { title: 'حق النقل',   body: 'تصدير بياناتك بصيغة JSON قابلة للقراءة.' },
];

export default function Privacy() {
  return (
    <Phone>
      <div className="flex-1 px-[22px] pb-12 lg:px-0 lg:pb-0">
        {/* HERO */}
        <section className="mb-8 mt-2 flex flex-col items-center text-center lg:mt-4 lg:mb-12 lg:py-10">
          <SpinningLogo size="md" speed="slow" className="mb-4" />
          <Eyebrow className="mb-3 block !text-teal-700">سياسة الخصوصية</Eyebrow>
          <h1 className="font-ar font-bold leading-[1.15] text-v2-ink text-[28px] lg:text-[40px] max-w-[640px]">
            خصوصيتك التزام، لا خيار.
          </h1>
          <p className="mt-3 font-ar text-[13px] text-v2-dim">آخر تحديث · {LAST_UPDATED_AR}</p>
        </section>

        <div className="lg:max-w-[820px] lg:mx-auto">
          {/* INTRO */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">مقدّمة</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              تحترم وصّل خصوصيتك وتلتزم بحماية بياناتك الشخصية. توضح هذه السياسة كيفية جمع واستخدام وتخزين معلوماتك عند استخدام المنصّة، بما يتوافق مع نظام حماية البيانات الشخصية في المملكة العربية السعودية ولائحة GDPR الأوروبية.
            </p>
          </Card>

          {/* DATA COLLECTED */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">البيانات التي نجمعها</Eyebrow>
            <div className="space-y-4 font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              <div>
                <div className="font-semibold text-v2-ink">بيانات الحساب</div>
                <ul className="mt-1.5 list-disc ps-6">
                  <li>الاسم الكامل والبريد الإلكتروني.</li>
                  <li>كلمة المرور (مخزّنة بصيغة مشفّرة Argon2/bcrypt).</li>
                  <li>صورة الحساب من مزوّدي OAuth (اختياري).</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-v2-ink">بيانات التحليل</div>
                <ul className="mt-1.5 list-disc ps-6">
                  <li>رابط البروفايل العام على لينكد إن وما يُستخرج منه.</li>
                  <li>الخبرات، التعليم، المهارات، الشهادات (المتاحة علناً).</li>
                  <li>أهداف التحليل (دور هدف، صناعة، لغة التقرير).</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-v2-ink">بيانات الاستخدام</div>
                <ul className="mt-1.5 list-disc ps-6">
                  <li>سجلّات الدخول، عناوين IP، نوع المتصفح والجهاز.</li>
                  <li>قياس استخدام الميزات لتحسين المنتج (PostHog).</li>
                  <li>سجلات الأخطاء (Sentry) — بدون محتوى شخصي.</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* USAGE */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">كيف نستخدم البيانات</Eyebrow>
            <ul className="m-0 list-disc ps-6 font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              <li>تقديم خدمات تحليل البروفايل وصياغة المنشورات والسير الذاتية.</li>
              <li>تخصيص النتائج وفقاً لأهدافك المهنية والسوق المستهدف.</li>
              <li>تحسين النموذج (مع إمكانية إيقاف ذلك من إعدادات الحساب).</li>
              <li>إرسال التحديثات والإشعارات المهمّة فقط.</li>
              <li>الدعم الفني وخدمة العملاء.</li>
            </ul>
          </Card>

          {/* SHARING */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">مع من نشارك البيانات</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              لا نبيع بياناتك لأي طرف. نتشارك معالجي بيانات موثوقين لتشغيل الخدمة فقط:
            </p>
            <ul className="mt-2 list-disc ps-6 font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              <li>مزوّد قاعدة البيانات والمصادقة (Supabase).</li>
              <li>مزوّد الاستضافة وخدمات الحوسبة (Vercel).</li>
              <li>مزوّد الذكاء الاصطناعي للتحليل وصياغة المحتوى (Anthropic Claude).</li>
              <li>مزوّد الدفع المعتمد (Moyasar) — لا نخزّن بيانات بطاقات الدفع.</li>
            </ul>
          </Card>

          {/* COMPLIANCE */}
          <Card padding="lg" radius="lg" className="mb-4 border-teal-200 bg-teal-50">
            <Eyebrow className="mb-3 block !text-teal-700">الامتثال القانوني</Eyebrow>
            <ul className="m-0 list-none p-0 font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px] flex flex-col gap-1.5">
              <li>✓ {COMPLIANCE_AR.dataProtection}</li>
              <li>✓ {COMPLIANCE_AR.digitalRegulation}</li>
              <li>✓ التزام بلائحة GDPR الأوروبية لحماية البيانات.</li>
              <li>✓ شفافية تامّة في أنواع البيانات ومدد الاحتفاظ.</li>
            </ul>
          </Card>

          {/* RIGHTS */}
          <section className="mb-4">
            <Eyebrow className="mb-3 block">حقوقك</Eyebrow>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {RIGHTS.map((r) => (
                <Card key={r.title} padding="md" radius="md">
                  <div className="font-ar text-[14px] font-semibold text-v2-ink">{r.title}</div>
                  <div className="mt-1 font-ar text-[13px] leading-relaxed text-v2-body">{r.body}</div>
                </Card>
              ))}
            </div>
          </section>

          {/* RETENTION */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">مدّة الاحتفاظ</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              نحتفظ ببيانات الحساب طوال فترة استخدامك للمنصّة. عند حذف الحساب، تُمحى البيانات نهائياً خلال 30 يوماً، باستثناء ما تتطلّبه الأنظمة من سجلات مالية يتم الاحتفاظ بها وفق المدد القانونية.
            </p>
          </Card>

          {/* CONTACT */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">للتواصل بشأن الخصوصية</Eyebrow>
            <a
              href={`mailto:${COMPANY_LEGAL_INFO.privacyEmail}`}
              className="font-ar text-[15px] font-semibold text-teal-700 hover:text-teal-800 underline-offset-2 hover:underline"
            >
              {COMPANY_LEGAL_INFO.privacyEmail}
            </a>
            {COMPANY_LEGAL_INFO.commercialRegistration && (
              <p className="mt-3 font-ar text-[12px] text-v2-dim">
                السجل التجاري · <span dir="ltr" className="text-v2-body">{COMPANY_LEGAL_INFO.commercialRegistration}</span>
              </p>
            )}
          </Card>
        </div>

        <PublicFooter />
      </div>
    </Phone>
  );
}
