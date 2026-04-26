import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import LiveDot from '@/components/v2/LiveDot';
import NumDisplay from '@/components/v2/NumDisplay';
import RadarSweep from '@/components/v2/RadarSweep';
import { useIsDesktop } from '@/components/v2/ResponsiveShell';
import { useJobs } from '@/lib/v2/jobs';

interface Finding {
  t: number;
  kind: 'scan' | 'warn' | 'good' | 'info' | 'final';
  text: string;
}

const TOTAL = 7.5;
const MOCK_RESULT_ID = 'mock-001';

const FINDINGS: Finding[] = [
  { t: 0.8, kind: 'scan',  text: 'قراءة المقدّمة… 420 كلمة' },
  { t: 1.6, kind: 'warn',  text: 'العنوان المهني عامّ — لا يذكر تخصصاً' },
  { t: 2.4, kind: 'good',  text: '5 إنجازات قابلة للقياس في الخبرة' },
  { t: 3.2, kind: 'scan',  text: '29 مهارة — 4 خارج المجال' },
  { t: 4.1, kind: 'warn',  text: 'آخر منشور قبل 41 يوماً' },
  { t: 5.0, kind: 'info',  text: 'مقارنة بـ Senior PM · Aramco Digital' },
  { t: 5.9, kind: 'warn',  text: 'ظهورك أقل بـ 32% من متوسط الدور' },
  { t: 6.7, kind: 'good',  text: 'توليد 3 تعديلات بأعلى أثر' },
  { t: 7.5, kind: 'final', text: 'النتيجة النهائية: 88 / 100' },
];

const KIND_BG: Record<Finding['kind'], string> = {
  scan:  'bg-v2-surface border-v2-line',
  warn:  'bg-v2-amber-50 border-v2-amber/30',
  good:  'bg-teal-50 border-teal-100',
  info:  'bg-v2-indigo-50 border-v2-indigo/30',
  final: 'bg-teal-50 border-teal-300 shadow-card',
};
const KIND_DOT: Record<Finding['kind'], string> = {
  scan:  'bg-v2-mute',
  warn:  'bg-v2-amber',
  good:  'bg-teal-600',
  info:  'bg-v2-indigo',
  final: 'bg-teal-700',
};
const KIND_ICON: Record<Finding['kind'], string> = {
  scan: '·', warn: '!', good: '+', info: 'i', final: '✓',
};

