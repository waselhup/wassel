import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Button from '@/components/v2/Button';
import Input from '@/components/v2/Input';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';

type Tab = 'login' | 'signup';

const BrandMark = () => (
  <div className="mb-6 flex items-center gap-2 px-1 pt-1 lg:mb-8">
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="9"   stroke="var(--teal-700)" strokeWidth="1.4" />
      <circle cx="11" cy="11" r="5"   stroke="var(--teal-700)" strokeWidth="1.4" />
      <circle cx="11" cy="11" r="1.4" fill="var(--teal-700)" />
    </svg>
    <span className="font-ar text-[15px] font-bold text-v2-ink">وصّل</span>
  </div>
);

const LinkedInIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
    <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3v9zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
  </svg>
);

/** Decorative panel shown on the desktop split (start side in RTL = right). */
function VisualPanel() {
  return (
    <div className="relative hidden h-full w-full overflow-hidden rounded-v2-xl lg:block">
      {/* Gradient background per spec: teal-50 → canvas-2 */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-v2-canvas-2" />

      <div className="relative flex h-full flex-col justify-between p-12">
        {/* Brand quote / value prop */}
        <div className="max-w-[440px]">
          <Eyebrow className="mb-4 block !text-teal-700">AI · LINKEDIN GROWTH</Eyebrow>
          <p className="font-ar text-[26px] font-bold leading-[1.25] text-v2-ink">
            بروفايل أقوى يفتح
            <br />
            <span className="font-semibold text-teal-700">فرص حقيقية.</span>
          </p>
          <p className="mt-3 font-ar text-[14px] leading-relaxed text-v2-body">
            تحليل، صياغة، وسيرة ذاتية — كلها بصوتك أنت، مصمَّمة للسوق السعودي.
          </p>
        </div>

        {/* Mock dashboard preview card */}
        <div className="mx-auto w-full max-w-[440px] rounded-v2-lg border border-v2-line bg-v2-surface p-5 shadow-lift">
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow>RADAR · SCORE</Eyebrow>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 font-en text-[10px] font-bold text-teal-700">LIVE</span>
          </div>
          <div className="flex items-baseline gap-2">
            <NumDisplay className="text-[40px] font-bold leading-none text-v2-ink">88</NumDisplay>
            <NumDisplay className="text-[14px] text-v2-dim">/100</NumDisplay>
          </div>
          <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-v2-line">
            <div className="h-full rounded-full bg-teal-500" style={{ width: '88%' }} />
          </div>
          <ul className="mt-4 m-0 flex list-none flex-col gap-2 p-0">
            {[
              'العنوان المهني واضح ومختصر',
              'المهارات تتطابق مع الدور المستهدف',
              'منشورات نشطة آخر 30 يوم',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 font-ar text-[12px] text-v2-body">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
                  <path d="M3 7 L6 10 L11 4" stroke="var(--teal-700)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Testimonial */}
        <figure className="max-w-[440px]">
          <blockquote className="font-ar text-[14px] leading-relaxed text-v2-body">
            «وصّل ساعدني أعيد صياغة بروفايلي قبل مقابلة مهمة. الفرق واضح في عدد رسائل
            التوظيف اللي وصلتني.»
          </blockquote>
          <figcaption className="mt-3 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 font-ar text-[13px] font-bold text-white"
            >
              س
            </span>
            <div className="font-ar">
              <div className="text-[13px] font-semibold text-v2-ink">سارة العنزي</div>
              <div className="text-[11px] text-v2-dim">مديرة منتج · الرياض</div>
            </div>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

function Auth() {
  const [, navigate] = useLocation();
  const [matchSignup] = useRoute('/v2/signup');
  const [tab, setTab] = useState<Tab>(matchSignup ? 'signup' : 'login');
  const { t } = useTranslation();

  useEffect(() => {
    setTab(matchSignup ? 'signup' : 'login');
  }, [matchSignup]);

  const switchTab = (next: Tab) => {
    setTab(next);
    navigate(next === 'signup' ? '/v2/signup' : '/v2/login');
  };

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(true);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/v2/home');
  };

  const isSignup = tab === 'signup';

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2')}
        title={isSignup ? t('v2.auth.signupTitle', 'إنشاء حساب') : t('v2.auth.loginTitle', 'تسجيل الدخول')}
        bg="canvas"
        showPulse={false}
        showJobsIndicator={false}
      />

      {/* Mobile: single column. Desktop: 50/50 split with visual panel on the
          start side (right in RTL) and form on the end side (left in RTL). */}
      <div className="flex-1 px-[22px] pb-10 lg:flex lg:items-stretch lg:gap-12 lg:px-0 lg:pb-0 lg:py-10">

        {/* Visual panel — desktop only, start side (RTL: right) */}
        <div className="lg:order-1 lg:flex-1 lg:min-w-0">
          <VisualPanel />
        </div>

        {/* Form column */}
        <div className="lg:order-2 lg:flex lg:flex-1 lg:items-center lg:justify-center lg:py-12">
          <div className="lg:w-full lg:max-w-[420px]">
            <BrandMark />

            <h1 className="font-ar font-bold leading-tight text-v2-ink text-[26px] lg:text-[32px]">
              {isSignup ? t('v2.auth.signupHeading', 'ابدأ معنا.') : t('v2.auth.loginHeading', 'مرحباً بعودتك.')}
            </h1>
            <p className="mt-2 mb-6 font-ar leading-relaxed text-v2-body text-[13px] lg:mb-8 lg:text-[14px]">
              {isSignup
                ? 'أنشئ حساباً مجانياً · 100 توكن للبداية.'
                : 'سجّل الدخول لمتابعة العمل.'}
            </p>

            <div className="mb-6 grid grid-cols-2 gap-1 rounded-v2-md border border-v2-line bg-v2-canvas-2 p-1 lg:mb-8">
              {(['signup', 'login'] as Tab[]).map((k) => {
                const active = tab === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => switchTab(k)}
                    className={`rounded-v2-sm px-3 py-2.5 font-ar text-[13px] cursor-pointer transition-all duration-200 ease-out ${
                      active
                        ? 'bg-v2-surface text-v2-ink font-semibold shadow-card'
                        : 'bg-transparent text-v2-dim font-medium hover:text-v2-body'
                    }`}
                  >
                    {k === 'signup' ? 'إنشاء حساب' : 'تسجيل الدخول'}
                  </button>
                );
              })}
            </div>

            <form onSubmit={submit} className="flex flex-col gap-3.5 lg:gap-4">
              {isSignup && (
                <Input
                  label="الاسم الكامل"
                  placeholder="محمد العتيبي"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}
              <Input
                label="البريد الإلكتروني"
                dir="ltr"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="كلمة المرور"
                dir="ltr"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {!isSignup && (
                <div className="-mt-1 text-start">
                  <button
                    type="button"
                    className="font-ar text-[12px] font-semibold text-teal-700 hover:text-teal-600 cursor-pointer"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
              )}

              {isSignup && (
                <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal-600"
                  />
                  <span className="font-ar text-[12px] leading-relaxed text-v2-dim">
                    أوافق على{' '}
                    <span className="text-v2-ink underline underline-offset-2">الشروط</span>{' '}
                    و{' '}
                    <span className="text-v2-ink underline underline-offset-2">الخصوصية</span>.
                  </span>
                </label>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={isSignup && !agree}
                className="mt-2"
              >
                {isSignup ? t('v2.auth.submitSignup', 'أنشئ حساب') : t('v2.auth.submitLogin', 'تسجيل الدخول')}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 lg:my-6">
              <div className="h-px flex-1 bg-v2-line" />
              <Eyebrow>أو</Eyebrow>
              <div className="h-px flex-1 bg-v2-line" />
            </div>

            <button
              type="button"
              onClick={() => navigate('/v2/home')}
              className="flex w-full items-center justify-center gap-2.5 rounded-v2-md bg-[#0A66C2] px-4 py-3.5 font-ar text-[14px] font-semibold text-white cursor-pointer transition-opacity duration-200 ease-out hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A66C2]/40"
            >
              {LinkedInIcon}
              المتابعة عبر LinkedIn
            </button>

            <p className="mt-6 text-center font-ar text-[12px] text-v2-dim">
              {isSignup ? 'عندك حساب؟ ' : 'لا تملك حساباً؟ '}
              <button
                type="button"
                onClick={() => switchTab(isSignup ? 'login' : 'signup')}
                className="font-semibold text-teal-700 hover:text-teal-600 cursor-pointer"
              >
                {isSignup ? 'تسجيل الدخول' : 'إنشاء حساب'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </Phone>
  );
}

export default Auth;
