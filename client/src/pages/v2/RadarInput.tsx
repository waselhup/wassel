import { useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Button from '@/components/v2/Button';
import Input from '@/components/v2/Input';
import Pill from '@/components/v2/Pill';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import LiveDot from '@/components/v2/LiveDot';
import NumDisplay from '@/components/v2/NumDisplay';
import { useJobs } from '@/lib/v2/jobs';

type Step = 1 | 2 | 3;

interface Option {
  id: string;
  label: string;
}

const GOALS: Option[] = [
  { id: 'promotion',      label: 'ترقية' },
  { id: 'personal-brand', label: 'علامة شخصية' },
  { id: 'job-search',     label: 'بحث عن وظيفة' },
  { id: 'networking',     label: 'شبكة علاقات' },
  { id: 'freelance',      label: 'عمل حر' },
];

const INDUSTRIES: Option[] = [
  { id: 'tech',     label: 'تقنية' },
  { id: 'finance',  label: 'تمويل' },
  { id: 'energy',   label: 'طاقة' },
  { id: 'health',   label: 'صحة' },
  { id: 'retail',   label: 'تجزئة' },
  { id: 'media',    label: 'إعلام' },
  { id: 'consult',  label: 'استشارات' },
];

const COST = 25;
const BALANCE = 240;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'الهدف' },
  { n: 2, label: 'الأهداف' },
  { n: 3, label: 'تأكيد' },
];

