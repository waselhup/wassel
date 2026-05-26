/**
 * /v2/cvs/new — Resume v2 preflight.
 *
 * Mirrors the Radar preflight pattern. Reads career_profile (R02), shows
 * the recommended template + reason, lets the user override target role
 * for a single session, and offers either:
 *   - "View latest" if a cached version exists for the canonical role (0 tokens)
 *   - "Build resume (179 tokens)" otherwise
 *
 * If career_profile is missing, AuthGate should have redirected to onboarding
 * already — we render a fallback nudge for the race condition.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import {
  FileText, Briefcase, Link as LinkIcon, AlertCircle, Sparkles, Palette,
  ChevronRight,
} from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Card from '@/components/v2/Card';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import Input from '@/components/v2/Input';
import Skeleton from '@/components/v2/Skeleton';
import NumDisplay from '@/components/v2/NumDisplay';
import { trpc, type ResumeTemplateShape } from '@/lib/trpc';

type PreflightShape = Awaited<ReturnType<typeof trpc.resume.preflight>>;

export default function CVPreflight() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [, navigate] = useLocation();

  const [pre, setPre] = useState<PreflightShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideRole, setOverrideRole] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const [templateChooserOpen, setTemplateChooserOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await trpc.resume.preflight({ language: isAr ? 'ar' : 'en' });
      setPre(data);
      setSelectedTemplateId(data.recommendedTemplate?.id ?? null);
      if (!data.profile) {
        navigate('/v2/onboarding', { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function startBuild(overrideRoleOverride?: string) {
    if (!selectedTemplateId) return;
    const params = new URLSearchParams();
    params.set('template', selectedTemplateId);
    if (overrideRoleOverride) params.set('override', overrideRoleOverride);
    navigate(`/v2/cvs/building?${params.toString()}`);
  }

  function viewCached() {
    if (pre?.latestVersionId) {
      navigate(`/v2/cvs/${pre.latestVersionId}`);
    } else if (pre?.latestCacheId) {
      // Edge case: cache exists but no version row → still navigate to the list
      navigate('/v2/cvs');
    }
  }

  async function handleOverrideSubmit() {
    if (!overrideRole.trim()) return;
    setOverrideSubmitting(true);
    try {
      await trpc.resume.sessionOverride({ targetRole: overrideRole.trim() });
      setOverrideOpen(false);
      startBuild(overrideRole.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOverrideSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Phone>
        <Topbar sticky bg="canvas" leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{t('resume.title')}</span>} />
        <div className="flex-1 px-[22px] pt-6">
          <Skeleton variant="text" lines={2} className="mb-6" />
          <Skeleton variant="card" className="mb-4" />
          <Skeleton variant="card" />
        </div>
      </Phone>
    );
  }

  if (!pre?.profile) {
    return (
      <Phone>
        <Topbar sticky bg="canvas" leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{t('resume.title')}</span>} />
        <div className="flex-1 px-[22px] pt-10">
          <Card padding="lg" radius="lg" className="text-center">
            <Eyebrow className="mb-2 block">RESUME</Eyebrow>
            <h2 className="font-ar text-[18px] font-bold text-v2-ink">
              {t('resume.errors.noCareerProfile')}
            </h2>
            <Button variant="primary" className="mt-5" onClick={() => navigate('/v2/onboarding')}>
              {isAr ? 'إكمال البروفايل' : 'Complete profile'}
            </Button>
          </Card>
        </div>
      </Phone>
    );
  }

  const profile = pre.profile;
  const tmpl = pre.alternativeTemplates.concat(pre.recommendedTemplate ? [pre.recommendedTemplate] : []).find((x) => x.id === selectedTemplateId) ?? pre.recommendedTemplate;

  return (
    <Phone>
      <Topbar sticky bg="canvas" leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{t('resume.title')}</span>} />

      <div className="flex-1 px-[22px] pb-[110px] lg:px-0 lg:pb-0">
        <div className="mt-5 mb-6 lg:mt-2 lg:mb-8">
          <Eyebrow className="mb-1.5 block">RESUME</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[26px] lg:text-[32px]">
            {t('resume.preflight.welcome')}
          </h1>
        </div>

        {error && (
          <Card padding="md" radius="md" className="mb-4 border-rose-200 bg-rose-50">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
              <p className="font-ar text-[13px] text-rose-700">{error}</p>
            </div>
          </Card>
        )}

        {/* Snapshot — target role + LinkedIn pulled from career_profile */}
        <Card padding="lg" radius="lg" elevated className="mb-4">
          <div className="grid gap-4">
            <div>
              <Eyebrow className="mb-1 block">{t('resume.preflight.targetRole')}</Eyebrow>
              <div className="flex items-center gap-2">
                <Briefcase size={16} className="shrink-0 text-v2-mute" />
                <span className="font-ar text-[16px] font-semibold text-v2-ink">{profile.target_role}</span>
                <span className="font-ar text-[12px] text-v2-mute">· {profile.industry}</span>
              </div>
            </div>
            <div>
              <Eyebrow className="mb-1 block">{isAr ? 'حساب لينكد إن' : 'LinkedIn profile'}</Eyebrow>
              <div className="flex items-center gap-2">
                <LinkIcon size={16} className="shrink-0 text-v2-mute" />
                {profile.linkedin_url ? (
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" dir="ltr" className="font-en text-[13px] text-v2-body underline-offset-2 hover:underline">
                    {profile.linkedin_url.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  <span className="font-ar text-[13px] text-v2-mute">{isAr ? 'غير مضاف' : 'not set'}</span>
                )}
              </div>
            </div>

            {/* Override panel */}
            {!overrideOpen ? (
              <button
                type="button"
                onClick={() => { setOverrideRole(profile.target_role); setOverrideOpen(true); }}
                className="self-start font-ar text-[13px] font-semibold text-teal-700 underline-offset-2 hover:underline"
              >
                {t('resume.preflight.overrideForSession')}
              </button>
            ) : (
              <div className="mt-1 rounded-v2-md border border-teal-200 bg-teal-50 p-3">
                <Input
                  label={t('resume.preflight.targetRole')}
                  value={overrideRole}
                  onChange={(e) => setOverrideRole(e.target.value)}
                  maxLength={120}
                  hint={isAr
                    ? 'يستخدم لهذه السيرة فقط — لن يُعدّل بروفايلك المهني'
                    : 'Used for this build only — your career profile is unchanged.'}
                />
                <div className="mt-3 flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleOverrideSubmit} disabled={!overrideRole.trim() || overrideSubmitting}>
                    {overrideSubmitting
                      ? (isAr ? 'جارٍ البدء…' : 'Starting…')
                      : (isAr ? 'ابنِ بهذا الدور' : 'Build with this role')}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setOverrideOpen(false)}>
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Template recommendation */}
        {tmpl && (
          <Card padding="lg" radius="lg" className="mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Eyebrow className="mb-1 block">{t('resume.preflight.recommendedTemplate')}</Eyebrow>
                <div className="flex items-center gap-2">
                  <Palette size={18} className="text-teal-600" />
                  <span className="font-ar text-[16px] font-semibold text-v2-ink">
                    {isAr ? tmpl.display_name_ar : tmpl.display_name_en}
                  </span>
                </div>
                <p className="mt-1 font-ar text-[13px] text-v2-body">
                  {isAr ? (tmpl.description_ar ?? '') : (tmpl.description_en ?? '')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTemplateChooserOpen((s) => !s)}
                className="shrink-0 font-ar text-[12px] font-semibold text-teal-700 hover:underline"
              >
                {t('resume.preflight.changeTemplate')}
              </button>
            </div>
            {templateChooserOpen && pre.alternativeTemplates.length > 0 && (
              <div className="mt-4 grid gap-2">
                {[pre.recommendedTemplate, ...pre.alternativeTemplates].filter(Boolean).map((alt) =>
                  alt ? (
                    <TemplateOption
                      key={alt.id}
                      tmpl={alt}
                      selected={selectedTemplateId === alt.id}
                      isAr={isAr}
                      onSelect={() => { setSelectedTemplateId(alt.id); setTemplateChooserOpen(false); }}
                    />
                  ) : null,
                )}
              </div>
            )}
          </Card>
        )}

        {/* Primary CTA */}
        <div className="flex flex-col gap-2.5">
          {pre.hasCache && pre.latestVersionId ? (
            <>
              <Button variant="primary" size="lg" fullWidth leadingIcon={<Sparkles size={18} />} onClick={viewCached}>
                {t('resume.preflight.viewCached')}
              </Button>
              <Button variant="secondary" size="md" fullWidth leadingIcon={<FileText size={16} />} onClick={() => startBuild()} disabled={!selectedTemplateId}>
                {isAr ? `سيرة جديدة (179 توكن)` : `Fresh build (179 tokens)`}
              </Button>
            </>
          ) : (
            <Button variant="primary" size="lg" fullWidth leadingIcon={<FileText size={18} />} onClick={() => startBuild()} disabled={!selectedTemplateId}>
              {isAr
                ? `ابنِ السيرة (${pre.estimatedCost} توكن)`
                : `Build Resume (${pre.estimatedCost} tokens)`}
            </Button>
          )}
          <p className="text-center font-ar text-[12px] text-v2-mute">
            {isAr
              ? <><NumDisplay>{pre.estimatedCost || 179}</NumDisplay>{' '}توكن — تخصم بعد نجاح البناء فقط</>
              : <><NumDisplay>{pre.estimatedCost || 179}</NumDisplay>{' '}tokens — only charged on successful build</>}
          </p>
        </div>

        {/* Versions count snapshot */}
        {(pre.activeVersionsCount > 0 || pre.legacyCount > 0) && (
          <p className="mt-4 text-center font-ar text-[11px] text-v2-mute">
            {isAr
              ? <><NumDisplay>{pre.activeVersionsCount}</NumDisplay>{' '}نشطة · <NumDisplay>{pre.legacyCount}</NumDisplay>{' '}قديمة</>
              : <><NumDisplay>{pre.activeVersionsCount}</NumDisplay>{' '}active · <NumDisplay>{pre.legacyCount}</NumDisplay>{' '}legacy</>}
          </p>
        )}
      </div>

      <BottomNav
        active="profile"
        items={[
          { id: 'home',    label: isAr ? 'الرئيسية'  : 'Home',    icon: <span /> , onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: isAr ? 'الرادار'    : 'Radar',   icon: <span /> , onSelect: () => navigate('/v2/analyze') },
          { id: 'posts',   label: isAr ? 'الاستوديو'  : 'Studio',  icon: <span /> , onSelect: () => navigate('/v2/posts') },
          { id: 'profile', label: isAr ? 'حسابي'      : 'Account', icon: <span /> , onSelect: () => navigate('/v2/me') },
        ]}
        fabIcon="arrow"
        fabLabel={isAr ? 'ابدأ' : 'Start'}
        onFabClick={() => startBuild()}
      />
    </Phone>
  );
}

function TemplateOption({ tmpl, selected, isAr, onSelect }: {
  tmpl: ResumeTemplateShape;
  selected: boolean;
  isAr: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-v2-md border px-3 py-3 text-start transition-colors ${
        selected ? 'border-teal-500 bg-teal-50' : 'border-v2-line bg-v2-surface hover:bg-v2-canvas-2'
      }`}
    >
      <Palette size={18} className={`mt-0.5 shrink-0 ${selected ? 'text-teal-700' : 'text-v2-mute'}`} />
      <div className="min-w-0 flex-1">
        <div className="font-ar text-[14px] font-semibold text-v2-ink">
          {isAr ? tmpl.display_name_ar : tmpl.display_name_en}
        </div>
        <p className="mt-0.5 font-ar text-[12px] text-v2-body">
          {isAr ? (tmpl.description_ar ?? '') : (tmpl.description_en ?? '')}
        </p>
      </div>
      {selected && <ChevronRight size={16} className="text-teal-700 rtl:rotate-180" />}
    </button>
  );
}
