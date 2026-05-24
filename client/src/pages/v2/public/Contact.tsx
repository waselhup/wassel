import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import Button from '@/components/v2/Button';
import Input from '@/components/v2/Input';
import SpinningLogo from '@/components/v2/SpinningLogo';
import PublicFooter from '@/components/v2/PublicFooter';
import PublicTopbar from '@/components/v2/PublicTopbar';
import { COMPANY_LEGAL_INFO } from '@/lib/v2/companyInfo';

const COPY = {
  ar: {
    eyebrow: 'تواصل معنا',
    h1: 'تواصل معنا',
    sub: 'فريق وصل جاهز للإجابة على استفساراتك ومساعدتك خلال أيام العمل',
    rtNote: 'متوسط وقت الرد أقل من 24 ساعة',
    types: [
      { id: 'general',     label: 'استفسار عام' },
      { id: 'support',     label: 'دعم فني' },
      { id: 'billing',     label: 'الباقات والأسعار' },
      { id: 'refund',      label: 'الاسترداد' },
      { id: 'partnership', label: 'الشراكات' },
    ],
    channelsTitle: 'القنوات',
    emailLabel: 'البريد الإلكتروني',
    supportLabel: 'الدعم',
    supportNote: 'الرد خلال أيام العمل',
    privacyLabel: 'الخصوصية والاستفسارات',
    privacyNote: 'عبر نفس البريد',
    hoursTitle: 'ساعات العمل',
    hoursDays: 'الأحد – الخميس',
    hoursTime: '9:00 ص – 6:00 م',
    hoursTz: 'GMT+3 توقيت السعودية',
    companyTitle: 'معلومات الشركة',
    crLabel: 'السجل التجاري',
    locationLabel: 'الموقع',
    formEyebrow: 'أرسل استفسارك',
    nameLabel: 'الاسم الكامل *',
    namePh: 'اسمك',
    emailFieldLabel: 'البريد الإلكتروني *',
    typeLabel: 'نوع الاستفسار',
    subjectLabel: 'موضوع الاستفسار *',
    subjectPh: 'مثلاً: استفسار عن الباقات',
    messageLabel: 'تفاصيل الاستفسار *',
    messagePh: 'اكتب استفسارك هنا...',
    submitBtn: 'إرسال الاستفسار',
    submitNote: '✓ عادةً نرد خلال أقل من 24 ساعة في أيام العمل',
    mailtoNote: 'يفتح هذا الزر برنامج البريد الافتراضي مع رسالة معبأة مسبقاً',
    successTitle: 'تم فتح بريدك',
    successBody: 'إذا لم يفتح برنامج البريد تلقائياً، أرسل استفسارك مباشرة على',
    sendAnother: 'إرسال استفسار آخر',
    payloadName: 'الاسم',
    payloadEmail: 'البريد',
    payloadType: 'النوع',
  },
  en: {
    eyebrow: 'CONTACT',
    h1: 'Contact us',
    sub: "Wassel's team is ready to answer your questions and help you during business days",
    rtNote: 'Average response time under 24 hours',
    types: [
      { id: 'general',     label: 'General inquiry' },
      { id: 'support',     label: 'Technical support' },
      { id: 'billing',     label: 'Plans & pricing' },
      { id: 'refund',      label: 'Refunds' },
      { id: 'partnership', label: 'Partnerships' },
    ],
    channelsTitle: 'Channels',
    emailLabel: 'Email',
    supportLabel: 'Support',
    supportNote: 'Replies during business days',
    privacyLabel: 'Privacy & inquiries',
    privacyNote: 'Via the same email',
    hoursTitle: 'Business hours',
    hoursDays: 'Sunday – Thursday',
    hoursTime: '9:00 AM – 6:00 PM',
    hoursTz: 'GMT+3 Saudi time',
    companyTitle: 'Company info',
    crLabel: 'Commercial registration',
    locationLabel: 'Location',
    formEyebrow: 'Send your inquiry',
    nameLabel: 'Full name *',
    namePh: 'Your name',
    emailFieldLabel: 'Email *',
    typeLabel: 'Inquiry type',
    subjectLabel: 'Subject *',
    subjectPh: 'e.g. Pricing inquiry',
    messageLabel: 'Details *',
    messagePh: 'Write your inquiry here...',
    submitBtn: 'Send inquiry',
    submitNote: '✓ We usually reply in under 24 hours during business days',
    mailtoNote: 'This button opens your default mail client with the message pre-filled',
    successTitle: 'Your mail client opened',
    successBody: 'If it did not open automatically, send your inquiry directly to',
    sendAnother: 'Send another inquiry',
    payloadName: 'Name',
    payloadEmail: 'Email',
    payloadType: 'Type',
  },
} as const;

