import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import Button from '@/components/v2/Button';
import Skeleton, { useInitialLoading } from '@/components/v2/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import type {
  AiSuggestionShape,
  CareerPulseShape,
  ActivityLogEntryShape,
  DraftSummaryShape,
  SufficesForShape,
} from '@/lib/trpc';

/**
 * Sprint 6 — Career Copilot Cockpit.
 *
 * Five layers, top-down:
 *   1. NextTaskCard            (above the fold; the one action)
 *   2. CareerPulse             (radar / resume / content / wallet KPIs)
 *   3. QuickWinsMini           (3 chips from the latest radar)
 *   4. ActivityTimeline        (last 7 days)
 *   5. DraftLibrary            (collapsed; resume / content / radar)
 *   +  SufficesForWidget       (sidebar / floating)
 *
 * All data fetched in parallel on mount. Each layer renders independently
 * so a slow query doesn't block the others.
 */

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function firstNameOf(
  profile: { full_name: string | null } | null,
  user: { email?: string | null } | null,
  isAr: boolean,
): string {
  const full = profile?.full_name?.trim();
  if (full) return full.split(/\s+/)[0]!;
  const email = user?.email ?? '';
  const local = email.split('@')[0];
  return local || (isAr ? 'صديقي' : 'friend');
}

function greetingFor(date: Date, isAr: boolean): string {
  const h = date.getHours();
  if (isAr) {
    if (h < 5) return 'مساء الخير';
    if (h < 12) return 'صباح الخير';
    if (h < 18) return 'مرحباً';
    return 'مساء الخير';
  }
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Hello';
  return 'Good evening';
}

