import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, AlertCircle } from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import Button from '@/components/v2/Button';
import NumDisplay from '@/components/v2/NumDisplay';
import SpinningLogo from '@/components/v2/SpinningLogo';
import { trpcMutation } from '@/lib/trpc';
import {
  clearAnalysisParams,
  getAnalysisParams,
  setAnalysisResult,
  type AnalysisParams,
} from '@/lib/v2/analysisSession';

interface Step {
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
  /** planned milliseconds for this step under the average-case 100s envelope */
  durationMs: number;
}

// Total ≈ 100s — the realistic middle of the 60–120s analysis window.
const STEPS: Step[] = [
  { ar: 'جلب بيانات لينكد إن',         en: 'Fetching LinkedIn data',         descAr: 'استخراج بيانات البروفايل',     descEn: 'Pulling profile data',         durationMs:  8_000 },
  { ar: 'تحليل المهارات والخبرات',      en: 'Analysing skills & experience',  descAr: 'معالجة تاريخ العمل',            descEn: 'Processing work history',      durationMs: 15_000 },
  { ar: 'فحص التعليم والشهادات',        en: 'Reviewing education & certs',    descAr: 'تقييم الخلفية الأكاديمية',      descEn: 'Evaluating credentials',       durationMs: 10_000 },
  { ar: 'تقييم قوة البروفايل',           en: 'Scoring profile strength',       descAr: 'حساب نقاط القوة',                descEn: 'Computing strength signals',   durationMs: 12_000 },
  { ar: 'مقارنة مع السوق السعودي',       en: 'Benchmarking on Saudi market',   descAr: 'مقارنة مع قاعدة البيانات',       descEn: 'Comparing against benchmark',   durationMs: 18_000 },
  { ar: 'صياغة التوصيات بالذكاء الاصطناعي', en: 'Drafting AI recommendations', descAr: 'توليد نصائح مخصصة',              descEn: 'Generating tailored advice',   durationMs: 20_000 },
  { ar: 'حساب النتيجة النهائية',         en: 'Computing final score',          descAr: 'تجميع البيانات',                  descEn: 'Aggregating data',             durationMs:  8_000 },
  { ar: 'إعداد التقرير الشامل',           en: 'Preparing report',               descAr: 'تنسيق النتائج',                   descEn: 'Formatting output',            durationMs:  9_000 },
];

const TOTAL_PLANNED_MS = STEPS.reduce((s, x) => s + x.durationMs, 0);
const TICK_MS = 250;
// Hold the last step at 92% until the API resolves so the bar never lies
// about completion. When the API returns, we sprint to 100% and navigate.
const HOLD_AT_PCT = 0.92;

interface StepState {
  /** 0..1 progress for this individual step */
  progress: number;
  /** transition: this step starts when the cumulative elapsed ≥ its startOffset */
  startOffset: number;
  endOffset: number;
}

function getQueryId(search: string): string | null {
  try {
    return new URLSearchParams(search).get('id');
  } catch {
    return null;
  }
}

function formatSeconds(ms: number): string {
  return Math.max(0, Math.round(ms / 1000)).toString();
}

