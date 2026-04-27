import { useState } from 'react';
import Phone from '@/components/v2/Phone';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import Button from '@/components/v2/Button';
import Input from '@/components/v2/Input';
import SpinningLogo from '@/components/v2/SpinningLogo';
import PublicFooter from '@/components/v2/PublicFooter';
import { COMPANY_LEGAL_INFO } from '@/lib/v2/companyInfo';

const ENQUIRY_TYPES: { id: string; label: string }[] = [
  { id: 'general',     label: 'استفسار عام' },
  { id: 'support',     label: 'دعم تقني' },
  { id: 'billing',     label: 'الفواتير والدفع' },
  { id: 'refund',      label: 'طلب استرداد' },
  { id: 'partnership', label: 'شراكة تجارية' },
];

/**
 * Contact form posts to the user's mail client via mailto: with a structured
 * body. We intentionally do not POST to the protected feedback router (it
 * requires auth) — public visitors should be able to reach us before signup.
 * Once a server-side public-contact endpoint exists, we'll switch to a
 * direct submit.
 */
function buildMailto(opts: { name: string; email: string; type: string; subject: string; message: string }): string {
  const enquiryLabel = ENQUIRY_TYPES.find((t) => t.id === opts.type)?.label ?? opts.type;
  const subjectLine = `[${enquiryLabel}] ${opts.subject}`.trim();
  const body = [
    `الاسم: ${opts.name}`,
    `البريد: ${opts.email}`,
    `النوع: ${enquiryLabel}`,
    '',
    opts.message,
  ].join('\n');
  const params = new URLSearchParams({ subject: subjectLine, body });
  return `mailto:${COMPANY_LEGAL_INFO.email}?${params.toString()}`;
}

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = !!name.trim() && !!email.trim() && !!subject.trim() && !!message.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const href = buildMailto({ name: name.trim(), email: email.trim(), type, subject: subject.trim(), message: message.trim() });
    window.location.href = href;
    setSubmitted(true);
  }

  return (
    <Phone>
      <div className="flex-1 px-[22px] pb-12 lg:px-0 lg:pb-0">
        {/* HERO */}
        <section className="mb-8 mt-2 flex flex-col items-center text-center lg:mt-4 lg:mb-12 lg:py-12">
          <SpinningLogo size="lg" speed="slow" className="mb-5" />
          <Eyebrow className="mb-3 block !text-teal-700">تواصل معنا</Eyebrow>
          <h1 className="font-ar font-bold leading-[1.15] text-v2-ink text-[28px] lg:text-[44px] max-w-[640px]">
            نحن هنا لمساعدتك.
          </h1>
          <p className="mt-3 font-ar leading-relaxed text-v2-body text-[15px] lg:text-[17px] max-w-[600px]">
            أرسل رسالتك وسنرد خلال <bdi>24</bdi> ساعة في أيام العمل. لا توجد حالياً خدمة هاتفية — البريد الإلكتروني أسرع وسيلة للوصول.
          </p>
        </section>

        <div className="lg:grid lg:grid-cols-[1fr_1.2fr] lg:gap-8 lg:max-w-[1100px] lg:mx-auto">
          {/* INFO */}
          <div>
            <Card padding="lg" radius="lg" className="mb-4">
              <Eyebrow className="mb-3 block">القنوات</Eyebrow>
              <ul className="m-0 flex list-none flex-col gap-3 p-0 font-ar text-[13px] lg:text-[14px]">
                <li>
                  <div className="text-v2-dim">البريد العام</div>
                  <a
                    href={`mailto:${COMPANY_LEGAL_INFO.email}`}
                    className="text-teal-700 hover:text-teal-800 font-semibold underline-offset-2 hover:underline"
                  >
                    {COMPANY_LEGAL_INFO.email}
                  </a>
                </li>
                <li>
                  <div className="text-v2-dim">الاسترداد</div>
                  <a
                    href={`mailto:${COMPANY_LEGAL_INFO.refundEmail}`}
                    className="text-teal-700 hover:text-teal-800 font-semibold underline-offset-2 hover:underline"
                  >
                    {COMPANY_LEGAL_INFO.refundEmail}
                  </a>
                </li>
                <li>
                  <div className="text-v2-dim">الخصوصية</div>
                  <a
                    href={`mailto:${COMPANY_LEGAL_INFO.privacyEmail}`}
                    className="text-teal-700 hover:text-teal-800 font-semibold underline-offset-2 hover:underline"
                  >
                    {COMPANY_LEGAL_INFO.privacyEmail}
                  </a>
                </li>
              </ul>
            </Card>

            <Card padding="lg" radius="lg" className="mb-4">
              <Eyebrow className="mb-3 block">ساعات العمل</Eyebrow>
              <div className="font-ar text-[14px] text-v2-ink">{COMPANY_LEGAL_INFO.businessHoursAr}</div>
              <div className="mt-1 font-ar text-[13px] text-v2-dim">{COMPANY_LEGAL_INFO.timezone}</div>
            </Card>

            <Card padding="lg" radius="lg">
              <Eyebrow className="mb-3 block">معلومات الشركة</Eyebrow>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 font-ar text-[13px] text-v2-body lg:text-[14px]">
                {COMPANY_LEGAL_INFO.commercialRegistration && (
                  <li>
                    <span className="text-v2-dim">السجل التجاري · </span>
                    <span className="font-semibold text-v2-ink" dir="ltr">{COMPANY_LEGAL_INFO.commercialRegistration}</span>
                  </li>
                )}
                <li>
                  <span className="text-v2-dim">الموقع · </span>
                  <span className="text-v2-ink">{COMPANY_LEGAL_INFO.city}، {COMPANY_LEGAL_INFO.country}</span>
                </li>
              </ul>
            </Card>
          </div>

          {/* FORM */}
          <div>
            <Card padding="lg" radius="lg" elevated>
              {submitted ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-white">
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <path d="M5 11 L9 15 L17 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <h2 className="mt-4 font-ar text-[20px] font-bold text-v2-ink">تم فتح بريدك.</h2>
                  <p className="mt-2 font-ar text-[14px] text-v2-body">
                    إذا لم يفتح برنامج البريد تلقائياً، أرسلنا الرسالة مباشرة على
                    <a
                      href={`mailto:${COMPANY_LEGAL_INFO.email}`}
                      className="ms-1 text-teal-700 hover:text-teal-800 font-semibold underline-offset-2 hover:underline"
                    >
                      {COMPANY_LEGAL_INFO.email}
                    </a>
                  </p>
                  <Button
                    variant="secondary"
                    size="md"
                    className="mt-5"
                    onClick={() => {
                      setSubmitted(false);
                      setName(''); setEmail(''); setSubject(''); setMessage(''); setType('general');
                    }}
                  >
                    إرسال رسالة أخرى
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                  <Eyebrow className="block">أرسل رسالة</Eyebrow>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input
                      label="الاسم الكامل *"
                      placeholder="اسمك"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                    <Input
                      label="البريد الإلكتروني *"
                      type="email"
                      dir="ltr"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-ar text-[13px] font-semibold text-v2-ink">
                      نوع الاستفسار
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ENQUIRY_TYPES.map((opt) => {
                        const active = type === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setType(opt.id)}
                            className={`rounded-v2-pill px-3.5 py-2 font-ar text-[13px] font-semibold border transition-colors duration-150 ease-out cursor-pointer ${
                              active
                                ? 'border-teal-600 bg-teal-50 text-teal-700'
                                : 'border-v2-line bg-v2-surface text-v2-body hover:bg-v2-canvas-2'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Input
                    label="موضوع الرسالة *"
                    placeholder="مثلاً: استفسار عن الباقات"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />

                  <div>
                    <label className="mb-2 block font-ar text-[13px] font-semibold text-v2-ink">
                      تفاصيل الرسالة *
                    </label>
                    <textarea
                      required
                      rows={6}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="اكتب رسالتك هنا..."
                      className="w-full resize-y rounded-v2-md border border-v2-line bg-v2-surface px-3.5 py-3 font-ar text-[14px] text-v2-ink placeholder:text-v2-mute focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled={!canSubmit}
                  >
                    إرسال الرسالة
                  </Button>
                  <p className="text-center font-ar text-[11px] text-v2-dim">
                    يفتح هذا الزر برنامج البريد الافتراضي مع رسالة معبّأة مسبقاً.
                  </p>
                </form>
              )}
            </Card>
          </div>
        </div>

        <div className="mt-12 lg:mt-16">
          <PublicFooter />
        </div>
      </div>
    </Phone>
  );
}
