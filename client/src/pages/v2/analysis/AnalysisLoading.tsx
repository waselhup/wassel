/**
 * /v2/analyze/loading — Radar v2 loading screen.
 *
 * Kicks off `trpc.radar.run({ overrideTargetRole? })` on mount; animates
 * a 3-stage timeline (discover → compare → reveal); on success, navigates
 * to /v2/analyze/result/:cacheId. On error, shows an inline retry CTA
 * (tokens are refunded server-side per R03).
 *
 * The animation is purely visual — there's no server-side streaming. We
 * pace overall progress to a planned 90s envelope, then "race to 100"
 * once the API resolves.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, AlertCircle, Search, GitCompareArrows, Sparkles } from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import Button from '@/components/v2/Button';
import NumDisplay from '@/components/v2/NumDisplay';
import SpinningLogo from '@/components/v2/SpinningLogo';
import { trpc } from '@/lib/trpc';

interface Stage {
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
  durationMs: number;
}

// Three stages — Radar v2 doesn't pretend to do 8 things. It does 3, well.
const STAGES: Stage[] = [
  {
    ar: 'اكتشاف بياناتك',
    en: 'Discovering your data',
    descAr: 'استخراج وتطبيع بروفايل لينكد إن',
    descEn: 'Pulling and normalising your LinkedIn profile',
    durationMs: 22_000,
  },
  {
    ar: 'مقارنة مع متطلبات الدور',
    en: 'Comparing with role requirements',
    descAr: 'تحليل الفجوات مقابل الدور المستهدف',
    descEn: 'Mapping gaps against your target role',
    durationMs: 42_000,
  },
  {
    ar: 'كشف الفرص',
    en: 'Revealing opportunities',
    descAr: 'صياغة Quick Wins والتوصيات',
    descEn: 'Composing Quick Wins and suggested actions',
    durationMs: 26_000,
  },
];

const TOTAL_PLANNED_MS = STAGES.reduce((s, x) => s + x.durationMs, 0);
const TICK_MS = 220;
const HOLD_AT_PCT = 0.92;

function readQueryParam(search: string, key: string): string | null {
  try {
    return new URLSearchParams(search).get(key);
  } catch {
    return null;
  }
}

export default function RadarLoading() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [, navigate] = useLocation();
  const search = useSearch();
  const override = readQueryParam(search, 'override');

  const stageBounds = useMemo(() => {
    let cum = 0;
    return STAGES.map((s) => {
      const start = cum;
      cum += s.durationMs;
      return { start, end: cum };
    });
  }, []);

  const [overallPct, setOverallPct] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<'running' | 'finishing' | 'finished' | 'error'>('running');
  const [error, setError] = useState<string | null>(null);
  const [stageProgress, setStageProgress] = useState<number[]>(() => STAGES.map(() => 0));
  const [elapsedMs, setElapsedMs] = useState(0);

  const ranRef = useRef(false);
  const apiDoneRef = useRef(false);
  const cacheIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const apiDoneAtRef = useRef<number>(0);

  // Boot — kick the API + the timeline.
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    startedAtRef.current = performance.now();
    runRadar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timeline driver.
  useEffect(() => {
    if (phase === 'finished' || phase === 'error') return;
    const tick = () => {
      const now = performance.now();
      const elapsed = now - startedAtRef.current;
      setElapsedMs(elapsed);

      const apiDone = apiDoneRef.current;
      let overall: number;
      if (apiDone) {
        overall = Math.min(1, (elapsed - (apiDoneAtRef.current - startedAtRef.current)) / 600 + HOLD_AT_PCT);
      } else {
        const planRatio = Math.min(1, elapsed / TOTAL_PLANNED_MS);
        overall = Math.min(planRatio, HOLD_AT_PCT);
      }
      setOverallPct(overall);

      let active = STAGES.length - 1;
      const next = STAGES.map((_, i) => {
        const { start, end } = stageBounds[i];
        if (elapsed < start) return 0;
        if (elapsed >= end) return 1;
        return Math.min(1, (elapsed - start) / (end - start));
      });
      for (let i = 0; i < STAGES.length; i++) {
        if (next[i] < 1) { active = i; break; }
      }
      if (!apiDone && elapsed >= TOTAL_PLANNED_MS) {
        active = STAGES.length - 1;
        next[STAGES.length - 1] = HOLD_AT_PCT;
      }
      setActiveIdx(active);
      setStageProgress(next);

      if (apiDone && overall >= 1 && phase === 'running') {
        setPhase('finishing');
      }
    };
    const handle = window.setInterval(tick, TICK_MS);
    tick();
    return () => window.clearInterval(handle);
  }, [phase, stageBounds]);

  // After the bar lands at 100%, redirect to the result page.
  useEffect(() => {
    if (phase !== 'finishing') return;
    const id = window.setTimeout(() => {
      if (!cacheIdRef.current) return;
      setPhase('finished');
      navigate(`/v2/analyze/result/${cacheIdRef.current}`, { replace: true });
    }, 500);
    return () => window.clearTimeout(id);
  }, [phase, navigate]);

  async function runRadar() {
    try {
      const out = await trpc.radar.run({
        overrideTargetRole: override ?? undefined,
        language: isAr ? 'ar' : 'en',
      });
      apiDoneAtRef.current = performance.now();
      apiDoneRef.current = true;
      cacheIdRef.current = out.cacheId;
      // Hand off the "fresh vs cached + tokens charged" info to the result
      // page so it can flash the right chip on first paint.
      try {
        sessionStorage.setItem(`radar.justRan.${out.cacheId}`, JSON.stringify({
          isCacheHit: out.isCacheHit,
          tokensCharged: out.tokensCharged,
        }));
      } catch { /* ignore */ }
    } catch (e: unknown) {
      apiDoneRef.current = true;
      const err = e as { message?: string };
      setError(err?.message || (isAr ? 'فشل التحليل. أعد المحاولة' : 'Analysis failed. Please try again.'));
      setPhase('error');
    }
  }

  function handleRetry() {
    setError(null);
    setPhase('running');
    setOverallPct(0);
    setStageProgress(STAGES.map(() => 0));
    setActiveIdx(0);
    apiDoneRef.current = false;
    cacheIdRef.current = null;
    apiDoneAtRef.current = 0;
    startedAtRef.current = performance.now();
    runRadar();
  }

  const overallPctRounded = Math.round(overallPct * 100);
  const planRemainingSec = Math.max(0, Math.round((TOTAL_PLANNED_MS - elapsedMs) / 1000));
  const stageIconMap = [Search, GitCompareArrows, Sparkles];

  return (
    <Phone>
      <Topbar
        sticky
        bg="canvas"
        leading={
          <span className="px-2 font-ar text-[15px] font-bold text-v2-ink">
            {isAr ? 'جارٍ التحليل' : 'Analysing'}
          </span>
        }
      />

      <div className="flex-1 px-[22px] pb-10 lg:px-0">
        <div className="mt-6 mb-8 flex flex-col items-center text-center lg:mt-4 lg:mb-10">
          <SpinningLogo
            size="xl"
            speed={phase === 'finishing' ? 'fast' : 'normal'}
            label={isAr ? 'جارٍ التحليل' : 'Analysing'}
            className="mb-5"
          />
          <Eyebrow className="mb-1.5">RADAR · IN PROGRESS</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[24px] lg:text-[30px] max-w-[460px]">
            {phase === 'error'
              ? (isAr ? 'تعذّر إكمال التحليل' : "We couldn't finish the analysis.")
              : (isAr ? 'نُحلّل بروفايلك مقابل دورك المستهدف' : 'Running your gap analysis.')}
          </h1>
          <p className="mt-2 font-ar text-[14px] text-v2-dim max-w-[440px]">
            {phase === 'error'
              ? (isAr ? 'لم يتم خصم أي نقاط. يمكنك إعادة المحاولة بأمان' : 'No tokens were charged. You can safely retry.')
              : (isAr ? 'التحليل العميق يحتاج 60–120 ثانية للحصول على أفضل النتائج' : 'A thorough analysis takes 60–120 seconds.')}
          </p>
          {phase !== 'error' && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-v2-pill bg-teal-50 px-3 py-1 font-ar text-[12px] font-semibold text-teal-700">
              <span aria-hidden>⏱</span>
              {isAr ? 'الوقت المتوقع' : 'ETA'} ·&nbsp;
              <NumDisplay>{planRemainingSec}</NumDisplay>
              &nbsp;{isAr ? 'ث' : 's'}
            </div>
          )}
        </div>

        {/* Overall progress */}
        <Card padding="md" radius="lg" className="mx-auto mb-5 lg:max-w-[640px]">
          <div className="flex items-baseline justify-between font-ar">
            <Eyebrow>{isAr ? 'التقدم الإجمالي' : 'Overall progress'}</Eyebrow>
            <NumDisplay className="text-[14px] font-bold text-v2-ink">{overallPctRounded}%</NumDisplay>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-v2-line">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600"
              animate={{ width: `${overallPctRounded}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </Card>

        {/* 3-stage timeline */}
        <ol className="mx-auto flex flex-col gap-3 lg:max-w-[640px] lg:gap-3.5">
          {STAGES.map((stage, i) => {
            const isComplete = stageProgress[i] >= 1;
            const isActive = i === activeIdx && !isComplete && phase !== 'error';
            const indvProgress = Math.round((stageProgress[i] || 0) * 100);
            const Icon = stageIconMap[i];
            return (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: isAr ? 16 : -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.06, 0.18) }}
                className={`flex items-start gap-3 rounded-v2-md border px-3 py-3 transition-all duration-300 ease-out ${
                  isComplete
                    ? 'border-teal-200 bg-teal-50'
                    : isActive
                      ? 'border-teal-300 bg-teal-50/70 shadow-card scale-[1.01]'
                      : 'border-v2-line bg-v2-surface opacity-70'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    isComplete ? 'bg-teal-600 text-white' : isActive ? 'bg-teal-100 text-teal-700' : 'bg-v2-canvas-2 text-v2-mute'
                  }`}
                >
                  {isComplete ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
                      <Check size={16} strokeWidth={2.6} />
                    </motion.span>
                  ) : isActive ? (
                    <SpinningLogo size="sm" speed="fast" />
                  ) : (
                    <Icon size={16} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`font-ar text-[14px] ${isActive ? 'font-semibold text-teal-800' : isComplete ? 'font-medium text-v2-body' : 'text-v2-dim'}`}>
                    {isAr ? stage.ar : stage.en}
                  </div>
                  <div className={`mt-0.5 font-ar text-[12px] ${isActive ? 'text-teal-700' : 'text-v2-dim'}`}>
                    {isAr ? stage.descAr : stage.descEn}
                  </div>
                  {isActive && (
                    <div className="mt-2 h-[3px] w-32 overflow-hidden rounded-full bg-teal-100">
                      <motion.div
                        className="h-full bg-teal-600"
                        animate={{ width: `${indvProgress}%` }}
                        transition={{ duration: 0.3, ease: 'linear' }}
                      />
                    </div>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ol>

        {/* Status under the timeline */}
        <div className="mx-auto mt-5 max-w-[640px] text-center font-ar text-[12px]">
          {phase === 'error' ? (
            <span className="text-rose-700">{isAr ? '✕ فشل التحليل' : '✕ Analysis failed'}</span>
          ) : phase === 'finishing' || phase === 'finished' ? (
            <span className="font-semibold text-teal-700">
              {isAr ? '✓ التحليل مكتمل — تجهيز النتيجة' : '✓ Analysis complete — preparing your result'}
            </span>
          ) : apiDoneRef.current ? (
            <span className="text-v2-body">{isAr ? 'لمسات أخيرة…' : 'Final touches…'}</span>
          ) : elapsedMs > TOTAL_PLANNED_MS ? (
            <span className="text-v2-dim">{isAr ? 'نشتغل عليه، اقترب من النهاية…' : 'Working on it, almost done…'}</span>
          ) : (
            <span className="text-v2-dim">
              {isAr ? 'تحليل عميق جارٍ — لا تُغلق النافذة' : 'Deep analysis running — keep this tab open.'}
            </span>
          )}
        </div>

        {phase === 'error' && (
          <Card padding="md" radius="md" className="mx-auto mt-5 border-rose-200 bg-rose-50 lg:max-w-[640px]">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
              <div className="flex-1 font-ar">
                <div className="text-[14px] font-bold text-rose-800">
                  {isAr ? 'فشل التحليل' : 'Analysis failed'}
                </div>
                <div className="mt-1 text-[13px] text-rose-700">{error}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={handleRetry}>
                    {isAr ? 'أعد المحاولة' : 'Retry'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/v2/analyze')}>
                    {isAr ? 'العودة' : 'Back'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Phone>
  );
}