export default function AnalysisLoading() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [, navigate] = useLocation();
  const search = useSearch();

  const id = getQueryId(search);

  // Per-step planned offsets so we can map a single elapsed-ms value into
  // every step's individual progress bar without per-step timers.
  const stepStates = useMemo<StepState[]>(() => {
    let cumulative = 0;
    return STEPS.map((s) => {
      const startOffset = cumulative;
      cumulative += s.durationMs;
      return { progress: 0, startOffset, endOffset: cumulative };
    });
  }, []);

  const [overallPct, setOverallPct] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<'running' | 'finishing' | 'finished' | 'error'>('running');
  const [error, setError] = useState<string | null>(null);
  const [stepProgress, setStepProgress] = useState<number[]>(() => STEPS.map(() => 0));
  const [elapsedMs, setElapsedMs] = useState(0);

  // Guards
  const ranRef = useRef(false);
  const apiDoneRef = useRef(false);
  const apiResultRef = useRef<{
    id: string;
    analysis: any;
    profileSummary?: any;
    linkedinUrl?: string;
    tokensUsed?: number;
  } | null>(null);
  const startedAtRef = useRef<number>(0);
  // Track when the API resolved so the overall ramp uses the exact moment.
  const apiDoneAtRef = useRef<number>(0);

  // Boot: pull params, kick off the API, kick off the timeline.
  useEffect(() => {
    if (!id) {
      navigate('/v2/analyze', { replace: true });
      return;
    }
    const params = getAnalysisParams(id);
    if (!params) {
      navigate('/v2/analyze', { replace: true });
      return;
    }
    if (ranRef.current) return;
    ranRef.current = true;
    startedAtRef.current = performance.now();
    runAnalysis(id, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // The timeline driver — single rAF-equivalent interval that updates
  // overall + per-step progress monotonically.
  useEffect(() => {
    if (phase === 'finished' || phase === 'error') return;
    const tick = () => {
      const now = performance.now();
      const elapsed = now - startedAtRef.current;
      setElapsedMs(elapsed);

      const apiDone = apiDoneRef.current;

      // Overall progress: linear up to HOLD_AT_PCT during the planned window.
      // If the API has resolved, race to 100%. If we're past the planned window
      // and API hasn't resolved, hold at HOLD_AT_PCT and let the per-step bar
      // pulse on the last step.
      let overall: number;
      if (apiDone) {
        // Once API is done, ramp to 100 over ~600ms regardless of plan offset.
        overall = Math.min(1, (elapsed - (apiDoneAtRef.current - startedAtRef.current)) / 600 + HOLD_AT_PCT);
      } else {
        const planRatio = Math.min(1, elapsed / TOTAL_PLANNED_MS);
        overall = Math.min(planRatio, HOLD_AT_PCT);
      }
      setOverallPct(overall);

      // Active step + per-step progress
      let active = STEPS.length - 1;
      const next = STEPS.map((_, i) => {
        const { startOffset, endOffset } = stepStates[i];
        if (elapsed < startOffset) return 0;
        if (elapsed >= endOffset) return 1;
        return Math.min(1, (elapsed - startOffset) / (endOffset - startOffset));
      });
      for (let i = 0; i < STEPS.length; i++) {
        if (next[i] < 1) { active = i; break; }
      }
      // If we've blown past the plan and still waiting on the API, keep
      // active on the last step at 92% so the spinner stays visible.
      if (!apiDone && elapsed >= TOTAL_PLANNED_MS) {
        active = STEPS.length - 1;
        next[STEPS.length - 1] = HOLD_AT_PCT;
      }
      setActiveIdx(active);
      setStepProgress(next);

      // If the API finished and we've ramped to 100%, navigate.
      if (apiDone && overall >= 1 && phase === 'running') {
        setPhase('finishing');
      }
    };
    const handle = window.setInterval(tick, TICK_MS);
    tick(); // immediate first paint so we don't show 0 for a quarter second
    return () => window.clearInterval(handle);
  }, [phase, stepStates]);

  // After the bar reaches 100% post-API, navigate (gives the user a beat to
  // see the green checkmark cascade).
  useEffect(() => {
    if (phase !== 'finishing') return;
    const t = window.setTimeout(() => {
      const result = apiResultRef.current;
      if (!result || !id) return;
      clearAnalysisParams(id);
      setPhase('finished');
      navigate(`/v2/analyze/result/${result.id}`, { replace: true });
    }, 600);
    return () => window.clearTimeout(t);
  }, [phase, id, navigate]);

  async function runAnalysis(tempId: string, params: AnalysisParams) {
    try {
      const res = await trpcMutation<{
        id: string;
        analysis: any;
        linkedinUrl: string;
        tokensUsed: number;
        profileSummary?: any;
      }>('linkedin.analyzeTargeted', {
        linkedinUrl: params.linkedinUrl,
        targetGoal: params.targetGoal,
        industry: params.industry,
        customIndustryLabel: params.customIndustryLabel,
        targetRole: params.targetRole,
        targetCompany: params.targetCompany,
        reportLanguage: params.reportLanguage,
      });

      apiDoneAtRef.current = performance.now();
      apiDoneRef.current = true;
      apiResultRef.current = res;

      // Persist under both temp and real id so the in-flight URL still
      // resolves until we redirect.
      setAnalysisResult(tempId, {
        id: res.id,
        analysis: res.analysis,
        profileSummary: (res as any).profileSummary,
        linkedinUrl: res.linkedinUrl,
        tokensUsed: res.tokensUsed,
      });
      setAnalysisResult(res.id, {
        id: res.id,
        analysis: res.analysis,
        profileSummary: (res as any).profileSummary,
        linkedinUrl: res.linkedinUrl,
        tokensUsed: res.tokensUsed,
      });
      // The driver effect will catch up on the next tick.
    } catch (e: any) {
      apiDoneRef.current = true;
      const code: string = e?.data?.code || e?.code || '';
      const msg: string = e?.message || (isAr ? 'فشل التحليل. أعد المحاولة.' : 'Analysis failed. Please try again.');
      let friendly = msg;
      if (code === 'NOT_FOUND') friendly = isAr ? 'لم نعثر على هذا البروفايل على لينكد إن.' : "We couldn't find this LinkedIn profile.";
      setError(friendly);
      setPhase('error');
    }
  }

  function handleRetry() {
    if (!id) {
      navigate('/v2/analyze');
      return;
    }
    const params = getAnalysisParams(id);
    if (!params) {
      navigate('/v2/analyze');
      return;
    }
    setError(null);
    apiDoneRef.current = false;
    apiResultRef.current = null;
    apiDoneAtRef.current = 0;
    startedAtRef.current = performance.now();
    setStepProgress(STEPS.map(() => 0));
    setOverallPct(0);
    setActiveIdx(0);
    setPhase('running');
    ranRef.current = true;
    runAnalysis(id, params);
  }

  const overallPctRounded = Math.round(overallPct * 100);
  const planRemainingMs = Math.max(0, TOTAL_PLANNED_MS - elapsedMs);

  return (
    <Phone>
      <Topbar
        sticky
        bg="canvas"
        leading={
          <span className="font-ar text-[15px] font-bold text-v2-ink px-2">
            {isAr ? 'جارٍ التحليل' : 'Analysing'}
          </span>
        }
      />

      <div className="flex-1 px-[22px] pb-10 lg:px-0">
        {/* Hero — spinning logo + heading + ETA. Centered on every viewport. */}
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
              ? (isAr ? 'تعذّر إكمال التحليل.' : "We couldn't finish the analysis.")
              : (isAr ? 'نُجري تحليلاً عميقاً لبروفايلك.' : 'Running a deep analysis on your profile.')}
          </h1>
          <p className="mt-2 font-ar text-[14px] text-v2-dim max-w-[440px]">
            {phase === 'error'
              ? (isAr ? 'لم يتم خصم أي توكنات. يمكنك إعادة المحاولة بأمان.' : 'No tokens were charged. You can safely retry.')
              : (isAr
                ? 'التحليل الشامل يحتاج 60–120 ثانية للحصول على أفضل النتائج.'
                : 'Deep analysis needs 60–120 seconds for the best results.')}
          </p>
          {phase !== 'error' && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-v2-pill bg-teal-50 px-3 py-1 font-ar text-[12px] font-semibold text-teal-700">
              <span aria-hidden>⏱</span>
              {isAr ? 'الوقت المتوقع' : 'ETA'} ·&nbsp;
              <NumDisplay>{formatSeconds(planRemainingMs)}</NumDisplay>
              &nbsp;{isAr ? 'ث' : 's'}
            </div>
          )}
        </div>

        {/* Overall progress bar */}
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

        {/* 8-step timeline */}
        <ol className="mx-auto flex flex-col gap-3 lg:max-w-[640px] lg:gap-3.5">
          {STEPS.map((step, i) => {
            const isComplete = stepProgress[i] >= 1;
            const isActive = i === activeIdx && !isComplete && phase !== 'error';
            const indvProgress = Math.round((stepProgress[i] || 0) * 100);
            return (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: isAr ? 16 : -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.32) }}
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
                    isComplete ? 'bg-teal-600 text-white' : isActive ? '' : 'bg-v2-canvas-2 text-v2-mute'
                  }`}
                >
                  {isComplete ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    >
                      <Check size={16} strokeWidth={2.6} />
                    </motion.span>
                  ) : isActive ? (
                    <SpinningLogo size="sm" speed="fast" />
                  ) : (
                    <span className="font-en text-[12px] font-bold">{String(i + 1).padStart(2, '0')}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={`font-ar text-[14px] ${
                      isActive ? 'font-semibold text-teal-800'
                        : isComplete ? 'font-medium text-v2-body'
                        : 'text-v2-dim'
                    }`}
                  >
                    {isAr ? step.ar : step.en}
                  </div>
                  <div className={`mt-0.5 font-ar text-[12px] ${isActive ? 'text-teal-700' : 'text-v2-dim'}`}>
                    {isAr ? step.descAr : step.descEn}
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

        {/* Status line under the timeline */}
        <div className="mx-auto mt-5 max-w-[640px] text-center font-ar text-[12px]">
          {phase === 'error' ? (
            <span className="text-rose-700">{isAr ? '✕ فشل التحليل' : '✕ Analysis failed'}</span>
          ) : phase === 'finishing' || phase === 'finished' ? (
            <span className="font-semibold text-teal-700">
              {isAr ? '✓ التحليل مكتمل — جارٍ التحضير للعرض' : '✓ Analysis complete — preparing your report'}
            </span>
          ) : apiDoneRef.current ? (
            <span className="text-v2-body">{isAr ? 'لمسات أخيرة…' : 'Final touches…'}</span>
          ) : (
            <span className="text-v2-dim">
              {isAr ? 'تحليل عميق جارٍ — لا تُغلق النافذة.' : 'Deep analysis running — keep this tab open.'}
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
                    {isAr ? 'العودة للنموذج' : 'Back to form'}
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
