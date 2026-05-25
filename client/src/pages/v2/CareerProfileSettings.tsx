import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';

type Goal = 'job_search' | 'promotion' | 'personal_brand' | 'opportunities' | 'career_change';
type Level = 'entry' | 'mid' | 'senior' | 'executive';
type Language = 'ar' | 'en';

interface Profile {
  user_id: string;
  goal: Goal;
  level: Level;
  target_role: string;
  industry: string;
  primary_language: Language;
  linkedin_url: string | null;
  manual_about: string | null;
  manual_top_skills: string[] | null;
  manual_current_role: string | null;
  manual_years_experience: number | null;
  manual_education: string | null;
  created_at: string;
  updated_at: string;
}

interface Override {
  id: string;
  section: 'radar' | 'resume' | 'content';
  payload: Record<string, unknown>;
  created_at: string;
  expires_at: string;
}

export default function CareerProfileSettings() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [result, ovr] = await Promise.all([
          trpc.careerProfile.get(),
          trpc.careerProfile.listOverrides(),
        ]);
        if (cancelled) return;
        if (result?.profile) {
          setProfile(result.profile as Profile);
          setDraft(result.profile as Profile);
        }
        setOverrides((ovr?.overrides as Override[]) ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = {};
      const fields: Array<keyof Profile> = [
        'goal', 'level', 'target_role', 'industry', 'primary_language',
        'linkedin_url', 'manual_about', 'manual_current_role',
        'manual_years_experience', 'manual_education',
      ];
      for (const f of fields) {
        if (draft[f] !== profile[f]) patch[f] = draft[f] ?? null;
      }
      // Top skills are an array — compare by JSON
      if (JSON.stringify(draft.manual_top_skills ?? null) !== JSON.stringify(profile.manual_top_skills ?? null)) {
        patch.manual_top_skills = draft.manual_top_skills ?? null;
      }
      if (Object.keys(patch).length === 0) {
        setSavedAt(Date.now());
        return;
      }
      const result = await trpc.careerProfile.update(patch);
      if (result?.profile) {
        setProfile(result.profile as Profile);
        setDraft(result.profile as Profile);
      }
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOverride(id: string) {
    try {
      await trpc.careerProfile.deleteOverride({ id });
      setOverrides((prev) => prev.filter((o) => o.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleReset() {
    setResetting(true);
    setError(null);
    try {
      await trpc.careerProfile.delete();
      navigate('/v2/onboarding');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-4 py-10 font-ar text-[14px] text-v2-ink-muted">
        {t('careerProfile.loading')}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col items-center px-4 py-16 text-center">
        <h1 className="font-ar text-[22px] font-semibold text-v2-ink">{t('careerProfile.empty.title')}</h1>
        <p className="mt-3 font-ar text-[14px] text-v2-ink-muted">{t('careerProfile.empty.subtitle')}</p>
        <button
          type="button"
          onClick={() => navigate('/v2/onboarding')}
          className="mt-6 rounded-v2-md bg-v2-ink px-5 py-2 font-ar text-[13px] font-semibold text-white"
        >
          {t('careerProfile.empty.cta')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-32 pt-6">
      <header className="mb-8 space-y-1">
        <h1 className="font-ar text-[24px] font-semibold text-v2-ink">{t('careerProfile.title')}</h1>
        <p className="font-ar text-[13px] text-v2-ink-muted">{t('careerProfile.subtitle')}</p>
      </header>

      {error && (
        <div className="mb-6 rounded-v2-md border border-rose-200 bg-rose-50 p-3 font-ar text-[13px] text-rose-700">
          {error}
        </div>
      )}

      {savedAt && Date.now() - savedAt < 4000 && (
        <div className="mb-6 rounded-v2-md border border-emerald-200 bg-emerald-50 p-3 font-ar text-[13px] text-emerald-800">
          {t('careerProfile.saved')}
        </div>
      )}

      {/* Form */}
      <div className="space-y-5">
        <Field label={t('careerProfile.fields.goal')}>
          <select
            value={draft.goal ?? profile.goal}
            onChange={(e) => setDraft((d) => ({ ...d, goal: e.target.value as Goal }))}
            className="w-full rounded-v2-md border border-v2-line bg-white px-3 py-2 font-ar text-[14px] text-v2-ink"
          >
            {(['job_search', 'promotion', 'personal_brand', 'opportunities', 'career_change'] as Goal[]).map((g) => (
              <option key={g} value={g}>{t(`onboarding.step1.goals.${g}.label`)}</option>
            ))}
          </select>
        </Field>

        <Field label={t('careerProfile.fields.level')}>
          <select
            value={draft.level ?? profile.level}
            onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value as Level }))}
            className="w-full rounded-v2-md border border-v2-line bg-white px-3 py-2 font-ar text-[14px] text-v2-ink"
          >
            {(['entry', 'mid', 'senior', 'executive'] as Level[]).map((l) => (
              <option key={l} value={l}>{t(`onboarding.step2.levels.${l}.label`)}</option>
            ))}
          </select>
        </Field>

        <Field label={t('careerProfile.fields.target_role')}>
          <input
            type="text"
            maxLength={80}
            value={draft.target_role ?? profile.target_role}
            onChange={(e) => setDraft((d) => ({ ...d, target_role: e.target.value }))}
            className="w-full rounded-v2-md border border-v2-line bg-white px-3 py-2 font-ar text-[14px] text-v2-ink"
          />
        </Field>

        <Field label={t('careerProfile.fields.industry')}>
          <input
            type="text"
            maxLength={60}
            value={draft.industry ?? profile.industry}
            onChange={(e) => setDraft((d) => ({ ...d, industry: e.target.value }))}
            className="w-full rounded-v2-md border border-v2-line bg-white px-3 py-2 font-ar text-[14px] text-v2-ink"
          />
        </Field>

        <Field label={t('careerProfile.fields.primary_language')}>
          <select
            value={draft.primary_language ?? profile.primary_language}
            onChange={(e) => setDraft((d) => ({ ...d, primary_language: e.target.value as Language }))}
            className="w-full rounded-v2-md border border-v2-line bg-white px-3 py-2 font-ar text-[14px] text-v2-ink"
          >
            <option value="ar">{t('onboarding.step3.fields.language.options.ar')}</option>
            <option value="en">{t('onboarding.step3.fields.language.options.en')}</option>
          </select>
        </Field>

        <Field label={t('careerProfile.fields.linkedin_url')}>
          <input
            type="url"
            dir="ltr"
            value={draft.linkedin_url ?? profile.linkedin_url ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, linkedin_url: e.target.value || null }))}
            className="w-full rounded-v2-md border border-v2-line bg-white px-3 py-2 font-mono text-[13px] text-v2-ink"
            placeholder="https://www.linkedin.com/in/..."
          />
        </Field>

        <Field label={t('careerProfile.fields.manual_about')}>
          <textarea
            rows={4}
            maxLength={1000}
            value={draft.manual_about ?? profile.manual_about ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, manual_about: e.target.value || null }))}
            className="w-full resize-y rounded-v2-md border border-v2-line bg-white px-3 py-2 font-ar text-[14px] text-v2-ink"
          />
        </Field>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-v2-md bg-v2-ink px-5 py-2 font-ar text-[13px] font-semibold text-white disabled:opacity-40"
          >
            {saving ? t('careerProfile.saving') : t('careerProfile.save')}
          </button>
        </div>
      </div>

      {/* Overrides */}
      <section className="mt-10 space-y-3">
        <h2 className="font-ar text-[18px] font-semibold text-v2-ink">{t('careerProfile.overrides.title')}</h2>
        <p className="font-ar text-[12px] text-v2-ink-muted">{t('careerProfile.overrides.subtitle')}</p>
        {overrides.length === 0 ? (
          <p className="rounded-v2-md border border-dashed border-v2-line bg-v2-canvas px-4 py-6 text-center font-ar text-[13px] text-v2-ink-muted">
            {t('careerProfile.overrides.empty')}
          </p>
        ) : (
          <ul className="space-y-2">
            {overrides.map((o) => (
              <li
                key={o.id}
                className="flex items-start justify-between gap-3 rounded-v2-md border border-v2-line bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-ar text-[13px] font-semibold text-v2-ink">
                    {t(`careerProfile.overrides.section.${o.section}`)}
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] text-v2-ink-muted">
                    {JSON.stringify(o.payload)}
                  </div>
                  <div className="mt-1 font-ar text-[11px] text-v2-ink-muted">
                    {t('careerProfile.overrides.expires_at', { iso: new Date(o.expires_at).toLocaleString() })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteOverride(o.id)}
                  className="rounded-v2-md border border-v2-line bg-white px-3 py-1 font-ar text-[12px] text-rose-700 hover:bg-rose-50"
                >
                  {t('careerProfile.overrides.delete')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reset profile */}
      <section className="mt-10 space-y-3 rounded-v2-md border border-rose-200 bg-rose-50 p-4">
        <h2 className="font-ar text-[16px] font-semibold text-rose-800">{t('careerProfile.reset.title')}</h2>
        <p className="font-ar text-[13px] text-rose-700">{t('careerProfile.reset.subtitle')}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            placeholder={t('careerProfile.reset.confirm_placeholder')}
            className="flex-1 rounded-v2-md border border-rose-300 bg-white px-3 py-2 font-ar text-[13px] text-v2-ink"
          />
          <button
            type="button"
            disabled={resetting || resetConfirm !== t('careerProfile.reset.confirm_word')}
            onClick={handleReset}
            className="rounded-v2-md bg-rose-700 px-4 py-2 font-ar text-[13px] font-semibold text-white disabled:opacity-40"
          >
            {resetting ? t('careerProfile.reset.resetting') : t('careerProfile.reset.cta')}
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block font-ar text-[13px] font-semibold text-v2-ink">{label}</label>
      {children}
    </div>
  );
}