function buildMailto(opts: {
  name: string;
  email: string;
  typeId: string;
  typeLabel: string;
  subject: string;
  message: string;
  payloadName: string;
  payloadEmail: string;
  payloadType: string;
}): string {
  const subjectLine = `[${opts.typeLabel}] ${opts.subject}`.trim();
  const body = [
    `${opts.payloadName}: ${opts.name}`,
    `${opts.payloadEmail}: ${opts.email}`,
    `${opts.payloadType}: ${opts.typeLabel}`,
    '',
    opts.message,
  ].join('\n');
  const params = new URLSearchParams({ subject: subjectLine, body });
  return `mailto:${COMPANY_LEGAL_INFO.email}?${params.toString()}`;
}

export default function Contact() {
  const { i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const t = isAr ? COPY.ar : COPY.en;

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
    const typeLabel = t.types.find((x) => x.id === type)?.label ?? type;
    const href = buildMailto({
      name: name.trim(),
      email: email.trim(),
      typeId: type,
      typeLabel,
      subject: subject.trim(),
      message: message.trim(),
      payloadName: t.payloadName,
      payloadEmail: t.payloadEmail,
      payloadType: t.payloadType,
    });
    window.location.href = href;
    setSubmitted(true);
  }

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
          <p className="mt-3 font-ar leading-relaxed text-v2-body text-[15px] lg:text-[17px] max-w-[600px]">
            {t.sub}
          </p>
          <p className="mt-2 font-ar text-[13px] text-v2-dim">{t.rtNote}</p>
        </section>

        <div className="lg:grid lg:grid-cols-[1fr_1.2fr] lg:gap-8 lg:max-w-[1100px] lg:mx-auto">
          {/* INFO */}
          <div>
            <Card padding="lg" radius="lg" className="mb-4">
              <Eyebrow className="mb-3 block">{t.channelsTitle}</Eyebrow>
              <div className="flex flex-col gap-3 font-ar text-[13px] lg:text-[14px]">
                <div>
                  <div className="text-v2-dim">{t.emailLabel}</div>
                  <a
                    href={`mailto:${COMPANY_LEGAL_INFO.email}`}
                    className="text-teal-700 hover:text-teal-800 font-semibold underline-offset-2 hover:underline"
                  >
                    {COMPANY_LEGAL_INFO.email}
                  </a>
                </div>
                <div>
                  <div className="text-v2-dim">{t.supportLabel}</div>
                  <div className="text-v2-ink">{t.supportNote}</div>
                </div>
                <div>
                  <div className="text-v2-dim">{t.privacyLabel}</div>
                  <div className="text-v2-ink">{t.privacyNote}</div>
                </div>
              </div>
            </Card>

            <Card padding="lg" radius="lg" className="mb-4">
              <Eyebrow className="mb-3 block">{t.hoursTitle}</Eyebrow>
              <div className="font-ar text-[14px] font-semibold text-v2-ink">{t.hoursDays}</div>
              <div className="mt-0.5 font-ar text-[14px] text-v2-ink">{t.hoursTime}</div>
              <div className="mt-2 font-ar text-[13px] text-v2-dim">{t.hoursTz}</div>
            </Card>

            <Card padding="lg" radius="lg">
              <Eyebrow className="mb-3 block">{t.companyTitle}</Eyebrow>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 font-ar text-[13px] text-v2-body lg:text-[14px]">
                {COMPANY_LEGAL_INFO.commercialRegistration && (
                  <li>
                    <span className="text-v2-dim">{t.crLabel} · </span>
                    <span className="font-semibold text-v2-ink" dir="ltr">{COMPANY_LEGAL_INFO.commercialRegistration}</span>
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
                  <h2 className="mt-4 font-ar text-[20px] font-bold text-v2-ink">{t.successTitle}</h2>
                  <p className="mt-2 font-ar text-[14px] text-v2-body">
                    {t.successBody}
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
                    {t.sendAnother}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                  <Eyebrow className="block">{t.formEyebrow}</Eyebrow>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input
                      label={t.nameLabel}
                      placeholder={t.namePh}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                    <Input
                      label={t.emailFieldLabel}
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
                      {t.typeLabel}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {t.types.map((opt) => {
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
                    label={t.subjectLabel}
                    placeholder={t.subjectPh}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />

                  <div>
                    <label className="mb-2 block font-ar text-[13px] font-semibold text-v2-ink">
                      {t.messageLabel}
                    </label>
                    <textarea
                      required
                      rows={6}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t.messagePh}
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
                    {t.submitBtn}
                  </Button>
                  <p className="text-center font-ar text-[12px] text-teal-700 font-semibold">
                    {t.submitNote}
                  </p>
                  <p className="text-center font-ar text-[11px] text-v2-dim">
                    {t.mailtoNote}
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
