import { useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Card from '@/components/v2/Card';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import Skeleton, { useInitialLoading } from '@/components/v2/Skeleton';

type Tab = 'summary' | 'sections' | 'recs' | 'rivals';

interface SectionData {
  key: string;
  label: string;
  score: number;
  hint: string;
}

interface Recommendation {
  impact: string;
  title: string;
  detail: string;
  effort: string;
}

interface Rival {
  initials: string;
  name: string;
  role: string;
  score: number;
  delta: string;
}

const SECTIONS: SectionData[] = [
  { key: 'intro',     label: 'المقدمة',           score: 78, hint: 'واضحة — يمكن إبراز التخصص أكثر' },
  { key: 'experience', label: 'الخبرة',          score: 92, hint: 'قوية · 5 إنجازات قابلة للقياس' },
  { key: 'skills',    label: 'المهارات',           score: 71, hint: '4 مهارات خارج المجال' },
  { key: 'activity',  label: 'النشاط',             score: 48, hint: 'آخر منشور قبل 41 يوماً' },
  { key: 'network',   label: 'الشبكة',             score: 84, hint: 'متوازنة وقوية في التقنية' },
  { key: 'recs',      label: 'التوصيات',           score: 88, hint: 'موثّقة من 7 زملاء' },
  { key: 'education', label: 'التعليم',            score: 82, hint: 'KFUPM · مكتمل' },
];

const RECS: Recommendation[] = [
  {
    impact: '+12',
    title: 'أعد كتابة العنوان المهني',
    detail: 'العنوان "Senior PM" عام — أضف تخصصاً مثل "Senior PM · Data Platforms · Aramco Digital".',
    effort: 'دقيقة',
  },
  {
    impact: '+8',
    title: 'انشر مرّتين أسبوعياً عن عملك',
    detail: 'آخر منشور قبل 41 يوماً — منشوران أسبوعياً يرفعان الظهور 3x.',
    effort: 'أسبوعي',
  },
  {
    impact: '+5',
    title: 'احذف 4 مهارات خارج المجال',
    detail: 'مهارات لا تخدم دور Senior PM تُضعف الإشارة وتُربك خوارزمية البحث.',
    effort: 'دقيقتان',
  },
];

const RIVALS: Rival[] = [
  { initials: 'AK', name: 'أحمد الخالدي',   role: 'Senior PM · STC',          score: 84, delta: '+4' },
  { initials: 'NS', name: 'نورة السبيعي',    role: 'Senior PM · NEOM',         score: 79, delta: '+9' },
  { initials: 'OM', name: 'عمر المالكي',     role: 'Senior PM · SABIC',        score: 76, delta: '+12' },
  { initials: 'FH', name: 'فهد الهاجري',     role: 'Senior PM · Aramco',       score: 72, delta: '+16' },
];

const SCORE = 88;
const ROLE_AVG = 61;

const tabs: { id: Tab; label: string }[] = [
  { id: 'summary',  label: 'ملخص' },
  { id: 'sections', label: 'الأقسام' },
  { id: 'recs',     label: 'التوصيات' },
  { id: 'rivals',   label: 'المنافسون' },
];

function radialPoints(scores: number[]) {
  return scores
    .map((v, i) => {
      const deg = -90 + (360 / scores.length) * i;
      const r = (v / 100) * 50;
      const x = Math.cos((deg * Math.PI) / 180) * r;
      const y = Math.sin((deg * Math.PI) / 180) * r;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function ScoreRing({ score }: { score: number }) {
  // 64px radius, stroke 6px, circumference ~ 402
  const r = 64;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div className="relative h-[160px] w-[160px]">
      <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden="true">
        <circle cx="80" cy="80" r={r} stroke="var(--line)" strokeWidth="6" fill="none" />
        <circle
          cx="80"
          cy="80"
          r={r}
          stroke="var(--teal-500)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 80 80)"
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <NumDisplay className="text-[44px] font-bold leading-none text-v2-ink">{score}</NumDisplay>
        <span className="font-ar text-[12px] text-v2-dim">/<NumDisplay>100</NumDisplay></span>
      </div>
    </div>
  );
}

function RadialChart({ scores }: { scores: number[] }) {
  return (
    <svg width="120" height="120" viewBox="-60 -60 120 120" aria-hidden="true">
      {[20, 40, 60].map((rr) => (
        <circle key={rr} cx="0" cy="0" r={rr} fill="none" stroke="var(--line)" strokeWidth="0.8" />
      ))}
      {scores.map((_, i) => {
        const deg = -90 + (360 / scores.length) * i;
        const x = Math.cos((deg * Math.PI) / 180) * 60;
        const y = Math.sin((deg * Math.PI) / 180) * 60;
        return <line key={i} x1="0" y1="0" x2={x} y2={y} stroke="var(--line)" strokeWidth="0.6" />;
      })}
      <polygon
        points={radialPoints(scores)}
        fill="var(--teal-500)"
        fillOpacity="0.15"
        stroke="var(--teal-600)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {scores.map((v, i) => {
        const deg = -90 + (360 / scores.length) * i;
        const r = (v / 100) * 50;
        const x = Math.cos((deg * Math.PI) / 180) * r;
        const y = Math.sin((deg * Math.PI) / 180) * r;
        return <circle key={i} cx={x} cy={y} r="2" fill="var(--teal-600)" />;
      })}
    </svg>
  );
}

