/**
 * /v2/analyze/result/:id — Radar v2 result.
 *
 * Five sections:
 *   1. WowScoreHero      — animated current → target score ring
 *   2. QuickWinCard ×3   — top 3 wins (impact/effort), each with Apply
 *   3. StrengthsList     — collapsed by default
 *   4. GapsList          — severity badges (max 5 visible + show-more)
 *   5. SuggestedActions  — deeplinks into Resume / Content / Profile
 *
 * Cache-aware footer: shows "0 tokens" chip on cache hits and a
 * "Re-analyze (149 tokens)" CTA that forces a fresh run.
 */

import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  ArrowLeft, AlertCircle, Check, ChevronDown, ChevronUp, RefreshCw,
  Award, Zap, FileText, MessageSquareText, UserCog, ExternalLink, Database,
} from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Card from '@/components/v2/Card';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import Skeleton from '@/components/v2/Skeleton';
import NumDisplay from '@/components/v2/NumDisplay';
import { trpc, type RadarResultShape } from '@/lib/trpc';

type CacheRow = Awaited<ReturnType<typeof trpc.radar.getCached>>;

export default function RadarResult() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [, navigate] = useLocation();
  const [match, params] = useRoute<{ id: string }>('/v2/analyze/result/:id');
  const cacheId = match ? params.id : null;

  const [row, setRow] = useState<CacheRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);

  const [showAllGaps, setShowAllGaps] = useState(false);
  const [strengthsOpen, setStrengthsOpen] = useState(false);
  const [appliedIndices, setAppliedIndices] = useState<Record<number, 'applied' | 'skipped'>>({});
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);

  // Did the user arrive via radar.run? If so the toast strip below shows
  // whether the run was a cache hit or charged. We can't know this from
  // the row alone (cache is symmetric on read), so we use a session flag.
  const [justRanInfo, setJustRanInfo] = useState<{ isCacheHit: boolean; tokensCharged: number } | null>(null);
  useEffect(() => {
    if (!cacheId) return;
    try {
      const raw = sessionStorage.getItem(`radar.justRan.${cacheId}`);
      if (raw) {
        setJustRanInfo(JSON.parse(raw));
        sessionStorage.removeItem(`radar.justRan.${cacheId}`);
      }
    } catch { /* ignore */ }
  }, [cacheId]);

  useEffect(() => {
    if (!cacheId) {
      navigate('/v2/analyze', { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await trpc.radar.getCached({ cacheId });
        if (cancelled) return;
        setRow(data);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cacheId, navigate]);

  async function handleReanalyze() {
    if (!row) return;
    setReanalyzing(true);
    setReanalyzeError(null);
    try {
      const out = await trpc.radar.run({
        language: isAr ? 'ar' : 'en',
        forceRefresh: true,
      });
      try {
        sessionStorage.setItem(`radar.justRan.${out.cacheId}`, JSON.stringify({
          isCacheHit: out.isCacheHit,
          tokensCharged: out.tokensCharged,
        }));
      } catch { /* ignore */ }
      navigate(`/v2/analyze/result/${out.cacheId}`);
    } catch (e) {
      setReanalyzeError(e instanceof Error ? e.message : String(e));
    } finally {
      setReanalyzing(false);
    }
  }

  async function handleApply(fixIndex: number) {
    if (!cacheId) return;
    setApplyingIndex(fixIndex);
    try {
      await trpc.radar.applyFix({ cacheId, fixIndex });
      setAppliedIndices((s) => ({ ...s, [fixIndex]: 'applied' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplyingIndex(null);
    }
  }

  function handleSkip(fixIndex: number) {
    setAppliedIndices((s) => ({ ...s, [fixIndex]: 'skipped' }));
  }

  if (loading) {
    return (
      <Phone>
        <Topbar sticky bg="canvas" leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{isAr ? 'النتائج' : 'Results'}</span>} />
        <div className="flex-1 px-[22px] pt-6">
          <Skeleton variant="text" lines={2} className="mb-6" />
          <Skeleton variant="card" className="mb-4" />
          <Skeleton variant="card" />
        </div>
      </Phone>
    );
  }

  if (!row || error) {
    return (
      <Phone>
        <Topbar sticky bg="canvas" leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{isAr ? 'النتائج' : 'Results'}</span>} />
        <div className="flex-1 px-[22px] pt-10">
          <Card padding="lg" radius="lg" className="text-center">
            <Eyebrow className="mb-2 block">RADAR</Eyebrow>
            <h2 className="font-ar text-[18px] font-bold text-v2-ink">
              {error
                ? (isAr ? 'تعذّر تحميل التحليل' : 'Could not load the analysis')
                : (isAr ? 'لم نجد هذا التحليل' : 'Analysis not found')}
            </h2>
            {error && <p className="mt-2 font-ar text-[12px] text-rose-700">{error}</p>}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="primary" onClick={() => navigate('/v2/analyze')}>
                {isAr ? 'تحليل جديد' : 'New analysis'}
              </Button>
            </div>
          </Card>
        </div>
      </Phone>
    );
  }

  const result: RadarResultShape = row.result;
  const gapsToShow = showAllGaps ? result.gaps : result.gaps.slice(0, 5);

  return (
    <Phone>
      <Topbar
        sticky
        bg="canvas"
        leading={
          <button
            type="button"
            onClick={() => navigate('/v2/analyze')}
            aria-label={isAr ? 'عودة' : 'Back'}
            className="flex h-9 items-center gap-1 rounded-v2-pill px-2 text-v2-ink hover:bg-v2-canvas-2"
          >
            <ArrowLeft size={18} className="rtl:rotate-180" />
            <span className="font-ar text-[14px] font-semibold">{isAr ? 'الرادار' : 'Radar'}</span>
          </button>
        }
      />

      <div className="flex-1 px-[22px] pb-[110px] lg:px-0 lg:pb-0">
        {/* Cache-hit / fresh-run chip — only the freshest visit shows it. */}
        {justRanInfo && (
          <div className="mt-4 flex justify-center">
            {justRanInfo.isCacheHit ? (
              <span className="inline-flex items-center gap-1.5 rounded-v2-pill bg-emerald-50 px-3 py-1 font-ar text-[12px] font-semibold text-emerald-700 border border-emerald-200">
                <Database size={14} />
                {isAr ? 'من الكاش · 0 توكن' : 'From cache · 0 tokens'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-v2-pill bg-teal-50 px-3 py-1 font-ar text-[12px] font-semibold text-teal-700 border border-teal-200">
                <Zap size={14} />
                {isAr
                  ? <>تحليل جديد · <NumDisplay>{justRanInfo.tokensCharged}</NumDisplay> توكن</>
                  : <>Fresh analysis · <NumDisplay>{justRanInfo.tokensCharged}</NumDisplay> tokens</>}
              </span>
            )}
          </div>
        )}

        <div className="mt-5 lg:mt-2">
          <Eyebrow className="mb-1.5 block">RADAR · {result.meta.target_role.toUpperCase()}</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[24px] lg:text-[32px]">
            {isAr ? 'تحليلك جاهز' : 'Your analysis is ready.'}
          </h1>
        </div>

        {/* Section 1 — WOW Score hero */}
        <WowScoreHero
          currentScore={result.meta.current_score}
          targetScore={result.meta.target_score}
          isAr={isAr}
        />

        {/* Section 2 — Quick Wins */}
        {result.quick_wins.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-ar text-[18px] font-bold text-v2-ink">
              {isAr ? 'تحسينات سريعة' : 'Quick Wins'}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {result.quick_wins.map((win, i) => {
                // Match the Quick Win to its source fix by title (the engine
                // composes Quick Wins from fixes + suggested_actions; only
                // fix-sourced wins have an applicable fixIndex).
                const fixIndex = result.included_fixes.findIndex((f) => f.title === win.title);
                const state = fixIndex >= 0 ? appliedIndices[fixIndex] : undefined;
                const isApplying = applyingIndex === fixIndex;
                return (
                  <QuickWinCard
                    key={i}
                    title={win.title}
                    impact={win.impact}
                    effort={win.effort}
                    isAr={isAr}
                    canApply={fixIndex >= 0}
                    state={state}
                    isApplying={isApplying}
                    onApply={() => fixIndex >= 0 && handleApply(fixIndex)}
                    onSkip={() => fixIndex >= 0 && handleSkip(fixIndex)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Section 3 — Strengths */}
        {result.strengths.length > 0 && (
          <Card padding="lg" radius="lg" className="mb-4">
            <button
              type="button"
              onClick={() => setStrengthsOpen((s) => !s)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Award size={18} className="text-emerald-600" />
                <h2 className="font-ar text-[16px] font-bold text-v2-ink">
                  {isAr ? 'نقاط القوة' : 'Strengths'}
                </h2>
                <span className="rounded-v2-pill bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  <NumDisplay>{result.strengths.length}</NumDisplay>
                </span>
              </div>
              {strengthsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {strengthsOpen && (
              <ul className="mt-4 space-y-3">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check size={16} className="mt-1 shrink-0 text-emerald-600" />
                    <div>
                      <div className="font-ar text-[14px] font-semibold text-v2-ink">{s.title}</div>
                      <p className="mt-0.5 font-ar text-[13px] leading-relaxed text-v2-body">
                        {s.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* Section 4 — Gaps */}
        {result.gaps.length > 0 && (
          <Card padding="lg" radius="lg" className="mb-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-600" />
              <h2 className="font-ar text-[16px] font-bold text-v2-ink">
                {isAr ? 'الفجوات' : 'Gaps'}
              </h2>
              <span className="rounded-v2-pill bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                <NumDisplay>{result.gaps.length}</NumDisplay>
              </span>
            </div>
            <ul className="space-y-3">
              {gapsToShow.map((g, i) => (
                <li key={i} className="rounded-v2-md border border-v2-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-ar text-[14px] font-semibold text-v2-ink">{g.title}</div>
                    <SeverityBadge severity={g.severity} isAr={isAr} />
                  </div>
                  <p className="mt-1 font-ar text-[13px] leading-relaxed text-v2-body">{g.detail}</p>
                </li>
              ))}
            </ul>
            {result.gaps.length > 5 && !showAllGaps && (
              <button
                type="button"
                onClick={() => setShowAllGaps(true)}
                className="mt-3 font-ar text-[13px] font-semibold text-teal-700 hover:underline"
              >
                {isAr ? `عرض المزيد (${result.gaps.length - 5})` : `Show more (${result.gaps.length - 5})`}
              </button>
            )}
          </Card>
        )}

        {/* Section 5 — Suggested Actions */}
        {result.suggested_actions.length > 0 && (
          <Card padding="lg" radius="lg" className="mb-4">
            <h2 className="mb-3 font-ar text-[16px] font-bold text-v2-ink">
              {isAr ? 'إجراءات مقترحة' : 'Suggested Actions'}
            </h2>
            <div className="space-y-3">
              {result.suggested_actions.map((a, i) => (
                <SuggestedActionCard
                  key={i}
                  title={a.title}
                  detail={a.detail}
                  pillar={a.pillar}
                  deeplink={a.deeplink}
                  isAr={isAr}
                  onNavigate={(href) => navigate(href)}
                />
              ))}
            </div>
          </Card>
        )}

        {/* Footer — when was this generated + re-analyze CTAs */}
        <Card padding="md" radius="lg" className="mb-2 bg-v2-canvas-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-ar text-[12px] text-v2-mute">
              {isAr ? 'آخر تحليل في' : 'Analysis from'}:{' '}
              <NumDisplay>{formatLongDate(row.createdAt, isAr)}</NumDisplay>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/v2/analyze')}
                leadingIcon={<UserCog size={14} />}
              >
                {isAr ? 'تعديل الدور المستهدف' : 'Edit target role'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleReanalyze}
                disabled={reanalyzing}
                leadingIcon={<RefreshCw size={14} />}
              >
                {reanalyzing
                  ? (isAr ? 'جارٍ…' : 'Working…')
                  : (isAr ? 'إعادة التحليل' : 'Re-analyze')}
              </Button>
            </div>
          </div>
          {reanalyzeError && (
            <p className="mt-2 font-ar text-[12px] text-rose-700">{reanalyzeError}</p>
          )}
        </Card>
      </div>

      <BottomNav
        active="analyze"
        items={[
          { id: 'home',    label: isAr ? 'الرئيسية'  : 'Home',    icon: <span /> , onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: isAr ? 'الرادار'    : 'Radar',   icon: <span /> , onSelect: () => navigate('/v2/analyze') },
          { id: 'posts',   label: isAr ? 'الاستوديو'  : 'Studio',  icon: <span /> , onSelect: () => navigate('/v2/posts') },
          { id: 'profile', label: isAr ? 'حسابي'      : 'Account', icon: <span /> , onSelect: () => navigate('/v2/me') },
        ]}
        fabIcon="plus"
        fabLabel={isAr ? 'تحليل جديد' : 'New analysis'}
        onFabClick={() => navigate('/v2/analyze')}
      />
    </Phone>
  );
}

// ─────────────────────────────────────────────
// Sub-components — kept in-file for minimal touch
// ─────────────────────────────────────────────

function WowScoreHero({ currentScore, targetScore, isAr }: { currentScore: number; targetScore: number; isAr: boolean }) {
  const value = useMotionValue(0);
  const rounded = useTransform(value, (v) => Math.round(v));
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const unsub = rounded.on('change', (v) => setDisplayed(v));
    const controls = animate(value, targetScore, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    return () => { controls.stop(); unsub(); };
  }, [targetScore, value, rounded]);

  const delta = Math.max(0, targetScore - currentScore);
  const circumference = 2 * Math.PI * 60;
  const progressFraction = displayed / 100;
  const dashOffset = circumference * (1 - progressFraction);

  return (
    <Card padding="lg" radius="lg" elevated className="mb-6">
      <div className="flex flex-col items-center text-center">
        <Eyebrow className="mb-2">{isAr ? 'سكور الرادار' : 'Radar Score'}</Eyebrow>
        <div className="relative h-[160px] w-[160px]">
          <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
            <circle cx="80" cy="80" r="60" stroke="#e5e7eb" strokeWidth="10" fill="none" />
            <motion.circle
              cx="80" cy="80" r="60"
              stroke="url(#radar-gradient)" strokeWidth="10" fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="radar-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#0d9488" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <NumDisplay className="font-en text-[44px] font-bold leading-none text-v2-ink">{displayed}</NumDisplay>
            <span className="mt-1 font-ar text-[12px] text-v2-mute">/ <NumDisplay>100</NumDisplay></span>
          </div>
        </div>
        <p className="mt-3 max-w-[340px] font-ar text-[13px] leading-relaxed text-v2-body">
          {isAr
            ? <>سكورك الحالي <strong><NumDisplay>{currentScore}</NumDisplay></strong> — بعد تطبيق Quick Wins نتوقع <strong><NumDisplay>{targetScore}</NumDisplay>/100</strong></>
            : <>Current <strong><NumDisplay>{currentScore}</NumDisplay></strong> — after Quick Wins we project <strong><NumDisplay>{targetScore}</NumDisplay>/100</strong></>}
        </p>
        {delta > 0 && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-v2-pill bg-emerald-50 px-2.5 py-0.5 font-en text-[12px] font-bold text-emerald-700">
            +<NumDisplay>{delta}</NumDisplay>
          </span>
        )}
      </div>
    </Card>
  );
}

function QuickWinCard(props: {
  title: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'very_low' | 'low' | 'medium' | 'high';
  isAr: boolean;
  canApply: boolean;
  state: 'applied' | 'skipped' | undefined;
  isApplying: boolean;
  onApply: () => void;
  onSkip: () => void;
}) {
  const { title, impact, effort, isAr, canApply, state, isApplying, onApply, onSkip } = props;
  const impactLabel = impact === 'high' ? (isAr ? 'تأثير عالٍ' : 'High Impact')
                    : impact === 'medium' ? (isAr ? 'تأثير متوسط' : 'Medium Impact')
                    : (isAr ? 'تأثير منخفض' : 'Low Impact');
  const effortLabel = effort === 'very_low' ? (isAr ? 'جهد قليل جداً' : 'Very Low Effort')
                    : effort === 'low' ? (isAr ? 'جهد قليل' : 'Low Effort')
                    : effort === 'medium' ? (isAr ? 'جهد متوسط' : 'Medium Effort')
                    : (isAr ? 'جهد عالٍ' : 'High Effort');

  const cardBg = state === 'applied' ? 'bg-emerald-50 border-emerald-200'
              : state === 'skipped' ? 'opacity-60'
              : '';

  return (
    <Card padding="md" radius="lg" className={`flex flex-col gap-2.5 ${cardBg}`}>
      <p className="font-ar text-[14px] font-semibold leading-snug text-v2-ink">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center rounded-v2-pill bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
          {impactLabel}
        </span>
        <span className="inline-flex items-center rounded-v2-pill bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
          {effortLabel}
        </span>
      </div>
      <div className="mt-1 flex gap-2">
        {state === 'applied' ? (
          <span className="inline-flex items-center gap-1 font-ar text-[12px] font-semibold text-emerald-700">
            <Check size={14} />
            {isAr ? 'تم التطبيق' : 'Applied'}
          </span>
        ) : state === 'skipped' ? (
          <span className="font-ar text-[12px] text-v2-mute">
            {isAr ? 'تم التخطي' : 'Skipped'}
          </span>
        ) : canApply ? (
          <>
            <Button variant="primary" size="sm" onClick={onApply} disabled={isApplying}>
              {isApplying ? '…' : (isAr ? 'تطبيق' : 'Apply')}
            </Button>
            <Button variant="ghost" size="sm" onClick={onSkip}>
              {isAr ? 'تخطي' : 'Skip'}
            </Button>
          </>
        ) : (
          <span className="font-ar text-[11px] text-v2-mute">
            {isAr ? 'يحتاج خطوة في صفحة أخرى' : 'Acted via a deeplink below'}
          </span>
        )}
      </div>
    </Card>
  );
}

function SeverityBadge({ severity, isAr }: { severity: 'low' | 'medium' | 'high'; isAr: boolean }) {
  const map = {
    high:   { bg: 'bg-rose-100',   color: 'text-rose-700',   ar: 'عالية', en: 'High' },
    medium: { bg: 'bg-amber-100',  color: 'text-amber-700',  ar: 'متوسطة', en: 'Medium' },
    low:    { bg: 'bg-slate-100',  color: 'text-slate-700',  ar: 'منخفضة', en: 'Low' },
  } as const;
  const m = map[severity];
  return (
    <span className={`shrink-0 rounded-v2-pill px-2 py-0.5 text-[11px] font-bold ${m.bg} ${m.color}`}>
      {isAr ? m.ar : m.en}
    </span>
  );
}

function SuggestedActionCard(props: {
  title: string;
  detail: string;
  pillar: 'resume' | 'content' | 'profile';
  deeplink: string;
  isAr: boolean;
  onNavigate: (href: string) => void;
}) {
  const { title, detail, pillar, deeplink, isAr, onNavigate } = props;
  const pillarMeta = {
    resume:  { Icon: FileText,          ar: 'افتح في السيرة',     en: 'Open in Resume',  color: 'text-indigo-700', bg: 'bg-indigo-50' },
    content: { Icon: MessageSquareText, ar: 'افتح في المنشورات',   en: 'Open in Content', color: 'text-amber-700',  bg: 'bg-amber-50' },
    profile: { Icon: UserCog,           ar: 'افتح في الملف المهني', en: 'Open in Profile', color: 'text-teal-700',   bg: 'bg-teal-50' },
  }[pillar];

  return (
    <div className="rounded-v2-md border border-v2-line p-3">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-v2-sm ${pillarMeta.bg} ${pillarMeta.color}`}>
          <pillarMeta.Icon size={14} />
        </span>
        <div className="flex-1">
          <div className="font-ar text-[14px] font-semibold text-v2-ink">{title}</div>
          <p className="mt-1 font-ar text-[13px] leading-relaxed text-v2-body">{detail}</p>
          <button
            type="button"
            onClick={() => onNavigate(deeplink)}
            className={`mt-2 inline-flex items-center gap-1 font-ar text-[12px] font-semibold ${pillarMeta.color} hover:underline`}
          >
            {isAr ? pillarMeta.ar : pillarMeta.en}
            <ExternalLink size={12} className="rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatLongDate(iso: string, isAr: boolean): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(isAr ? 'en-GB' : 'en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}
