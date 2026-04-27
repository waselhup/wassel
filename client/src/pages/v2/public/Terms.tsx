import Phone from '@/components/v2/Phone';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import SpinningLogo from '@/components/v2/SpinningLogo';
import PublicFooter from '@/components/v2/PublicFooter';
import {
  COMPANY_LEGAL_INFO,
  PAYMENT_INFO,
  PAYMENT_METHODS,
} from '@/lib/v2/companyInfo';

const EFFECTIVE_AR = 'يناير 2026';

const ALLOWED = [
  'البحث عن الفرص المهنية الشخصية وتطوير البروفايل.',
  'تحليل بروفايلك على لينكد إن وحفظ التقارير الخاصة بك.',
  'إنشاء سير ذاتية محترفة باستخدام بياناتك.',
  'الحصول على توصيات وملاحظات مهنية.',
];

const PROHIBITED = [
  'مخالفة شروط لينكد إن أو منصّات الطرف الثالث.',
  'تحليل ملفّات الآخرين بغير إذنهم خارج النطاق العام المتاح.',
  'استخدام الخدمة لإرسال رسائل غير مرغوبة أو حملات مضايقة.',
  'محاولة اختراق المنصّة أو هندسة عكسية للنماذج.',
  'إعادة بيع التحليلات أو واجهات البرمجة دون اتفاق مكتوب.',
];

export default function Terms() {
  return (
    <Phone>
      <div className="flex-1 px-[22px] pb-12 lg:px-0 lg:pb-0">
        {/* HERO */}
        <section className="mb-8 mt-2 flex flex-col items-center text-center lg:mt-4 lg:mb-12 lg:py-10">
          <SpinningLogo size="md" speed="slow" className="mb-4" />
          <Eyebrow className="mb-3 block !text-teal-700">شروط الخدمة</Eyebrow>
          <h1 className="font-ar font-bold leading-[1.15] text-v2-ink text-[28px] lg:text-[40px] max-w-[640px]">
            قواعد واضحة لاستخدام عادل.
          </h1>
          <p className="mt-3 font-ar text-[13px] text-v2-dim">سارية من · {EFFECTIVE_AR}</p>
        </section>

        <div className="lg:max-w-[820px] lg:mx-auto">
          {/* DEFINITION */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">تعريف الخدمة</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              وصّل منصّة ذكاء اصطناعي تساعد المهنيين على تحليل بروفايل لينكد إن وإنشاء محتوى احترافي (منشورات وسير ذاتية)، بتركيز على السوق السعودي والخليجي.
            </p>
          </Card>

          {/* ACCEPTANCE */}
          <Card padding="lg" radius="lg" className="mb-4 border-teal-200 bg-teal-50">
            <Eyebrow className="mb-3 block !text-teal-700">قبول الشروط</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              باستخدامك للمنصّة فإنك توافق على الالتزام بهذه الشروط. إن لم توافق على بند منها، فضلاً امتنع عن استخدام الخدمة.
            </p>
          </Card>

          {/* USAGE */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">حدود الاستخدام</Eyebrow>
            <div className="space-y-4">
              <div>
                <div className="font-ar text-[14px] font-semibold text-teal-700">✓ مسموح</div>
                <ul className="mt-1.5 list-disc ps-6 font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
                  {ALLOWED.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-ar text-[14px] font-semibold text-rose-700">✕ غير مسموح</div>
                <ul className="mt-1.5 list-disc ps-6 font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
                  {PROHIBITED.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          {/* ACCOUNTS */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">الحسابات والاشتراكات</Eyebrow>
            <ul className="m-0 list-disc ps-6 font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              <li>تتحمّل مسؤولية حماية بيانات الدخول الخاصة بك.</li>
              <li>كل اشتراك مرتبط بشخص واحد ولا يجوز مشاركته.</li>
              <li>يحقّ لنا تعليق الحسابات التي تنتهك هذه الشروط.</li>
              <li>يمكن إلغاء الاشتراك في أي وقت من إعدادات الحساب.</li>
            </ul>
          </Card>

          {/* PAYMENT */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">الدفع</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              يتم الدفع عبر مزوّد {PAYMENT_INFO.providerAr} بعملة {PAYMENT_INFO.currencyAr}. لا نخزّن بيانات بطاقات الدفع. الوسائل المعتمدة:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <span
                  key={m.id}
                  className="rounded-v2-pill border border-v2-line bg-v2-canvas-2 px-3 py-1.5 font-ar text-[12px] font-medium text-v2-body"
                >
                  {m.ar}
                </span>
              ))}
            </div>
            <p className="mt-3 font-ar text-[13px] text-v2-dim">
              للاطّلاع على شروط الاسترداد، راجع <a href="/refund" className="text-teal-700 hover:text-teal-800 underline-offset-2 hover:underline font-semibold">سياسة الاسترداد</a>.
            </p>
          </Card>

          {/* IP */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">الملكية الفكرية</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              تحتفظ وصّل بحقوق المنصّة والشيفرة المصدرية والشعار. تحتفظ أنت بحقوق المحتوى الذي تنشئه باستخدام الأدوات (السير الذاتية، المنشورات، التقارير) ويحقّ لك استخدامه بحرية.
            </p>
          </Card>

          {/* LIABILITY */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">حدود المسؤولية</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              تُقدَّم الخدمة كما هي. التحليلات والتوصيات إرشادية ولا تُعتبر ضماناً للحصول على وظيفة أو ترقية. لسنا مسؤولين عن قرارات اتُّخذت بناءً على مخرجات الخدمة دون مراجعة بشرية.
            </p>
          </Card>

          {/* JURISDICTION */}
          <Card padding="lg" radius="lg" className="mb-4 border-amber-200 bg-amber-50">
            <Eyebrow className="mb-3 block !text-amber-700">القانون والاختصاص</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              تخضع هذه الشروط لقوانين المملكة العربية السعودية، وتختصّ المحاكم السعودية بأي نزاع قد ينشأ.
            </p>
            {COMPANY_LEGAL_INFO.commercialRegistration && (
              <p className="mt-3 font-ar text-[13px] text-v2-body">
                السجل التجاري · <span dir="ltr" className="font-semibold">{COMPANY_LEGAL_INFO.commercialRegistration}</span>
              </p>
            )}
          </Card>

          {/* CHANGES */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">تعديل الشروط</Eyebrow>
            <p className="font-ar text-[14px] leading-relaxed text-v2-body lg:text-[15px]">
              نحتفظ بالحقّ في تعديل هذه الشروط. سنُشعرك بالتغييرات الجوهرية عبر البريد الإلكتروني قبل دخولها حيّز التنفيذ بـ 30 يوماً.
            </p>
          </Card>

          {/* CONTACT */}
          <Card padding="lg" radius="lg" className="mb-4">
            <Eyebrow className="mb-3 block">للتواصل</Eyebrow>
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
