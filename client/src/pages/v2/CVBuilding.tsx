/**
 * /v2/cvs/building — Resume v2 loading screen.
 *
 * Kicks off `trpc.resume.build({ templateId, overrideTargetRole? })` on mount;
 * animates a 3-stage timeline (extracting → tailoring → optimizing); on
 * success, navigates to /v2/cvs/:versionId. Tokens are refunded server-side
 * on failure per Bowling-Lane Rules (R03).
 *
 * Same animation envelope as the Radar loader (60-120s real window).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, AlertCircle, Database, Target, Award } from 'lucide-react';
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

const STAGES: Stage[] = [
  { ar: 'استخراج خبرتك', en: 'Extracting your experience', descAr: 'تحليل بيانات لينكد إن', descEn: 'Reading your LinkedIn data', durationMs: 24_000 },
  { ar: 'تخصيص للدور المستهدف', en: 'Tailoring for your target role', descAr: 'إعادة صياغة كل قسم', descEn: 'Rewriting every section', durationMs: 46_000 },
  { ar: 'تحسين لأنظمة ATS', en: 'Optimizing for ATS systems', descAr: 'فحص الكلمات المفتاحية والتنسيق', descEn: 'Checking keywords and format', durationMs: 22_000 },
];

const TOTAL_PLANNED_MS = STAGES.reduce((s, x) => s + x.durationMs, 0);
const TICK_MS = 220;
const HOLD_AT_PCT = 0.92;

function readQuery(search: string, key: string): string | null {
  try { return new URLSearchParams(search).get(key); } catch { return null; }
}

export default function CVBuilding() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [, navigate] = useLocation();
  const search = useSearch();
  const templateId = readQuery(search, 'template');
  const override = readQuery(search, 'override');

  const stageBounds = useMemo(() => {
    let cum = 0;
    return STAGES.map((s) => { const start = cum; cum += s.durationMs; return { start, end: cum }; });
  }, []);

  const [overallPct, setOverallPct] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<'running' | 'finishing' | 'finished' | 'error'>('running');
  const [error, setError] = useState<string | null>(null);
  const [stageProgress, setStageProgress] = useState<number[]>(() => STAGES.map(() => 0));
  const [elapsedMs, setElapsedMs] = useState(0);

  const ranRef = useRef(false);
  const apiDoneRef = useRef(false);
  const versionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const apiDoneAtRef = useRef<number>(0);

  useEffect(() => {
    if (!templateId) {
      navigate('/v2/cvs/new', { replace: true });
      return;
    }
    if (ranRef.current) return;
    ranRef.current = true;
    startedAtRef.current = performance.now();
    void runBuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

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

  useEffect(() => {
    if (phase !== 'finishing') return;
    const id = window.setTimeout(() => {
      if (!versionIdRef.current) return;
      setPhase('finished');
      navigate(`/v2/cvs/${versionIdRef.current}`, { replace: true });
    }, 500);
    return () => window.clearTimeout(id);
  }, [phase, navigate]);

  async function runBuild() {
    if (!templateId) return;
    try {
      const out = await trpc.resume.build({
        templateId,
        overrideTargetRole: override ?? undefined,
        language: isAr ? 'ar' : 'en',
      });
      apiDoneAtRef.current = performance.now();
      apiDoneRef.current = true;
      versionIdRef.current = out.versionId;
      try {
        sessionStorage.setItem(`resume.justBuilt.${out.versionId}`, JSON.stringify({
          isCacheHit: out.isCacheHit,
          tokensCharged: out.tokensCharged,
          atsScore: out.atsScore,
        }));
      } catch { /* ignore */ }
    } catch (e: unknown) {
      apiDoneRef.current = true;
      const err = e as { message?: string };
      setError(err?.message || (isAr ? 'فشل بناء السيرة. أعد المحاولة' : 'Resume build failed. Please try again.'));
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
    versionIdRef.current = null;
    apiDoneAtRef.current = 0;
    startedAtRef.current = performance.now();
    void runBuild();
  }

  const overallPctRounded = Math.round(overallPct * 100);
  const planRemainingSec = Math.max(0, Math.round((TOTAL_PLANNED_MS - elapsedMs) / 1000));
  const stageIconMap = [Database, Target, Award];

  return (
    <Phone>
      <Topbar sticky bg="canvas" leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{isAr ? 'جارٍ البناء' : 'Building'}</span>} />

      <div className="flex-1 px-[22px] pb-10 lg:px-0">
        <div className="mt-6 mb-8 flex flex-col items-center text-center lg:mt-4 lg:mb-10">
          <SpinningLogo size="xl" speed={phase === 'finishing' ? 'fast' : 'normal'} label={isAr ? 'جارٍ البناء' : 'Building'} className="mb-5" />
          <Eyebrow className="mb-1.5">RESUME · IN PROGRESS</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[24px] lg:text-[30px] max-w-[460px]">
            {phase === 'error'
              ? (isAr ? 'تعذّر إكمال البناء' : "We couldn't finish the build.")
              : (isAr ? 'نبني سيرتك للدور المستهدف' : 'Building your targeted resume.')}
          </h1>
          <p className="mt-2 font-ar text-[14px] text-v2-dim max-w-[440px]">
            {phase === 'error'
              ? (isAr ? 'لم يتم خصم أي توكنات. يمكنك إعادة المحاولة بأمان' : 'No tokens were charged. You can safely retry.')
              : (isAr ? 'البناء العميق يحتاج 60–120 ثانية للحصول على أفضل النتائج' : 'A thorough build takes 60–120 seconds.')}
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
                  {isComplete
                    ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}><Check size={16} strokeWidth={2.6} /></motion.span>
                    : isActive ? <SpinningLogo size="sm" speed="fast" /> : <Icon size={16} />}
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
                      <motion.div className="h-full bg-teal-600" animate={{ width: `${indvProgress}%` }} transition={{ duration: 0.3, ease: 'linear' }} />
                    </div>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ol>

        <div className="mx-auto mt-5 max-w-[640px] text-center font-ar text-[12px]">
          {phase === 'error' ? (
            <span className="text-rose-700">{isAr ? '✕ فشل البناء' : '✕ Build failed'}</span>
          ) : phase === 'finishing' || phase === 'finished' ? (
            <span className="font-semibold text-teal-700">{isAr ? '✓ السيرة جاهزة — تجهيز العرض' : '✓ Resume ready — preparing your editor'}</span>
          ) : apiDoneRef.current ? (
            <span className="text-v2-body">{isAr ? 'لمسات أخيرة…' : 'Final touches…'}</span>
          ) : elapsedMs > TOTAL_PLANNED_MS ? (
            <span className="text-v2-dim">{isAr ? 'نشتغل عليه، اقترب من النهاية…' : 'Working on it, almost done…'}</span>
          ) : (
            <span className="text-v2-dim">{isAr ? 'بناء عميق جارٍ — لا تُغلق النافذة' : 'Deep build running — keep this tab open.'}</span>
          )}
        </div>

        {phase === 'error' && (
          <Card padding="md" radius="md" className="mx-auto mt-5 border-rose-200 bg-rose-50 lg:max-w-[640px]">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
              <div className="flex-1 font-ar">
                <div className="text-[14px] font-bold text-rose-800">{isAr ? 'فشل البناء' : 'Build failed'}</div>
                <div className="mt-1 text-[13px] text-rose-700">{error}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={handleRetry}>{isAr ? 'أعد المحاولة' : 'Retry'}</Button>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/v2/cvs/new')}>{isAr ? 'العودة' : 'Back'}</Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Phone>
  );
}
