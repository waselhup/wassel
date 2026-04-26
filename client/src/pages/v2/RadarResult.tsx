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

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const r = size === 160 ? 64 : 88; // 160→64, 220→88
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const numClass = size === 160 ? 'text-[44px]' : 'text-[60px]';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth="6" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--teal-500)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <NumDisplay className={`${numClass} font-bold leading-none text-v2-ink`}>{score}</NumDisplay>
        <span className="font-ar text-[12px] text-v2-dim">/<NumDisplay>100</NumDisplay></span>
      </div>
    </div>
  );
}

function RadialChart({ scores, size = 120 }: { scores: number[]; size?: number }) {
  const half = size / 2;
  return (
    <svg width={size} height={size} viewBox={`-${half} -${half} ${size} ${size}`} aria-hidden="true">
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
  const { t: _t } = useTranslation();
  const [tab, setTab] = useState<Tab>('summary');
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>(SECTIONS[0]!.key);
  const loading = useInitialLoading(800);

  const id = params?.id ?? 'mock-001';
  const sectionScores = SECTIONS.slice(0, 6).map((s) => s.score);
  const selectedSection = SECTIONS.find((s) => s.key === selectedSectionKey) ?? SECTIONS[0]!;

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

      <div className="flex-1 overflow-y-auto pb-[110px] lg:overflow-visible lg:pb-0">
        {loading ? (
          <div className="px-[22px] pt-6 lg:px-0">
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
        {/* HERO — score, verdict, comparison strip. Wider on desktop with export buttons. */}
        <div className="border-b border-v2-line bg-v2-canvas px-[22px] pt-6 pb-5 lg:rounded-v2-lg lg:border lg:bg-v2-surface lg:px-8 lg:pt-7 lg:pb-7 lg:shadow-card">
          <div className="flex items-start justify-between gap-3 lg:items-center">
            <Eyebrow className="mb-3 block lg:mb-0">
              VS · <span className="font-en">SENIOR PM</span> · <span className="font-en">ARAMCO DIGITAL</span>
            </Eyebrow>
            {/* Desktop export buttons — top-right of hero */}
            <div className="hidden lg:flex lg:items-center lg:gap-2">
              <Button variant="secondary" size="sm">تصدير PDF</Button>
              <Button variant="secondary" size="sm">تصدير DOCX</Button>
            </div>
          </div>

          <div className="flex items-center gap-5 lg:gap-10">
            {/* ScoreRing — bigger on lg */}
            <div className="lg:hidden">
              <ScoreRing score={SCORE} />
            </div>
            <div className="hidden lg:block">
              <ScoreRing score={SCORE} size={220} />
            </div>

            <div className="flex-1">
              <Eyebrow>OVERALL</Eyebrow>
              <p className="mt-1 font-ar leading-relaxed text-v2-body text-[14px] lg:mt-2 lg:text-[18px]">
                <span className="font-semibold text-teal-700">قوي جداً</span> — أعلى من{' '}
                <NumDisplay className="font-semibold text-v2-ink">+27</NumDisplay> نقطة من متوسط الدور.
              </p>
              <p className="mt-1 font-ar text-[12px] text-v2-dim lg:mt-2 lg:text-[13px]">
                التقرير #<NumDisplay isolated>{id}</NumDisplay>
              </p>

              {/* Comparison strip on desktop — inline with verdict */}
              <div className="hidden lg:mt-5 lg:flex lg:gap-6">
                <div>
                  <Eyebrow>YOU</Eyebrow>
                  <NumDisplay className="mt-1 block text-[24px] font-bold text-teal-700">{SCORE}</NumDisplay>
                </div>
                <div className="w-px self-stretch bg-v2-line" />
                <div>
                  <Eyebrow>ROLE AVG</Eyebrow>
                  <NumDisplay className="mt-1 block text-[24px] font-bold text-v2-body">{ROLE_AVG}</NumDisplay>
                </div>
                <div className="w-px self-stretch bg-v2-line" />
                <div>
                  <Eyebrow>POTENTIAL</Eyebrow>
                  <NumDisplay className="mt-1 block text-[24px] font-bold text-v2-ink">+12</NumDisplay>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile comparison strip — under the row */}
          <div className="mt-4 flex gap-3 lg:hidden">
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

        {/* TABS — sticky. Mobile: top-[52px] under mobile Topbar. Desktop: top-16 under DesktopTopbar. */}
        <div role="tablist" aria-label="أقسام النتيجة"
          className="sticky top-[52px] z-[5] flex gap-6 border-b border-v2-line bg-v2-canvas px-[22px] pt-3.5 overflow-x-auto
            lg:top-16 lg:mt-6 lg:px-0 lg:pt-0 lg:gap-8"
        >
          {tabs.map((tb) => {
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(tb.id)}
                className={`shrink-0 -mb-px border-b-2 px-0 py-2.5 font-ar text-[13px] cursor-pointer transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 lg:py-4 lg:text-[14px] ${
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

        {/* SUMMARY tab */}
        {tab === 'summary' && (
          <div className="px-[22px] py-5 lg:px-0 lg:py-8 lg:grid lg:grid-cols-12 lg:gap-8">
            {/* Main column on desktop (8 cols) */}
            <div className="lg:col-span-8">
              <Card padding="md" radius="lg" elevated className="mb-4 lg:mb-6 lg:p-7">
                <div className="flex items-center justify-between gap-4 lg:gap-8">
                  <div>
                    <Eyebrow>SHAPE</Eyebrow>
                    <p className="mt-1 font-ar leading-relaxed text-v2-body text-[14px] lg:mt-2 lg:text-[15px]">
                      خبرة وتوصيات قوية، النشاط أضعف نقطة. الفجوة الرئيسية في الظهور المنتظم.
                    </p>
                  </div>
                  <div className="lg:hidden">
                    <RadialChart scores={sectionScores} />
                  </div>
                  <div className="hidden lg:block">
                    <RadialChart scores={sectionScores} size={200} />
                  </div>
                </div>
              </Card>

              <h2 className="mb-3 font-ar font-semibold text-v2-ink text-[17px] lg:mb-5 lg:text-[20px]">
                أبرز التوصيات
              </h2>
              <div className="flex flex-col gap-2.5 lg:gap-4">
                {RECS.slice(0, 2).map((r) => (
                  <Card key={r.title} padding="md" radius="md" elevated className="lg:p-5">
                    <div className="mb-2 flex items-center gap-2.5">
                      <span className="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5">
                        <NumDisplay className="text-[12px] font-bold text-teal-700">{r.impact}</NumDisplay>
                      </span>
                      <span className="flex-1 font-ar text-[14px] font-semibold text-v2-ink lg:text-[15px]">{r.title}</span>
                    </div>
                    <p className="font-ar leading-relaxed text-v2-body text-[13px] lg:text-[14px]">{r.detail}</p>
                  </Card>
                ))}
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => setTab('recs')}
                  className="lg:w-auto lg:self-start lg:px-6"
                >
                  عرض التوصيات الكاملة
                </Button>
              </div>

              {/* Mobile-only export buttons (desktop has them in hero) */}
              <div className="mt-6 grid grid-cols-2 gap-2 lg:hidden">
                <Button variant="secondary" size="md">تصدير PDF</Button>
                <Button variant="secondary" size="md">تصدير DOCX</Button>
              </div>
            </div>

            {/* Sticky right sidebar on desktop — Top 3 recommendations preview */}
            <aside className="hidden lg:col-span-4 lg:block" aria-label="ملخص جانبي">
              <div className="sticky top-[136px]">
                <Card padding="lg" radius="lg" elevated>
                  <Eyebrow className="!text-teal-700">TOP 3 IMPACT</Eyebrow>
                  <p className="mt-2 font-ar text-[13px] leading-relaxed text-v2-body">
                    إجمالي الأثر المتوقع لو طُبقت التوصيات الثلاث الأولى.
                  </p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <NumDisplay className="text-[40px] font-bold leading-none text-teal-700">+25</NumDisplay>
                    <span className="font-ar text-[13px] text-v2-dim">نقطة محتملة</span>
                  </div>
                  <ul className="mt-4 m-0 list-none p-0 flex flex-col gap-2 border-t border-v2-line pt-3">
                    {RECS.map((r) => (
                      <li key={r.title} className="flex items-center gap-2.5 font-ar text-[13px]">
                        <span className="shrink-0 rounded-full border border-teal-100 bg-teal-50 px-1.5 py-0.5">
                          <NumDisplay className="text-[11px] font-bold text-teal-700">{r.impact}</NumDisplay>
                        </span>
                        <span className="text-v2-body">{r.title}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    onClick={() => setTab('recs')}
                    className="mt-5"
                  >
                    اعرض كل التوصيات
                  </Button>
                </Card>
              </div>
            </aside>
          </div>
        )}

        {/* SECTIONS tab — desktop: 2-col list + detail panel */}
        {tab === 'sections' && (
          <div className="px-[22px] py-5 lg:px-0 lg:py-8">
            <Eyebrow className="mb-3 block lg:mb-5">
              SECTIONS · <NumDisplay>{`0${SECTIONS.length}`}</NumDisplay>
            </Eyebrow>

            {/* Mobile: horizontal carousel */}
            <div
              className="flex gap-3 overflow-x-auto pb-2 -mx-[22px] px-[22px] snap-x snap-mandatory lg:hidden"
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

            {/* Desktop: 2-col list + detail */}
            <div className="hidden lg:grid lg:grid-cols-12 lg:gap-6">
              <div className="lg:col-span-7">
                <h3 className="mb-3 font-ar text-[15px] font-semibold text-v2-ink lg:text-[17px]">القائمة الكاملة</h3>
                <div className="flex flex-col rounded-v2-md border border-v2-line bg-v2-surface overflow-hidden">
                  {SECTIONS.map((s, i) => {
                    const isSelected = s.key === selectedSectionKey;
                    const tone =
                      s.score >= 85 ? 'text-teal-700' :
                      s.score >= 70 ? 'text-v2-ink' :
                      'text-v2-amber';
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setSelectedSectionKey(s.key)}
                        className={`grid grid-cols-[28px_1fr_60px_36px] items-center gap-3 px-4 py-3.5 text-start cursor-pointer
                          border-b border-v2-line ${i === SECTIONS.length - 1 ? 'border-b-0' : ''}
                          transition-colors duration-150 ease-out
                          ${isSelected ? 'bg-teal-50' : 'hover:bg-v2-canvas-2'}`}
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
                      </button>
                    );
                  })}
                </div>
              </div>
              <aside className="lg:col-span-5" aria-label="تفاصيل القسم">
                <div className="sticky top-[136px]">
                  <Card padding="lg" radius="lg" elevated>
                    <Eyebrow className="!text-teal-700">SECTION DETAIL</Eyebrow>
                    <h3 className="mt-2 font-ar text-[22px] font-bold text-v2-ink">{selectedSection.label}</h3>
                    <div className="mt-3 flex items-baseline gap-2">
                      <NumDisplay className="text-[40px] font-bold leading-none text-v2-ink">
                        {selectedSection.score}
                      </NumDisplay>
                      <span className="font-ar text-[13px] text-v2-dim">/<NumDisplay>100</NumDisplay></span>
                    </div>
                    <div className="mt-3 h-[3px] w-full rounded-full bg-v2-line">
                      <div
                        className={`h-full rounded-full ${
                          selectedSection.score >= 85 ? 'bg-teal-600' :
                          selectedSection.score >= 70 ? 'bg-v2-ink' :
                          'bg-v2-amber'
                        }`}
                        style={{ width: `${selectedSection.score}%` }}
                      />
                    </div>
                    <p className="mt-4 font-ar text-[14px] leading-relaxed text-v2-body">
                      {selectedSection.hint}
                    </p>
                    <div className="mt-5 border-t border-v2-line pt-4">
                      <Eyebrow>SUGGESTED ACTION</Eyebrow>
                      <p className="mt-2 font-ar text-[13px] leading-relaxed text-v2-body">
                        راجع التوصيات المرتبطة بهذا القسم في تبويب «التوصيات» — التطبيق يستغرق دقائق فقط.
                      </p>
                    </div>
                  </Card>
                </div>
              </aside>
            </div>

            {/* Mobile: full list (carousel above is for quick scan) */}
            <h3 className="mt-6 mb-3 font-ar text-[15px] font-semibold text-v2-ink lg:hidden">القائمة الكاملة</h3>
            <div className="flex flex-col lg:hidden">
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

        {/* RECS tab — 2-col on desktop */}
        {tab === 'recs' && (
          <div className="px-[22px] py-5 lg:px-0 lg:py-8">
            <div className="mb-3 flex items-baseline justify-between lg:mb-6">
              <h2 className="font-ar font-semibold text-v2-ink text-[17px] lg:text-[24px] lg:font-bold">أعلى 3 تعديلات بأثر</h2>
              <Eyebrow>+25 POTENTIAL</Eyebrow>
            </div>
            <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-5">
              {RECS.map((r) => (
                <Card key={r.title} padding="md" radius="md" elevated className="lg:p-6 lg:flex lg:flex-col">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5">
                      <NumDisplay className="text-[12px] font-bold text-teal-700">{r.impact}</NumDisplay>
                    </span>
                    <span className="flex-1 font-ar text-[15px] font-semibold text-v2-ink lg:text-[17px]">{r.title}</span>
                  </div>
                  <p className="mb-3 font-ar leading-relaxed text-v2-body text-[13px] lg:mb-4 lg:text-[14px] lg:flex-1">{r.detail}</p>
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

        {/* RIVALS tab — table on desktop */}
        {tab === 'rivals' && (
          <div className="px-[22px] py-5 lg:px-0 lg:py-8">
            <Eyebrow className="mb-3 block lg:mb-5">
              RIVALS · <NumDisplay>{`0${RIVALS.length}`}</NumDisplay>
            </Eyebrow>

            {/* Mobile: list rows */}
            <div className="flex flex-col lg:hidden">
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

            {/* Desktop: comparison table */}
            <div className="hidden lg:block">
              <div className="overflow-hidden rounded-v2-md border border-v2-line bg-v2-surface">
                <table className="w-full text-start">
                  <thead className="bg-v2-canvas-2">
                    <tr>
                      <th className="px-5 py-3 text-start font-en text-[10.5px] font-medium uppercase tracking-[0.1em] text-v2-dim">RIVAL</th>
                      <th className="px-5 py-3 text-start font-en text-[10.5px] font-medium uppercase tracking-[0.1em] text-v2-dim">ROLE</th>
                      <th className="px-5 py-3 text-end font-en text-[10.5px] font-medium uppercase tracking-[0.1em] text-v2-dim">SCORE</th>
                      <th className="px-5 py-3 text-end font-en text-[10.5px] font-medium uppercase tracking-[0.1em] text-v2-dim">YOUR LEAD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RIVALS.map((r, i) => (
                      <tr key={r.initials} className={i < RIVALS.length - 1 ? 'border-b border-v2-line' : ''}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-v2-canvas-2 font-en text-[12px] font-semibold text-v2-ink-2">
                              {r.initials}
                            </span>
                            <span className="font-ar text-[14px] font-semibold text-v2-ink">{r.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-ar text-[13px] text-v2-body">{r.role}</td>
                        <td className="px-5 py-4 text-end">
                          <NumDisplay className="text-[16px] font-bold text-v2-ink">{r.score}</NumDisplay>
                        </td>
                        <td className="px-5 py-4 text-end">
                          <span className="inline-flex rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 font-en text-[12px] font-semibold text-teal-700">
                            {r.delta}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
