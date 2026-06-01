/**
 * /v2/analyze — Radar v2 preflight.
 *
 * The Career Copilot reads career_profile (R02 — never re-ask). The user
 * just sees their target role + LinkedIn, taps "Start", or chooses a
 * one-session role override. No URL field, no goal picker, no industry chip
 * list — those questions were already answered during onboarding.
 *
 * If there's no career_profile, AuthGate already redirected to onboarding;
 * this page renders a graceful empty state for the (rare) race condition.
 *
 * If a cached analysis exists for the canonical target role, the primary CTA
 * becomes "View latest analysis (free)" — only "Run a fresh analysis" charges.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Sparkles, Briefcase, Link as LinkIcon, Bell, RefreshCw } from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Card from '@/components/v2/Card';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import Input from '@/components/v2/Input';
import Skeleton from '@/components/v2/Skeleton';
import NumDisplay from '@/components/v2/NumDisplay';
import ErrorBanner from '@/components/v2/ErrorBanner';
import { trpc } from '@/lib/trpc';

type PreflightShape = Awaited<ReturnType<typeof trpc.radar.preflight>>;

export default function RadarPreflight() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [, navigate] = useLocation();

  const [pre, setPre] = useState<PreflightShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideRole, setOverrideRole] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await trpc.radar.preflight();
        if (cancelled) return;
        setPre(data);
        if (!data.profile) {
          // Race against AuthGate — if the user really has no profile, push them to onboarding.
          navigate('/v2/onboarding', { replace: true });
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate, reloadTick]);

  function startAnalysis(override?: string) {
    const params = new URLSearchParams();
    if (override) params.set('override', override);
    navigate(`/v2/analyze/loading${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function viewCached() {
    if (pre?.latestCacheId) {
      navigate(`/v2/analyze/result/${pre.latestCacheId}`);
    }
  }

  async function handleOverrideSubmit() {
    if (!overrideRole.trim()) return;
    setOverrideSubmitting(true);
    try {
      // Persist a 24h section_override so the analysis pages can pick it up,
      // then start the run with the same role.
      await trpc.radar.sessionOverride({ targetRole: overrideRole.trim() });
      setOverrideOpen(false);
      startAnalysis(overrideRole.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOverrideSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Phone>
        <Topbar
          sticky
          bg="canvas"
          leading={
            <span className="px-2 font-ar text-[15px] font-bold text-v2-ink">
              {t('radar.title')}
            </span>
          }
        />
        <div className="flex-1 px-[22px] pt-6">
          <Skeleton variant="text" lines={2} className="mb-6" />
          <Skeleton variant="card" className="mb-4" />
          <Skeleton variant="card" />
        </div>
      </Phone>
    );
  }

  if (!pre?.profile) {
    // AuthGate should have caught this — render a manual nudge as a fallback.
    return (
      <Phone>
        <Topbar
          sticky
          bg="canvas"
          leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{t('radar.title')}</span>}
        />
        <div className="flex-1 px-[22px] pt-10">
          <Card padding="lg" radius="lg" className="text-center">
            <Eyebrow className="mb-2 block">RADAR</Eyebrow>
            <h2 className="font-ar text-[18px] font-bold text-v2-ink">
              {t('radar.errors.noCareerProfile')}
            </h2>
            <p className="mt-2 font-ar text-[13px] text-v2-dim">
              {isAr
                ? 'أكمل البروفايل المهني لتشغيل الرادار'
                : 'Complete your career profile to run the Radar.'}
            </p>
            <Button
              variant="primary"
              className="mt-5"
              onClick={() => navigate('/v2/onboarding')}
            >
              {isAr ? 'إكمال البروفايل' : 'Complete profile'}
            </Button>
          </Card>
        </div>
      </Phone>
    );
  }

  const profile = pre.profile;
  const triggers = pre.triggers ?? [];
  const hasTriggers = triggers.length > 0;

  return (
    <Phone>
      <Topbar
        sticky
        bg="canvas"
        leading={
          <span className="px-2 font-ar text-[15px] font-bold text-v2-ink">
            {t('radar.title')}
          </span>
        }
      />

      <div className="flex-1 px-[22px] pb-[110px] lg:px-0 lg:pb-0">
        <div className="mt-5 mb-6 lg:mt-2 lg:mb-8">
          <Eyebrow className="mb-1.5 block">RADAR</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[26px] lg:text-[32px]">
            {t('radar.preflight.welcome')}
          </h1>
          <p className="mt-2 font-ar text-[14px] text-v2-dim">
            {t('radar.subtitle')}
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorBanner
              messageKey="errors.radar.preflight"
              category="ai_service"
              recovery="user_action_required"
              rawMessage={error}
              onRetry={() => setReloadTick((n) => n + 1)}
            />
          </div>
        )}

        {/* Snapshot card — what we already know about you. R02 in practice. */}
        <Card padding="lg" radius="lg" elevated className="mb-4">
          <div className="grid gap-4">
            <div>
              <Eyebrow className="mb-1 block">{t('radar.preflight.yourTargetRole')}</Eyebrow>
              <div className="flex items-center gap-2">
                <Briefcase size={16} className="shrink-0 text-v2-mute" />
                <span className="font-ar text-[16px] font-semibold text-v2-ink">
                  {profile.target_role}
                </span>
                <span className="font-ar text-[12px] text-v2-mute">· {profile.industry}</span>
              </div>
            </div>
            <div>
              <Eyebrow className="mb-1 block">{t('radar.preflight.yourLinkedin')}</Eyebrow>
              <div className="flex items-center gap-2">
                <LinkIcon size={16} className="shrink-0 text-v2-mute" />
                {profile.linkedin_url ? (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="font-en text-[13px] text-v2-body underline-offset-2 hover:underline"
                  >
                    {profile.linkedin_url.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  <span className="font-ar text-[13px] text-v2-mute">
                    {isAr ? 'غير مضاف' : 'not set'}
                  </span>
                )}
              </div>
            </div>

            {/* Override link — opens an inline panel rather than a modal */}
            {!overrideOpen ? (
              <button
                type="button"
                onClick={() => {
                  setOverrideRole(profile.target_role);
                  setOverrideOpen(true);
                }}
                className="self-start font-ar text-[13px] font-semibold text-teal-700 underline-offset-2 hover:underline"
              >
                {t('radar.preflight.overrideForSession')}
              </button>
            ) : (
              <div className="mt-1 rounded-v2-md border border-teal-200 bg-teal-50 p-3">
                <Input
                  label={t('radar.preflight.yourTargetRole')}
                  value={overrideRole}
                  onChange={(e) => setOverrideRole(e.target.value)}
                  maxLength={120}
                  hint={isAr
                    ? 'يستخدم لهذا التحليل فقط — لن يُعدّل بروفايلك المهني'
                    : 'Used for this analysis only — your career profile is unchanged.'}
                />
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleOverrideSubmit}
                    disabled={!overrideRole.trim() || overrideSubmitting}
                  >
                    {overrideSubmitting
                      ? (isAr ? 'جارٍ البدء…' : 'Starting…')
                      : (isAr ? 'حلّل بهذا الدور' : 'Analyse with this role')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setOverrideOpen(false)}
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Trigger chip(s) — only shown when something has actually changed
            since the last Radar run. */}
        {hasTriggers && (
          <Card padding="md" radius="md" className="mb-4 border-amber-200 bg-amber-50">
            <div className="flex items-start gap-2">
              <Bell size={16} className="mt-0.5 shrink-0 text-amber-700" />
              <div className="flex-1">
                <p className="font-ar text-[13px] font-semibold text-amber-900">
                  {t('radar.preflight.triggersDetected')}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 ps-4 font-ar text-[12px] text-amber-800">
                  {triggers.slice(0, 3).map((tr, i) => (
                    <li key={i}>{readableTrigger(tr.type, isAr)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        {/* Primary CTA — depends on whether a cache hit is available for the
            canonical target role. Override flow uses its own button above. */}
        <div className="flex flex-col gap-2.5">
          {pre.hasCache && pre.latestCacheId ? (
            <>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                leadingIcon={<Sparkles size={18} />}
                onClick={viewCached}
              >
                {t('radar.preflight.viewCached')}
              </Button>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                leadingIcon={<RefreshCw size={16} />}
                onClick={() => startAnalysis()}
              >
                {isAr ? 'تحليل جديد · مجاني' : 'Fresh analysis · free'}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              leadingIcon={<Sparkles size={18} />}
              onClick={() => startAnalysis()}
            >
              {isAr ? 'ابدأ التحليل المجاني' : 'Start free analysis'}
            </Button>
          )}
          <p className="text-center font-ar text-[12px] text-v2-mute">
            {isAr
              ? <>التشخيص مجاني · الإصلاحات الجاهزة <NumDisplay>{pre.cost}</NumDisplay> نقطة عند الفتح</>
              : <>Diagnostic is free · ready-made fixes <NumDisplay>{pre.cost}</NumDisplay> tokens to unlock</>}
          </p>
        </div>

        {pre.latestCachedAt && (
          <p className="mt-4 text-center font-ar text-[11px] text-v2-mute">
            {t('radar.result.cachedFrom')}:{' '}
            <NumDisplay>{formatShortDate(pre.latestCachedAt, isAr)}</NumDisplay>
          </p>
        )}
      </div>

      <BottomNav
        active="analyze"
        items={[
          { id: 'home',    label: isAr ? 'الرئيسية'  : 'Home',    icon: <span /> , onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: isAr ? 'الرادار'    : 'Radar',   icon: <span /> , onSelect: () => navigate('/v2/analyze') },
          { id: 'posts',   label: isAr ? 'الاستوديو'  : 'Studio',  icon: <span /> , onSelect: () => navigate('/v2/posts') },
          { id: 'profile', label: isAr ? 'حسابي'      : 'Account', icon: <span /> , onSelect: () => navigate('/v2/me') },
        ]}
        fabIcon="arrow"
        fabLabel={isAr ? 'ابدأ التحليل' : 'Start analysis'}
        onFabClick={() => startAnalysis()}
      />
    </Phone>
  );
}

function readableTrigger(type: string, isAr: boolean): string {
  const map: Record<string, [string, string]> = {
    '5_new_posts':        ['نشرت 5 منشورات منذ آخر تحليل',          'You have published 5 posts since your last analysis'],
    'target_role_changed':['تغيّر دورك المستهدف',                   'Your target role has changed'],
    'new_resume':         ['أنشأت سيرة ذاتية جديدة',                 'You created a new resume'],
    'linkedin_first_link':['أضفت رابط LinkedIn لأول مرة',            'You linked LinkedIn for the first time'],
    '30_days_passed':     ['مرّ شهر على آخر تحليل',                  '30 days have passed since your last analysis'],
    'profile_data_changed':['تحدّثت بياناتك في البروفايل المهني',     'Your career profile data has changed'],
    'manual':             ['لم تجرِ تحليلاً بعد',                     'You have not run an analysis yet'],
  };
  const e = map[type];
  if (!e) return type;
  return isAr ? e[0] : e[1];
}

function formatShortDate(iso: string, isAr: boolean): string {
  try {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat(isAr ? 'en-GB' : 'en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    return fmt.format(d);
  } catch {
    return iso;
  }
}