function RadarLoading() {
  const [location, navigate] = useLocation();
  const { t: tr } = useTranslation();
  const { jobs, addJob } = useJobs();
  const isDesktop = useIsDesktop();

  const incomingJobId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('jobId');
  }, [location]);

  const ensuredJobIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (incomingJobId || ensuredJobIdRef.current) return;
    const job = addJob({
      type: 'analysis',
      title: 'تحليل البروفايل',
      durationMs: TOTAL * 1000,
      resultUrl: `/v2/analyze/result/${MOCK_RESULT_ID}`,
    });
    ensuredJobIdRef.current = job.id;
  }, [incomingJobId, addJob]);

  const jobId = incomingJobId ?? ensuredJobIdRef.current;
  const job = jobs.find((j) => j.id === jobId);

  const progress = job?.progress ?? 0;
  const t = progress * TOTAL;

  const redirectedRef = useRef(false);
  useEffect(() => {
    if (redirectedRef.current) return;
    if (job?.status === 'completed') {
      redirectedRef.current = true;
      navigate(`/v2/analyze/result/${MOCK_RESULT_ID}`);
    } else if (job?.status === 'failed') {
      redirectedRef.current = true;
      navigate('/v2/analyze');
    }
  }, [job, navigate]);

  const visible = FINDINGS.filter((f) => t >= f.t);
  const idx = visible.length;

  // RadarSweep size: 260 on mobile, 480 on desktop. Read once per render.
  const sweepSize = isDesktop ? 480 : 260;

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2/home')}
        title={
          <span className="inline-flex items-center gap-2">
            <span className="font-en text-[10.5px] font-semibold uppercase tracking-[0.14em] text-teal-700">
              PROFILE RADAR · LIVE
            </span>
            <LiveDot />
          </span>
        }
        trailing={
          <button
            type="button"
            aria-label="إلغاء"
            onClick={() => navigate('/v2/home')}
            className="flex h-9 w-9 items-center justify-center rounded-v2-pill text-v2-dim hover:bg-v2-canvas-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        }
      />

      {/* Mobile: single column, scrolling. Desktop: 50/50 split with subtle radial bg. */}
      <div className="flex-1 px-[22px] pb-8 pt-6 overflow-y-auto lg:px-0 lg:pb-0 lg:pt-0 lg:overflow-visible
        lg:relative lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start lg:py-10
        lg:before:absolute lg:before:inset-0 lg:before:-z-10 lg:before:rounded-v2-xl
        lg:before:bg-[radial-gradient(circle_at_70%_30%,var(--teal-50)_0%,transparent_60%)]"
      >

        {/* SWEEP column — start side (RTL: right) on lg */}
        <div className="lg:order-1 lg:flex lg:flex-col lg:items-center lg:justify-center lg:py-8">
          <div className="mb-5 text-center lg:mb-8">
            <h1 className="font-ar font-bold text-v2-ink text-[26px] lg:text-[32px]">
              {tr('v2.radar.loading.heading', 'نحلّل بروفايلك الآن…')}
            </h1>
            <div className="mt-2 inline-flex items-baseline gap-1 text-v2-dim lg:mt-3">
              <NumDisplay className="text-[14px] font-medium text-v2-ink-2 lg:text-[16px]">{t.toFixed(1)}</NumDisplay>
              <span className="text-[13px]">/</span>
              <span className="font-ar text-[13px] lg:text-[14px]">
                <NumDisplay>7.5</NumDisplay> ثانية
              </span>
            </div>
          </div>

          <div className="mx-auto mb-6 flex justify-center lg:mb-8">
            <RadarSweep duration={TOTAL} litCount={Math.min(6, idx)} size={sweepSize} loop />
          </div>

          <div className="w-full lg:max-w-[420px]">
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-v2-line">
              <div
                className="absolute inset-y-0 start-0 bg-teal-500"
                style={{ width: `${progress * 100}%`, transition: 'width 80ms linear' }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <Eyebrow>
                <NumDisplay>{idx}</NumDisplay> / <NumDisplay>9</NumDisplay>
              </Eyebrow>
              <Eyebrow className="text-teal-700">
                {idx >= 9 ? 'مكتمل' : 'دقّة'}
              </Eyebrow>
            </div>
          </div>
        </div>

        {/* FINDINGS column — end side (RTL: left) on lg, drawer-like panel */}
        <div className="lg:order-2 lg:rounded-v2-xl lg:border lg:border-v2-line lg:bg-v2-surface lg:p-7 lg:shadow-card">
          <div className="mb-3 flex items-baseline justify-between lg:mb-5">
            <h2 className="font-ar font-semibold text-v2-ink text-[17px] lg:text-[19px]">يكتشف الآن</h2>
            <Eyebrow>
              <NumDisplay>{idx}</NumDisplay> / <NumDisplay>9</NumDisplay>
            </Eyebrow>
          </div>

          <div className="flex flex-col gap-2 lg:gap-3">
            {[...visible].reverse().map((f, i) => (
              <div
                key={f.t}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-v2-md border ${KIND_BG[f.kind]} ${
                  i === 0 ? 'v2-finding-in' : ''
                } lg:px-4 lg:py-3.5`}
              >
                <span
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-white font-mono text-[12px] font-semibold leading-none ${KIND_DOT[f.kind]}`}
                  aria-hidden="true"
                >
                  {KIND_ICON[f.kind]}
                </span>
                <span className={`flex-1 font-ar text-v2-ink-2 text-[13px] lg:text-[14px] ${f.kind === 'final' ? 'font-semibold' : 'font-medium'}`}>
                  {f.text}
                </span>
              </div>
            ))}

            {idx < 9 && (
              <div className="flex items-center gap-3 rounded-v2-md border border-dashed border-v2-line bg-v2-surface px-3.5 py-3 lg:px-4 lg:py-3.5">
                <span className="h-[22px] w-[22px] shrink-0 rounded-full bg-v2-canvas-2" aria-hidden="true" />
                <span className="v2-shimmer h-2 flex-1 rounded-full" />
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-v2-line pt-4 lg:mt-8">
            <Eyebrow>wassel · radar v3</Eyebrow>
            <NumDisplay className="text-[12px] text-v2-dim">25 توكن</NumDisplay>
          </div>

          <div className="mt-6 lg:mt-6">
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => navigate('/v2/home')}
              className="lg:!h-12 lg:!text-[15px]"
            >
              متابعة في الخلفية
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes v2-finding-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .v2-finding-in { animation: v2-finding-in 360ms var(--ease-out); }
        @keyframes v2-shimmer-kf {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .v2-shimmer {
          background: linear-gradient(90deg, var(--line) 0%, var(--canvas-2) 50%, var(--line) 100%);
          background-size: 200% 100%;
          animation: v2-shimmer-kf 1.4s linear infinite;
        }
      `}</style>
    </Phone>
  );
}

export default RadarLoading;