function RadarResult() {
  const [, navigate] = useLocation();
  const [, params] = useRoute<{ id: string }>('/v2/analyze/result/:id');
  // i18n prep — namespace v2.radar.result.*. TODO(i18n): section labels from API.
  const { t: _t } = useTranslation();
  const [tab, setTab] = useState<Tab>('summary');
  const loading = useInitialLoading(800);

  const id = params?.id ?? 'mock-001';
  const sectionScores = SECTIONS.slice(0, 6).map((s) => s.score);

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2/home')}
        title={
          <span className="inline-flex items-center gap-1.5">
            <span className="font-en text-[10.5px] font-semibold uppercase tracking-[0.14em] text-teal-700">
              RADAR · COMPLETE
            </span>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 6 L5 9 L10 3" stroke="var(--teal-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        }
        trailing={
          <button
            type="button"
            aria-label="مشاركة"
            className="flex h-9 w-9 items-center justify-center rounded-v2-pill text-v2-dim hover:bg-v2-canvas-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2 V10 M5 7 L8 10 L11 7 M3 13 H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto pb-[110px]">
        {loading ? (
          <div className="px-[22px] pt-6">
            <Skeleton variant="text" width={140} className="mb-4" />
            <div className="mb-5 flex items-center gap-5">
              <Skeleton variant="avatar" className="!h-[120px] !w-[120px]" />
              <div className="flex-1">
                <Skeleton variant="text" lines={3} />
              </div>
            </div>
            <Skeleton variant="card" className="mb-3" />
            <Skeleton variant="card" />
          </div>
        ) : (
        <>
        <div className="border-b border-v2-line bg-v2-canvas px-[22px] pt-6 pb-5">
          <Eyebrow className="mb-3 block">
            VS · <span className="font-en">SENIOR PM</span> · <span className="font-en">ARAMCO DIGITAL</span>
          </Eyebrow>
          <div className="flex items-center gap-5">
            <ScoreRing score={SCORE} />
            <div className="flex-1">
              <Eyebrow>OVERALL</Eyebrow>
              <p className="mt-1 font-ar text-[14px] leading-relaxed text-v2-body">
                <span className="font-semibold text-teal-700">قوي جداً</span> — أعلى من{' '}
                <NumDisplay className="font-semibold text-v2-ink">+27</NumDisplay> نقطة من متوسط الدور.
              </p>
              <p className="mt-1 font-ar text-[12px] text-v2-dim">
                التقرير #<NumDisplay isolated>{id}</NumDisplay>
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <div className="flex-1">
              <Eyebrow>YOU</Eyebrow>
              <NumDisplay className="mt-1 block text-[16px] font-semibold text-teal-700">{SCORE}</NumDisplay>
            </div>
            <div className="w-px self-stretch bg-v2-line" />
            <div className="flex-1">
              <Eyebrow>ROLE AVG</Eyebrow>
              <NumDisplay className="mt-1 block text-[16px] font-semibold text-v2-body">{ROLE_AVG}</NumDisplay>
            </div>
            <div className="w-px self-stretch bg-v2-line" />
            <div className="flex-1">
              <Eyebrow>POTENTIAL</Eyebrow>
              <NumDisplay className="mt-1 block text-[16px] font-semibold text-v2-ink">+12</NumDisplay>
            </div>
          </div>
        </div>

        <div role="tablist" aria-label="أقسام النتيجة" className="sticky top-[52px] z-[5] flex gap-6 border-b border-v2-line bg-v2-canvas px-[22px] pt-3.5 overflow-x-auto">
          {tabs.map((tb) => {
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(tb.id)}
                className={`shrink-0 -mb-px border-b-2 px-0 py-2.5 font-ar text-[13px] cursor-pointer transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 ${
                  active
                    ? 'border-teal-600 text-v2-ink font-semibold'
                    : 'border-transparent text-v2-dim hover:text-v2-body'
                }`}
              >
                {tb.label}
              </button>
            );
          })}
        </div>

        {tab === 'summary' && (
          <div className="px-[22px] py-5">
            <Card padding="md" radius="lg" elevated className="mb-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Eyebrow>SHAPE</Eyebrow>
                  <p className="mt-1 font-ar text-[14px] leading-relaxed text-v2-body">
                    خبرة وتوصيات قوية، النشاط أضعف نقطة. الفجوة الرئيسية في الظهور المنتظم.
                  </p>
                </div>
                <RadialChart scores={sectionScores} />
              </div>
            </Card>

            <h2 className="mb-3 font-ar text-[17px] font-semibold text-v2-ink">أبرز التوصيات</h2>
            <div className="flex flex-col gap-2.5">
              {RECS.slice(0, 2).map((r) => (
                <Card key={r.title} padding="md" radius="md" elevated>
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5">
                      <NumDisplay className="text-[12px] font-bold text-teal-700">{r.impact}</NumDisplay>
                    </span>
                    <span className="flex-1 font-ar text-[14px] font-semibold text-v2-ink">{r.title}</span>
                  </div>
                  <p className="font-ar text-[13px] leading-relaxed text-v2-body">{r.detail}</p>
                </Card>
              ))}
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => setTab('recs')}
              >
                عرض التوصيات الكاملة
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="md">
                تصدير PDF
              </Button>
              <Button variant="secondary" size="md">
                تصدير DOCX
              </Button>
            </div>
          </div>
        )}

        {tab === 'sections' && (
          <div className="px-[22px] py-5">
            <Eyebrow className="mb-3 block">
              SECTIONS · <NumDisplay>{`0${SECTIONS.length}`}</NumDisplay>
            </Eyebrow>
            <div
              className="flex gap-3 overflow-x-auto pb-2 -mx-[22px] px-[22px] snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none' }}
            >
              {SECTIONS.map((s, i) => {
                const tone =
                  s.score >= 85 ? 'text-teal-700 border-teal-300 bg-teal-50' :
                  s.score >= 70 ? 'text-v2-ink border-v2-line bg-v2-surface' :
                  'text-v2-amber border-v2-amber/40 bg-v2-amber-50';
                return (
                  <Card
                    key={s.key}
                    padding="md"
                    radius="md"
                    className={`min-w-[170px] snap-start ${tone}`}
                  >
                    <Eyebrow className="!text-current opacity-80">
                      <NumDisplay>{`0${i + 1}`}</NumDisplay>
                    </Eyebrow>
                    <div className="mt-1 font-ar text-[15px] font-semibold">{s.label}</div>
                    <NumDisplay className="mt-2 block text-[28px] font-bold leading-none">
                      {s.score}
                    </NumDisplay>
                    <p className="mt-2 font-ar text-[12px] leading-relaxed opacity-80">{s.hint}</p>
                  </Card>
                );
              })}
            </div>

            <h3 className="mt-6 mb-3 font-ar text-[15px] font-semibold text-v2-ink">القائمة الكاملة</h3>
            <div className="flex flex-col">
              {SECTIONS.map((s, i) => {
                const tone =
                  s.score >= 85 ? 'text-teal-700' :
                  s.score >= 70 ? 'text-v2-ink' :
                  'text-v2-amber';
                return (
                  <div
                    key={s.key}
                    className={`grid grid-cols-[28px_1fr_60px_36px] items-center gap-3 border-b border-v2-line py-3.5 ${
                      i === 0 ? 'border-t' : ''
                    }`}
                  >
                    <NumDisplay className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-v2-dim">
                      {`0${i + 1}`}
                    </NumDisplay>
                    <div className="font-ar">
                      <span className="block text-[14px] font-semibold text-v2-ink">{s.label}</span>
                      <span className="block text-[12px] text-v2-dim">{s.hint}</span>
                    </div>
                    <div className="h-1 rounded-full bg-v2-line">
                      <div
                        className={`h-full rounded-full ${
                          s.score >= 85 ? 'bg-teal-600' : s.score >= 70 ? 'bg-v2-ink' : 'bg-v2-amber'
                        }`}
                        style={{ width: `${s.score}%` }}
                      />
                    </div>
                    <NumDisplay className={`text-end text-[15px] font-bold ${tone}`}>
                      {s.score}
                    </NumDisplay>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'recs' && (
          <div className="px-[22px] py-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-ar text-[17px] font-semibold text-v2-ink">أعلى 3 تعديلات بأثر</h2>
              <Eyebrow>+25 POTENTIAL</Eyebrow>
            </div>
            <div className="flex flex-col gap-2.5">
              {RECS.map((r) => (
                <Card key={r.title} padding="md" radius="md" elevated>
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5">
                      <NumDisplay className="text-[12px] font-bold text-teal-700">{r.impact}</NumDisplay>
                    </span>
                    <span className="flex-1 font-ar text-[15px] font-semibold text-v2-ink">{r.title}</span>
                  </div>
                  <p className="mb-3 font-ar text-[13px] leading-relaxed text-v2-body">{r.detail}</p>
                  <div className="flex items-center justify-between">
                    <Eyebrow>EFFORT · {r.effort}</Eyebrow>
                    <Button variant="primary" size="sm">
                      طبّق الآن
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab === 'rivals' && (
          <div className="px-[22px] py-5">
            <Eyebrow className="mb-3 block">
              RIVALS · <NumDisplay>{`0${RIVALS.length}`}</NumDisplay>
            </Eyebrow>
            <div className="flex flex-col">
              {RIVALS.map((r, i) => (
                <div
                  key={r.initials}
                  className={`grid grid-cols-[40px_1fr_56px_60px] items-center gap-3 border-b border-v2-line py-3.5 ${
                    i === 0 ? 'border-t' : ''
                  }`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-v2-canvas-2 font-en text-[12px] font-semibold text-v2-ink-2">
                    {r.initials}
                  </span>
                  <div className="font-ar">
                    <span className="block text-[14px] font-semibold text-v2-ink">{r.name}</span>
                    <span className="block text-[12px] text-v2-dim">{r.role}</span>
                  </div>
                  <NumDisplay className="text-end text-[16px] font-bold text-v2-ink">{r.score}</NumDisplay>
                  <span className="text-end font-en text-[12px] font-semibold text-teal-700">{r.delta}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
        )}
      </div>

      <BottomNav
        active="analyze"
        items={[
          { id: 'home',    label: 'الرئيسية', icon: <span />, onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: 'الرادار',  icon: <span />, onSelect: () => navigate('/v2/analyze') },
          { id: 'tools',   label: 'الأدوات',  icon: <span />, onSelect: () => navigate('/v2/home') },
          { id: 'profile', label: 'حسابي',    icon: <span />, onSelect: () => navigate('/v2/home') },
        ]}
        fabIcon="check"
        onFabClick={() => navigate('/v2/home')}
      />
    </Phone>
  );
}

export default RadarResult;