function relativeTime(iso: string, isAr: boolean, now = Date.now()): string {
  const ts = new Date(iso).getTime();
  const diffMs = Math.max(0, now - ts);
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return isAr ? 'الآن' : 'just now';
  if (m < 60) return isAr ? `قبل ${m} دقيقة` : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return isAr ? `قبل ${h} ساعة` : `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return isAr ? `قبل ${d} يوم` : `${d} d ago`;
  return new Date(iso).toLocaleDateString(isAr ? 'ar-SA-u-nu-latn' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function pillarIcon(pillar: string | null): ReactNode {
  if (pillar === 'radar') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="8" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (pillar === 'resume') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="3" y="2" width="10" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 5.5 H10.5 M5.5 8 H10.5 M5.5 10.5 H8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (pillar === 'content') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 4 H13 M3 8 H13 M3 12 H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function NextTaskCard({
  task,
  loading,
  isAr,
  onAct,
  onDismiss,
}: {
  task: AiSuggestionShape | null;
  loading: boolean;
  isAr: boolean;
  onAct: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Card padding="lg" radius="lg" elevated className="bg-gradient-to-br from-teal-50 to-white border-teal-100">
        <Skeleton variant="text" width={100} className="mb-3" />
        <Skeleton variant="text" lines={2} className="mb-4" />
        <Skeleton variant="text" width={140} className="h-10" />
      </Card>
    );
  }

  if (!task) {
    return (
      <Card padding="lg" radius="lg" elevated>
        <Eyebrow>{t('dashboard.nextTask.title', isAr ? 'خطوتك التالية' : 'Your Next Move')}</Eyebrow>
        <p className="mt-2 font-ar text-[14px] text-v2-dim">
          {t('dashboard.nextTask.empty', isAr ? 'أنت على المسار الصحيح. لا توجد توصيات جديدة.' : 'You are on track. No new suggestions.')}
        </p>
      </Card>
    );
  }

  const highConfidence = (task.score ?? 0) >= 8;

  return (
    <Card
      padding="lg"
      radius="lg"
      elevated
      className="bg-gradient-to-br from-teal-50 to-white border-teal-100 transition-shadow duration-300 hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <Eyebrow className="text-teal-700">
          {t('dashboard.nextTask.title', isAr ? 'خطوتك التالية' : 'Your Next Move')}
        </Eyebrow>
        {highConfidence && (
          <span className="inline-flex items-center gap-1 rounded-v2-pill bg-teal-600 px-2 py-0.5 font-ar text-[10px] font-semibold text-white">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M5 1 L6 4 L9 4.3 L7 6.4 L7.5 9.3 L5 7.8 L2.5 9.3 L3 6.4 L1 4.3 L4 4 Z" fill="currentColor" />
            </svg>
            {t('dashboard.nextTask.highConfidence', isAr ? 'موصى به بشدة' : 'Highly recommended')}
          </span>
        )}
      </div>
      <h2 className="font-ar text-[18px] font-bold text-v2-ink leading-snug lg:text-[22px]">
        {task.headline}
      </h2>
      <p className="mt-2 font-ar text-[13px] text-v2-body leading-relaxed lg:text-[14px]">
        {task.rationale}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="md" onClick={onAct}>
          {task.cta_label || t('dashboard.nextTask.actCta', isAr ? 'ابدأ الآن' : 'Start now')}
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          className="font-ar text-[13px] font-semibold text-v2-dim hover:text-v2-ink px-3 py-2 cursor-pointer transition-colors duration-150"
        >
          {t('dashboard.nextTask.dismiss', isAr ? 'ليس الآن' : 'Not now')}
        </button>
      </div>
    </Card>
  );
}

function PulseTile({
  label,
  value,
  unit,
  hint,
  loading,
  onClick,
  delta,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  loading: boolean;
  onClick?: () => void;
  delta?: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full flex-col items-start gap-1 rounded-v2-md border border-v2-line bg-v2-surface px-3 py-3 text-start hover:bg-v2-canvas-2 cursor-pointer transition-colors duration-200"
    >
      <Eyebrow>{label}</Eyebrow>
      {loading ? (
        <Skeleton variant="text" width={50} className="h-7" />
      ) : (
        <div className="flex items-baseline gap-1.5">
          <NumDisplay className="text-[22px] font-bold leading-none text-v2-ink lg:text-[26px]">
            {value}
          </NumDisplay>
          {unit && <span className="font-ar text-[11px] text-v2-dim">{unit}</span>}
        </div>
      )}
      {hint && <span className="font-ar text-[11px] text-v2-dim">{hint}</span>}
      {delta != null && delta !== 0 && !loading && (
        <span className={`font-ar text-[11px] ${delta > 0 ? 'text-teal-700' : 'text-v2-dim'}`}>
          {delta > 0 ? '+' : ''}
          <NumDisplay>{delta}</NumDisplay>
        </span>
      )}
    </button>
  );
}

function CareerPulse({
  pulse,
  loading,
  isAr,
  navigate,
}: {
  pulse: CareerPulseShape | null;
  loading: boolean;
  isAr: boolean;
  navigate: (to: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 className="mb-3 font-ar text-[16px] font-semibold text-v2-ink lg:text-[18px]">
        {t('dashboard.pulse.title', isAr ? 'نبضك المهني' : 'Your Career Pulse')}
      </h2>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        <PulseTile
          label={t('dashboard.pulse.radarScore', isAr ? 'نتيجة الرادار' : 'Radar Score')}
          value={pulse?.radarScore ?? '—'}
          unit={pulse?.radarScore != null ? (isAr ? '/100' : '/100') : undefined}
          loading={loading}
          onClick={() => navigate('/v2/analyze')}
          delta={pulse?.radarScoreDelta30d ?? null}
        />
        <PulseTile
          label={t('dashboard.pulse.resumeReady', isAr ? 'السيرة' : 'Resume')}
          value={pulse?.activeResumeAtsScore ?? (pulse?.resumeCount ? '—' : '0')}
          unit={pulse?.activeResumeAtsScore != null ? t('dashboard.pulse.atsScore', isAr ? 'ATS' : 'ATS') : undefined}
          hint={
            pulse?.resumeCount
              ? isAr
                ? `${pulse.resumeCount} نسخة`
                : `${pulse.resumeCount} versions`
              : t('dashboard.pulse.noResumeYet', isAr ? 'لم تبنِ سيرة بعد' : 'No resume yet')
          }
          loading={loading}
          onClick={() => navigate('/v2/cvs')}
        />
        <PulseTile
          label={t('dashboard.pulse.contentVelocity', isAr ? 'زخم المحتوى' : 'Content Velocity')}
          value={pulse?.contentCount30d ?? 0}
          unit={isAr ? '/30 يوم' : '/30 d'}
          loading={loading}
          onClick={() => navigate('/v2/posts')}
        />
        <PulseTile
          label={t('dashboard.pulse.wallet', isAr ? 'الرصيد' : 'Balance')}
          value={pulse?.walletSummary?.total ?? 0}
          unit={isAr ? 'توكن' : 'tokens'}
          hint={
            pulse?.walletSummary?.bonusExpiresAt
              ? isAr
                ? 'بونس ينتهي قريباً'
                : 'Bonus expiring soon'
              : undefined
          }
          loading={loading}
          onClick={() => navigate('/v2/pricing')}
        />
      </div>
    </div>
  );
}

function QuickWinsMini({
  wins,
  isAr,
  navigate,
}: {
  wins: CareerPulseShape['latestQuickWins'];
  isAr: boolean;
  navigate: (to: string) => void;
}) {
  const { t } = useTranslation();
  if (!wins || wins.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 font-ar text-[16px] font-semibold text-v2-ink lg:text-[18px]">
        {t('dashboard.quickWins.title', isAr ? 'تحسينات سريعة' : 'Quick Wins')}
      </h2>
      <div className="flex flex-wrap gap-2">
        {wins.slice(0, 3).map((w, i) => (
          <button
            key={`${w.title}-${i}`}
            type="button"
            onClick={() => navigate(`/v2/analyze/result/${w.cacheId}`)}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-v2-md border border-v2-line bg-v2-surface px-3 py-2 text-start hover:bg-v2-canvas-2 cursor-pointer transition-colors duration-200"
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                w.impact === 'high' ? 'bg-teal-600' : w.impact === 'medium' ? 'bg-amber-500' : 'bg-v2-mute'
              }`}
              aria-hidden="true"
            />
            <span className="font-ar text-[12px] text-v2-ink line-clamp-1 lg:text-[13px]">{w.title}</span>
            <span className="font-ar text-[11px] font-semibold text-teal-700">
              {t('dashboard.quickWins.apply', isAr ? 'تطبيق' : 'Apply')} →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActivityTimeline({
  entries,
  loading,
  isAr,
  navigate,
}: {
  entries: ActivityLogEntryShape[];
  loading: boolean;
  isAr: boolean;
  navigate: (to: string) => void;
}) {
  const { t } = useTranslation();
  const now = Date.now();

  const actionLabel = (action: string): string => {
    const key = `dashboard.activity.actions.${action}`;
    const fallback = action.replace(/[._]/g, ' ');
    return t(key, fallback);
  };

  const deeplink = (entry: ActivityLogEntryShape): string | null => {
    if (entry.related_resource_type === 'radar_analyses') return '/v2/analyze';
    if (entry.related_resource_type === 'resume_versions') return `/v2/cvs/${entry.related_resource_id ?? ''}`;
    if (entry.related_resource_type === 'content_versions') return `/v2/posts/${entry.related_resource_id ?? ''}`;
    return null;
  };

  if (loading) {
    return (
      <div>
        <h2 className="mb-3 font-ar text-[16px] font-semibold text-v2-ink lg:text-[18px]">
          {t('dashboard.activity.title', isAr ? 'النشاط الأخير' : 'Recent Activity')}
        </h2>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[28px_1fr_60px] items-center gap-3 py-2">
              <Skeleton variant="text" width={20} className="h-5 rounded-full" />
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="text" width={40} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div>
        <h2 className="mb-3 font-ar text-[16px] font-semibold text-v2-ink lg:text-[18px]">
          {t('dashboard.activity.title', isAr ? 'النشاط الأخير' : 'Recent Activity')}
        </h2>
        <div className="rounded-v2-md border border-v2-line bg-v2-surface px-4 py-6 text-center">
          <p className="font-ar text-[13px] text-v2-dim">
            {t('dashboard.activity.empty', isAr ? 'لا نشاط بعد' : 'No activity yet')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-ar text-[16px] font-semibold text-v2-ink lg:text-[18px]">
          {t('dashboard.activity.title', isAr ? 'النشاط الأخير' : 'Recent Activity')}
        </h2>
      </div>
      <div className="flex flex-col">
        {entries.slice(0, 7).map((e, i) => {
          const dl = deeplink(e);
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => dl && navigate(dl)}
              disabled={!dl}
              className={`grid grid-cols-[28px_1fr_auto] items-center gap-3 py-3 px-1 text-start
                border-b border-v2-line ${i === 0 ? 'border-t' : ''}
                ${dl ? 'hover:bg-v2-canvas-2 cursor-pointer' : 'cursor-default'}
                transition-colors duration-150`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-v2-canvas-2 text-v2-ink">
                {pillarIcon(e.pillar)}
              </span>
              <span className="font-ar text-[13px] text-v2-ink leading-tight lg:text-[14px]">
                {actionLabel(e.action)}
              </span>
              <span className="font-ar text-[11px] text-v2-dim whitespace-nowrap">
                {relativeTime(e.created_at, isAr, now)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DraftLibrary({
  drafts,
  loading,
  isAr,
  navigate,
}: {
  drafts: DraftSummaryShape | null;
  loading: boolean;
  isAr: boolean;
  navigate: (to: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (loading) {
    return <Skeleton variant="text" width={120} className="h-6" />;
  }

  const counts = {
    resume: drafts?.resume.length ?? 0,
    content: drafts?.content.length ?? 0,
    radar: drafts?.radar.length ?? 0,
  };
  const total = counts.resume + counts.content + counts.radar;
  if (total === 0) return null;

  return (
    <div className="rounded-v2-md border border-v2-line bg-v2-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-v2-canvas-2 transition-colors duration-150"
      >
        <span className="font-ar text-[14px] font-semibold text-v2-ink">
          {t('dashboard.drafts.title', isAr ? 'مكتبة المسودات' : 'Drafts Library')}
        </span>
        <span className="flex items-center gap-2">
          <NumDisplay className="font-ar text-[12px] text-v2-dim">{total}</NumDisplay>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className={`text-v2-mute transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            <path d="M3 4.5 L6 7.5 L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="border-t border-v2-line p-4 space-y-4">
          {counts.resume > 0 && (
            <div>
              <Eyebrow>{t('dashboard.drafts.resume', isAr ? 'سير' : 'Resumes')}</Eyebrow>
              <div className="mt-2 flex flex-col gap-1.5">
                {drafts!.resume.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => navigate(`/v2/cvs/${r.id}`)}
                    className="flex items-center justify-between rounded-v2-md px-2 py-1.5 text-start hover:bg-v2-canvas-2 cursor-pointer transition-colors duration-150"
                  >
                    <span className="font-ar text-[13px] text-v2-ink line-clamp-1">{r.display_name}</span>
                    {r.ats_score != null && (
                      <span className="font-ar text-[11px] text-teal-700">
                        ATS <NumDisplay>{r.ats_score}</NumDisplay>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {counts.content > 0 && (
            <div>
              <Eyebrow>{t('dashboard.drafts.content', isAr ? 'محتوى' : 'Content')}</Eyebrow>
              <div className="mt-2 flex flex-col gap-1.5">
                {drafts!.content.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/v2/posts/${c.id}`)}
                    className="flex items-center justify-between rounded-v2-md px-2 py-1.5 text-start hover:bg-v2-canvas-2 cursor-pointer transition-colors duration-150"
                  >
                    <span className="font-ar text-[13px] text-v2-ink line-clamp-1">{c.display_title}</span>
                    <span className="font-ar text-[11px] text-v2-dim">{c.content_type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {counts.radar > 0 && (
            <div>
              <Eyebrow>{t('dashboard.drafts.radar', isAr ? 'تحاليل' : 'Analyses')}</Eyebrow>
              <div className="mt-2 flex flex-col gap-1.5">
                {drafts!.radar.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => navigate(`/v2/analyze/result/${r.id}`)}
                    className="flex items-center justify-between rounded-v2-md px-2 py-1.5 text-start hover:bg-v2-canvas-2 cursor-pointer transition-colors duration-150"
                  >
                    <span className="font-ar text-[13px] text-v2-ink line-clamp-1">{r.target_role}</span>
                    <span className="font-ar text-[11px] text-teal-700">
                      <NumDisplay>{r.current_score}</NumDisplay>/<NumDisplay>{r.target_score}</NumDisplay>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SufficesForWidget({
  data,
  loading,
  isAr,
  navigate,
}: {
  data: SufficesForShape | null;
  loading: boolean;
  isAr: boolean;
  navigate: (to: string) => void;
}) {
  const { t } = useTranslation();

  if (loading || !data) return null;
  if (data.walletTotal <= 0) return null;

  const { breakdown, recommendedBundle } = data;
  const items: Array<{ key: string; label: string }> = [];
  if (breakdown.radar > 0) items.push({ key: 'radarCount', label: t('dashboard.sufficesFor.radarCount', isAr ? `${breakdown.radar} تحليل` : `${breakdown.radar} analyses`, { count: breakdown.radar }) });
  if (breakdown.resume > 0) items.push({ key: 'resumeCount', label: t('dashboard.sufficesFor.resumeCount', isAr ? `${breakdown.resume} سيرة` : `${breakdown.resume} resumes`, { count: breakdown.resume }) });
  if (breakdown.post > 0) items.push({ key: 'postCount', label: t('dashboard.sufficesFor.postCount', isAr ? `${breakdown.post} منشور` : `${breakdown.post} posts`, { count: breakdown.post }) });
  if (breakdown.carousel > 0) items.push({ key: 'carouselCount', label: t('dashboard.sufficesFor.carouselCount', isAr ? `${breakdown.carousel} كاروسيل` : `${breakdown.carousel} carousels`, { count: breakdown.carousel }) });
  if (breakdown.repurpose > 0) items.push({ key: 'repurposeCount', label: t('dashboard.sufficesFor.repurposeCount', isAr ? `${breakdown.repurpose} حزمة` : `${breakdown.repurpose} bundles`, { count: breakdown.repurpose }) });

  const bundleLabelMap: Record<SufficesForShape['recommendedBundle']['labelKey'], string> = {
    fullJourney: isAr ? 'رحلة كاملة' : 'Full journey',
    contentPush: isAr ? 'دفعة محتوى' : 'Content push',
    roleRefresh: isAr ? 'تحديث للدور' : 'Role refresh',
    topUpFirst: isAr ? 'احتجت لشحن' : 'Top up first',
  };

  return (
    <Card padding="md" radius="lg" className="bg-teal-50 border-teal-100">
      <Eyebrow className="text-teal-700">
        {t('dashboard.sufficesFor.title', isAr ? 'رصيدك يكفي لـ' : 'Your balance is enough for')}
      </Eyebrow>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {items.slice(0, 4).map((it) => (
            <li key={it.key} className="font-ar text-[13px] text-v2-ink-2">
              <NumDisplay>{it.label}</NumDisplay>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 font-ar text-[13px] text-v2-dim">
          {isAr ? 'احتجت لشحن للمتابعة' : 'Top up to continue'}
        </p>
      )}
      {recommendedBundle.labelKey !== 'topUpFirst' && recommendedBundle.items.length > 0 && (
        <div className="mt-3 rounded-v2-md bg-white border border-teal-100 p-2.5">
          <Eyebrow className="text-teal-700">
            {t('dashboard.sufficesFor.recommendedBundle', isAr ? 'موصى به لك' : 'Recommended for you')}
          </Eyebrow>
          <p className="mt-1 font-ar text-[13px] font-semibold text-v2-ink">
            {bundleLabelMap[recommendedBundle.labelKey]}
          </p>
          <NumDisplay className="font-ar text-[11px] text-v2-dim">
            {recommendedBundle.totalCost} {isAr ? 'توكن' : 'tokens'}
          </NumDisplay>
        </div>
      )}
      {recommendedBundle.labelKey === 'topUpFirst' && (
        <button
          type="button"
          onClick={() => navigate('/v2/pricing')}
          className="mt-2 font-ar text-[12px] font-semibold text-teal-700 hover:text-teal-600 cursor-pointer"
        >
          {t('dashboard.sufficesFor.addTokens', isAr ? 'إضافة توكنات' : 'Add tokens')} →
        </button>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

function Home() {
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const initialLoading = useInitialLoading(400);
  const { user, profile, loading: authLoading } = useAuth();
  const loading = initialLoading || authLoading;

  const [pulse, setPulse] = useState<CareerPulseShape | null>(null);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [task, setTask] = useState<AiSuggestionShape | null>(null);
  const [taskLoading, setTaskLoading] = useState(true);
  const [feed, setFeed] = useState<ActivityLogEntryShape[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [drafts, setDrafts] = useState<DraftSummaryShape | null>(null);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [suffices, setSuffices] = useState<SufficesForShape | null>(null);
  const [streakDays, setStreakDays] = useState<number | null>(null);

  // Parallel fetch on mount + markVisited
  useEffect(() => {
    if (!user) return;
    const language = isAr ? 'ar' : 'en';
    let cancelled = false;

    trpc.dashboard.markVisited().then((r) => {
      if (!cancelled) setStreakDays(r.streakDays);
    }).catch(() => {});

    trpc.dashboard.getCareerPulse({ language }).then((r) => {
      if (!cancelled) {
        setPulse(r);
        setPulseLoading(false);
      }
    }).catch(() => { if (!cancelled) setPulseLoading(false); });

    trpc.dashboard.getNextTask({ language }).then((r) => {
      if (!cancelled) {
        setTask(r.task);
        setTaskLoading(false);
      }
    }).catch(() => { if (!cancelled) setTaskLoading(false); });

    trpc.dashboard.getActivityFeed({ days: 7, limit: 12 }).then((r) => {
      if (!cancelled) {
        setFeed(r.entries);
        setFeedLoading(false);
      }
    }).catch(() => { if (!cancelled) setFeedLoading(false); });

    trpc.dashboard.getDrafts().then((r) => {
      if (!cancelled) {
        setDrafts(r);
        setDraftsLoading(false);
      }
    }).catch(() => { if (!cancelled) setDraftsLoading(false); });

    trpc.dashboard.getSufficesFor().then((r) => {
      if (!cancelled) setSuffices(r);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [user, isAr]);

  const firstName = firstNameOf(profile, user, isAr);
  const greeting = useMemo(() => {
    const g = greetingFor(new Date(), isAr);
    return isAr ? `${g}، ${firstName}` : `${g}, ${firstName}`;
  }, [firstName, isAr]);

  const handleAct = async () => {
    if (!task) return;
    try {
      await trpc.dashboard.acknowledgeSuggestion({ suggestionId: task.id });
    } catch { /* ignore */ }
    navigate(task.cta_url);
  };

  const handleDismiss = async () => {
    if (!task) return;
    try {
      await trpc.dashboard.dismissSuggestion({ suggestionId: task.id });
    } catch { /* ignore */ }
    setTask(null);
  };

  return (
    <Phone>
      <Topbar
        sticky={false}
        bg="canvas"
        leading={
          <span className="flex items-center gap-1.5 px-2 py-1">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="9" stroke="var(--teal-700)" strokeWidth="1.4" />
              <circle cx="11" cy="11" r="5" stroke="var(--teal-700)" strokeWidth="1.4" />
              <circle cx="11" cy="11" r="1.4" fill="var(--teal-700)" />
            </svg>
            <span className="font-ar text-[15px] font-bold text-v2-ink">{isAr ? 'وصل' : 'Wassel'}</span>
          </span>
        }
        trailing={
          streakDays != null && streakDays > 1 ? (
            <span className="inline-flex items-center gap-1 rounded-v2-pill bg-teal-50 px-2 py-1 font-ar text-[11px] font-semibold text-teal-700">
              <span aria-hidden="true">🔥</span>
              <NumDisplay>{streakDays}</NumDisplay>
              <span>{t('dashboard.streak', isAr ? 'يوم' : 'd')}</span>
            </span>
          ) : null
        }
      />

      <div className="flex-1 px-[22px] pb-[110px] lg:px-0 lg:pb-0">

        {/* Greeting */}
        <div className="mt-5 mb-5 lg:mt-2 lg:mb-6">
          {loading ? (
            <Skeleton variant="text" width="60%" className="h-[28px] lg:h-[34px]" />
          ) : (
            <h1 className="truncate font-ar font-bold leading-tight text-v2-ink text-[22px] lg:text-[28px]">
              {greeting}
            </h1>
          )}
        </div>

        {/* Desktop: 12-col grid (main 8 / side 4). Mobile: stacked. */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-6">

          {/* Layer 1 — Next Task */}
          <div className="mb-6 lg:order-1 lg:col-span-8 lg:mb-0">
            <NextTaskCard
              task={task}
              loading={taskLoading}
              isAr={isAr}
              onAct={handleAct}
              onDismiss={handleDismiss}
            />
          </div>

          {/* Suffices For — sidebar on desktop, mobile shows after pulse */}
          <div className="hidden lg:block lg:order-2 lg:col-span-4">
            <SufficesForWidget
              data={suffices}
              loading={pulseLoading}
              isAr={isAr}
              navigate={navigate}
            />
          </div>

          {/* Layer 2 — Career Pulse */}
          <div className="mb-6 lg:order-3 lg:col-span-12 lg:mb-0 lg:mt-2">
            <CareerPulse pulse={pulse} loading={pulseLoading} isAr={isAr} navigate={navigate} />
          </div>

          {/* Suffices For mobile (after pulse so wallet context lands first) */}
          <div className="mb-6 lg:hidden">
            <SufficesForWidget
              data={suffices}
              loading={pulseLoading}
              isAr={isAr}
              navigate={navigate}
            />
          </div>

          {/* Layer 3 — Quick Wins */}
          {pulse?.latestQuickWins && pulse.latestQuickWins.length > 0 && (
            <div className="mb-6 lg:order-4 lg:col-span-12 lg:mt-2 lg:mb-0">
              <QuickWinsMini wins={pulse.latestQuickWins} isAr={isAr} navigate={navigate} />
            </div>
          )}

          {/* Layer 4 — Activity Timeline */}
          <div className="mb-6 lg:order-5 lg:col-span-8 lg:mt-2 lg:mb-0">
            <ActivityTimeline entries={feed} loading={feedLoading} isAr={isAr} navigate={navigate} />
          </div>

          {/* Layer 5 — Drafts */}
          <div className="mb-6 lg:order-6 lg:col-span-4 lg:mt-2 lg:mb-0">
            <DraftLibrary
              drafts={drafts}
              loading={draftsLoading}
              isAr={isAr}
              navigate={navigate}
            />
          </div>
        </div>
      </div>

      <BottomNav
        active="home"
        items={[
          { id: 'home',    label: isAr ? 'الرئيسية' : 'Home',    icon: <span /> , onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: isAr ? 'الرادار' : 'Radar',   icon: <span /> , onSelect: () => navigate('/v2/analyze') },
          { id: 'posts',   label: isAr ? 'الاستوديو' : 'Studio', icon: <span /> , onSelect: () => navigate('/v2/posts') },
          { id: 'profile', label: isAr ? 'حسابي' : 'Account',    icon: <span /> , onSelect: () => navigate('/v2/me') },
        ]}
        fabIcon="plus"
        onFabClick={() => navigate('/v2/analyze')}
      />
    </Phone>
  );
}

export default Home;
