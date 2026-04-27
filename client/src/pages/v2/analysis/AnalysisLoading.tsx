import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import Button from '@/components/v2/Button';
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
}

const STEPS: Step[] = [
  { ar: 'جلب بيانات لينكد إن',           en: 'Fetching LinkedIn data' },
  { ar: 'تحليل المهارات والخبرات',        en: 'Analysing skills & experience' },
  { ar: 'فحص التعليم والشهادات',          en: 'Reviewing education & certs' },
  { ar: 'تقييم قوة البروفايل',             en: 'Scoring profile strength' },
  { ar: 'مقارنة مع السوق السعودي',        en: 'Benchmarking on Saudi market' },
  { ar: 'صياغة التوصيات',                  en: 'Drafting recommendations' },
  { ar: 'حساب النتيجة النهائية',           en: 'Computing final score' },
  { ar: 'إعداد التقرير',                    en: 'Preparing report' },
];

const STEP_TICK_MS = 1800;

function getQueryId(search: string): string | null {
  try {
    return new URLSearchParams(search).get('id');
  } catch {
    return null;
  }
}

export default function AnalysisLoading() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [, navigate] = useLocation();
  const search = useSearch();

  const id = getQueryId(search);

  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<'running' | 'finished' | 'error'>('running');
  const [error, setError] = useState<string | null>(null);

  // Guard: only fire the mutation once even if React StrictMode re-runs effects.
  const ranRef = useRef(false);
  // Track tRPC completion separately from the step animation so we can hold
  // the user on the last step until the API returns (or skip ahead if it
  // returns before all 8 steps have ticked).
  const apiDoneRef = useRef(false);

  useEffect(() => {
    if (!id) {
      navigate('/v2/analyze', { replace: true });
      return;
    }
    const params = getAnalysisParams(id);
    if (!params) {
      // Refresh / direct deep-link without params — bounce to input.
      navigate('/v2/analyze', { replace: true });
      return;
    }
    if (ranRef.current) return;
    ranRef.current = true;
    runAnalysis(id, params);
    // Step animation runs on a separate timer below.
    return () => { /* effects torn down — timers cleared in their own effects */ };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Step animation. Advances every STEP_TICK_MS and stalls on the last step
  // until the tRPC mutation resolves.
  useEffect(() => {
    if (phase !== 'running') return;
    const t = window.setInterval(() => {
      setStepIdx((prev) => {
        if (apiDoneRef.current) return prev; // hold once API done — phase change will navigate
        return Math.min(prev + 1, STEPS.length - 1);
      });
    }, STEP_TICK_MS);
    return () => window.clearInterval(t);
  }, [phase]);

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

      apiDoneRef.current = true;

      // Persist under both the temp id (so the in-flight URL still resolves)
      // and the real db id (the canonical permalink).
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

      // Let the timeline catch up to step 8 visually (max ~600ms) before
      // navigating, so the user sees the run "finish" rather than vanishing.
      setStepIdx(STEPS.length - 1);
      setPhase('finished');
      window.setTimeout(() => {
        clearAnalysisParams(tempId);
        navigate(`/v2/analyze/result/${res.id}`, { replace: true });
      }, 600);
    } catch (e: any) {
      apiDoneRef.current = true;
      const code: string = e?.data?.code || e?.code || '';
      const msg: string = e?.message || (isAr ? 'فشل التحليل. أعد المحاولة.' : 'Analysis failed. Please try again.');
      // Friendly copy for known failure modes — avoids dumping raw stack-y messages.
      let friendly = msg;
      if (code === 'NOT_FOUND') friendly = isAr ? 'لم نعثر على هذا البروفايل على لينكد إن.' : "We couldn't find this LinkedIn profile.";
      else if (code === 'BAD_REQUEST') friendly = msg; // already user-facing in V1 patterns
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
    setStepIdx(0);
    apiDoneRef.current = false;
    setPhase('running');
    ranRef.current = true;
    runAnalysis(id, params);
  }

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
        <div className="mt-5 mb-6 lg:mt-2 lg:mb-8">
          <Eyebrow className="mb-1.5 block">RADAR · IN PROGRESS</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[24px] lg:text-[30px]">
            {isAr
              ? phase === 'error'
                ? 'تعذّر إكمال التحليل.'
                : 'نُجري تحليلاً عميقاً لبروفايلك.'
              : phase === 'error'
                ? "We couldn't finish the analysis."
                : 'Running a deep analysis on your profile.'}
          </h1>
          <p className="mt-2 font-ar text-[14px] text-v2-dim">
            {phase === 'error'
              ? (isAr ? 'لم يتم خصم أي توكنات. يمكنك إعادة المحاولة بأمان.' : 'No tokens were charged. You can safely retry.')
              : (isAr ? 'قد يستغرق ذلك حتى 30 ثانية.' : 'This may take up to 30 seconds.')}
          </p>
        </div>

        <Card padding="lg" radius="lg" elevated className="lg:max-w-[640px]">
          <ol className="flex flex-col gap-3 lg:gap-3.5">
            {STEPS.map((step, i) => {
              const isComplete = i < stepIdx || phase === 'finished';
              const isActive = i === stepIdx && phase === 'running';
              const isPending = !isComplete && !isActive;
              return (
                <li
                  key={i}
                  className={`flex items-center gap-3 rounded-v2-md border px-3 py-2.5 transition-all duration-300 ease-out ${
                    isActive
                      ? 'border-teal-300 bg-teal-50/70'
                      : isComplete
                        ? 'border-v2-line bg-v2-canvas-2'
                        : 'border-v2-line bg-v2-surface'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-[12px] font-bold ${
                      isComplete
                        ? 'bg-teal-600'
                        : isActive
                          ? 'bg-teal-600'
                          : 'bg-v2-mute'
                    }`}
                  >
                    {isComplete ? (
                      <Check size={14} strokeWidth={2.5} />
                    ) : isActive ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <span className="font-en">{String(i + 1).padStart(2, '0')}</span>
                    )}
                  </span>
                  <span
                    className={`flex-1 font-ar text-[14px] transition-colors duration-300 ease-out ${
                      isActive ? 'font-semibold text-teal-800'
                        : isComplete ? 'font-medium text-v2-body'
                        : 'text-v2-dim'
                    }`}
                  >
                    {isAr ? step.ar : step.en}
                  </span>
                  {isPending && (
                    <span className="hidden font-en text-[11px] text-v2-mute lg:inline">
                      {isAr ? 'في الانتظار' : 'Pending'}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>

        {phase === 'error' && (
          <Card padding="md" radius="md" className="mt-5 border-rose-200 bg-rose-50 lg:max-w-[640px]">
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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/v2/analyze')}
                  >
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