function RadarInput() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { addJob } = useJobs();
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState('Senior Product Manager');
  const [company, setCompany] = useState('Aramco Digital');
  const [linkedinSlug, setLinkedinSlug] = useState('mohammed-otaibi');
  const [goals, setGoals] = useState<string[]>(['promotion', 'personal-brand']);
  const [industries, setIndustries] = useState<string[]>(['tech']);

  const toggle = (list: string[], setter: (next: string[]) => void) => (id: string) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };
  const toggleGoal = toggle(goals, setGoals);
  const toggleIndustry = toggle(industries, setIndustries);

  const next = () => {
    if (step < 3) {
      setStep((step + 1) as Step);
      return;
    }
    const job = addJob({
      type: 'analysis',
      title: `تحليل البروفايل · ${role}`,
      durationMs: 7500,
      resultUrl: `/v2/analyze/result/mock-001`,
    });
    navigate(`/v2/analyze/loading?jobId=${encodeURIComponent(job.id)}`);
  };
  const back = () => {
    if (step > 1) setStep((step - 1) as Step);
    else navigate('/v2/home');
  };

  return (
    <Phone>
      <Topbar
        back
        onBack={back}
        eyebrow={<>STEP <NumDisplay>{`0${step} / 03`}</NumDisplay></>}
        title={t('v2.radar.input.title', 'إعداد الرادار')}
        trailing={
          <button
            type="button"
            aria-label="مساعدة"
            className="flex h-9 w-9 items-center justify-center rounded-v2-pill text-v2-dim hover:bg-v2-canvas-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M8 5.5 V8.5 M8 10.5 H8.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        }
      />

      {/* Mobile thin progress bar */}
      <div className="px-1.5 pt-3 lg:hidden">
        <div className="mx-[22px] flex gap-1">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`h-[3px] flex-1 rounded-full transition-colors duration-200 ease-out ${
                s <= step ? 'bg-teal-500' : 'bg-v2-line'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Desktop horizontal stepper */}
      <div className="hidden lg:block lg:pt-2 lg:pb-6">
        <ol className="flex items-center justify-center gap-3">
          {STEPS.map(({ n, label }, i) => {
            const done = n < step;
            const current = n === step;
            return (
              <li key={n} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 items-center justify-center rounded-full font-en text-[12px] font-bold transition-colors duration-200 ease-out ${
                      done
                        ? 'bg-teal-600 text-white'
                        : current
                          ? 'bg-teal-50 border border-teal-300 text-teal-700'
                          : 'bg-v2-canvas-2 text-v2-mute'
                    }`}
                  >
                    {done ? '✓' : n}
                  </span>
                  <span
                    className={`font-ar text-[13px] ${
                      current ? 'font-semibold text-v2-ink' : done ? 'text-v2-body' : 'text-v2-dim'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <span aria-hidden="true" className={`block h-px w-10 ${done ? 'bg-teal-500' : 'bg-v2-line'}`} />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Mobile: single column. Desktop: 60/40 split — form right (RTL), preview left. */}
      <div className="flex-1 px-[22px] pt-6 pb-[120px] lg:px-0 lg:pt-0 lg:pb-0 lg:grid lg:grid-cols-12 lg:gap-8">

        {/* FORM column — desktop col-span-7 (~58%) */}
        <div className="lg:col-span-7">
          <div className="mb-6 lg:mb-8">
            <Pill
              as="span"
              tone="teal"
              size="sm"
              leadingIcon={<LiveDot />}
              className="mb-3"
            >
              PROFILE RADAR
            </Pill>
            <h1 className="font-ar font-bold leading-tight text-v2-ink text-[26px] lg:text-[36px]">
              {step === 1 && 'وجّه الرادار'}
              {step === 2 && 'حدّد الأهداف'}
              {step === 3 && 'تأكيد الإعدادات'}
            </h1>
            <p className="mt-1.5 font-ar leading-relaxed text-v2-body text-[13px] lg:mt-3 lg:text-[15px]">
              {step === 1 && 'نحلّل بروفايلك مقابل دور مستهدف، وتحصل على 3 تعديلات بأعلى أثر.'}
              {step === 2 && 'الأهداف والقطاعات ترفع دقة التوصيات وتحسن المقارنات.'}
              {step === 3 && 'راجع الإعدادات قبل بدء التحليل.'}
            </p>
          </div>

          {step === 1 && (
            <div className="flex flex-col gap-5 lg:gap-6">
              <div>
                <Eyebrow className="mb-2.5 block">LINKEDIN</Eyebrow>
                <Input
                  dir="ltr"
                  leadingSlot="linkedin.com/in/"
                  value={linkedinSlug}
                  onChange={(e) => setLinkedinSlug(e.target.value)}
                  trailingSlot={
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M3 7 L6 10 L11 4" stroke="var(--teal-600)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                />
              </div>
              <div>
                <Eyebrow className="mb-2.5 block">TARGET ROLE</Eyebrow>
                <Input
                  dir="ltr"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Senior Product Manager"
                />
              </div>
              <div>
                <Eyebrow className="mb-2.5 block">COMPANY · OPTIONAL</Eyebrow>
                <Input
                  dir="ltr"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Aramco Digital"
                />
                <p className="mt-2 font-ar text-[12px] text-v2-dim">
                  مقارنة مقابل شركة محددة ترفع دقة التحليل بـ{' '}
                  <NumDisplay className="font-semibold text-teal-700">+34%</NumDisplay>
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-6 lg:gap-8">
              <div>
                <div className="mb-2.5 flex items-baseline justify-between lg:mb-3">
                  <Eyebrow>GOALS</Eyebrow>
                  <span className="font-ar text-[12px] text-v2-dim">اختر واحداً على الأقل</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {GOALS.map((g) => (
                    <Pill
                      key={g.id}
                      tone="teal"
                      size="md"
                      selected={goals.includes(g.id)}
                      onClick={() => toggleGoal(g.id)}
                    >
                      {g.label}
                    </Pill>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2.5 flex items-baseline justify-between lg:mb-3">
                  <Eyebrow>INDUSTRY</Eyebrow>
                  <span className="font-ar text-[12px] text-v2-dim">اختر قطاعاً واحداً أو أكثر</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map((i) => (
                    <Pill
                      key={i.id}
                      tone="neutral"
                      size="md"
                      selected={industries.includes(i.id)}
                      onClick={() => toggleIndustry(i.id)}
                    >
                      {i.label}
                    </Pill>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3 lg:gap-4">
              <Card padding="md" radius="md">
                <Eyebrow>LINKEDIN</Eyebrow>
                <p className="mt-1 font-en text-[14px] text-v2-ink-2 break-all">
                  linkedin.com/in/{linkedinSlug}
                </p>
              </Card>
              <Card padding="md" radius="md">
                <Eyebrow>TARGET ROLE</Eyebrow>
                <p className="mt-1 font-en text-[14px] font-semibold text-v2-ink">{role}</p>
                {company && (
                  <p className="mt-0.5 font-en text-[12px] text-v2-dim">@ {company}</p>
                )}
              </Card>
              <Card padding="md" radius="md">
                <Eyebrow>GOALS</Eyebrow>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {goals.length === 0 && <span className="font-ar text-[13px] text-v2-mute">لم يُختر</span>}
                  {goals.map((id) => {
                    const g = GOALS.find((x) => x.id === id);
                    return g ? (
                      <Pill key={id} as="span" size="sm" tone="teal" selected={false}>{g.label}</Pill>
                    ) : null;
                  })}
                </div>
              </Card>
              <Card padding="md" radius="md">
                <Eyebrow>INDUSTRY</Eyebrow>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {industries.length === 0 && <span className="font-ar text-[13px] text-v2-mute">لم يُختر</span>}
                  {industries.map((id) => {
                    const ind = INDUSTRIES.find((x) => x.id === id);
                    return ind ? (
                      <Pill key={id} as="span" size="sm" tone="neutral" selected={false}>{ind.label}</Pill>
                    ) : null;
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* Desktop CTA — sits inside the form column, after content */}
          <div className="hidden lg:mt-10 lg:flex lg:items-center lg:justify-between lg:rounded-v2-lg lg:border lg:border-v2-line lg:bg-v2-surface lg:p-5">
            <div className="flex items-center gap-6">
              <div>
                <Eyebrow>COST</Eyebrow>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <NumDisplay className="text-[22px] font-bold text-v2-ink">{COST}</NumDisplay>
                  <span className="font-ar text-[12px] text-v2-dim">توكن</span>
                </div>
              </div>
              <div className="h-10 w-px bg-v2-line" />
              <div>
                <Eyebrow>BALANCE</Eyebrow>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <NumDisplay className="text-[22px] font-bold text-teal-700">{BALANCE}</NumDisplay>
                  <span className="font-ar text-[12px] text-v2-dim">متاح</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {step > 1 && (
                <Button variant="secondary" size="lg" onClick={back}>
                  السابق
                </Button>
              )}
              <Button
                variant="primary"
                size="lg"
                onClick={next}
                disabled={step === 2 && goals.length === 0}
                className="lg:px-8"
              >
                {step < 3 ? 'التالي' : (
                  <>ابدأ التحليل · <NumDisplay>{COST}</NumDisplay> توكن</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* PREVIEW column — desktop only, col-span-5 */}
        <aside className="hidden lg:block lg:col-span-5" aria-label="معاينة الإعدادات">
          <div className="sticky top-[88px]">
            <Card padding="lg" radius="lg" elevated>
              <div className="mb-4 flex items-center justify-between">
                <Eyebrow className="!text-teal-700">LIVE PREVIEW</Eyebrow>
                <LiveDot />
              </div>

              <p className="font-ar text-[14px] leading-relaxed text-v2-body">
                ستحلّل: <span className="font-semibold text-v2-ink">{linkedinSlug || 'بروفايل'}</span> مقابل دور
                {' '}<span className="font-semibold text-teal-700">{role}</span>
                {company && <> @ <span className="font-semibold text-v2-ink">{company}</span></>}.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-v2-line pt-4">
                <div>
                  <Eyebrow>GOALS</Eyebrow>
                  <NumDisplay className="mt-1 block text-[20px] font-bold text-v2-ink">
                    {goals.length}
                  </NumDisplay>
                </div>
                <div>
                  <Eyebrow>INDUSTRIES</Eyebrow>
                  <NumDisplay className="mt-1 block text-[20px] font-bold text-v2-ink">
                    {industries.length}
                  </NumDisplay>
                </div>
              </div>

              <div className="mt-5 rounded-v2-md bg-teal-50 p-3.5">
                <Eyebrow className="!text-teal-700">COST BREAKDOWN</Eyebrow>
                <ul className="mt-2 m-0 list-none p-0">
                  <li className="flex items-baseline justify-between py-1 font-ar text-[12px] text-v2-body">
                    <span>تحليل البروفايل</span>
                    <NumDisplay>15</NumDisplay>
                  </li>
                  <li className="flex items-baseline justify-between py-1 font-ar text-[12px] text-v2-body">
                    <span>مقارنة الأدوار</span>
                    <NumDisplay>10</NumDisplay>
                  </li>
                  <li className="flex items-baseline justify-between border-t border-teal-100 pt-2 mt-1 font-ar text-[13px] font-semibold text-teal-700">
                    <span>المجموع</span>
                    <NumDisplay>{COST} توكن</NumDisplay>
                  </li>
                </ul>
              </div>

              <div className="mt-5">
                <Eyebrow className="mb-2 block">للحصول على أفضل النتائج</Eyebrow>
                <ul className="m-0 list-none p-0 flex flex-col gap-1.5">
                  {[
                    'استخدم العنوان الوظيفي الفعلي على لينكدإن.',
                    'حدّد شركة هدف تنطبق على دورك.',
                    'اختر هدفين على الأقل لرفع الدقة.',
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 font-ar text-[12px] leading-relaxed text-v2-body">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="mt-1 shrink-0">
                        <path d="M2 6 L5 9 L10 3" stroke="var(--teal-600)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>
        </aside>
      </div>

      {/* Mobile sticky CTA — sits above BottomNav. Hidden on lg (CTA lives in form column). */}
      <div className="absolute inset-x-0 bottom-[78px] z-10 border-t border-v2-line bg-v2-surface px-[22px] pt-3 pb-3 lg:hidden">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <Eyebrow>COST</Eyebrow>
            <div className="mt-0.5 flex items-baseline gap-1">
              <NumDisplay className="text-[20px] font-bold text-v2-ink">{COST}</NumDisplay>
              <span className="font-ar text-[12px] text-v2-dim">توكن</span>
            </div>
          </div>
          <div className="h-8 w-px bg-v2-line" />
          <div className="text-end">
            <Eyebrow>BALANCE</Eyebrow>
            <div className="mt-0.5 flex items-baseline justify-end gap-1">
              <NumDisplay className="text-[20px] font-bold text-teal-700">{BALANCE}</NumDisplay>
              <span className="font-ar text-[12px] text-v2-dim">متاح</span>
            </div>
          </div>
        </div>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={next}
          disabled={step === 2 && goals.length === 0}
        >
          {step < 3 ? 'التالي' : (
            <>ابدأ التحليل · <NumDisplay>{COST}</NumDisplay> توكن</>
          )}
        </Button>
      </div>

      <BottomNav
        active="analyze"
        items={[
          { id: 'home',    label: 'الرئيسية', icon: <span />, onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: 'الرادار',  icon: <span />, onSelect: () => navigate('/v2/analyze') },
          { id: 'tools',   label: 'الأدوات',  icon: <span />, onSelect: () => navigate('/v2/home') },
          { id: 'profile', label: 'حسابي',    icon: <span />, onSelect: () => navigate('/v2/home') },
        ]}
        fabIcon="arrow"
        onFabClick={next}
      />
    </Phone>
  );
}

export default RadarInput;
