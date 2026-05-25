import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import OnboardingStep1Goal, { type Goal } from './OnboardingStep1Goal';
import OnboardingStep2Level, { type Level } from './OnboardingStep2Level';
import OnboardingStep3Identity, { type Language } from './OnboardingStep3Identity';
import OnboardingStep4LinkedIn, { type LinkedInData } from './OnboardingStep4LinkedIn';
import OnboardingComplete from './OnboardingComplete';

type WizardState = {
  step: 1 | 2 | 3 | 4 | 5; // 5 = complete
  goal: Goal | null;
  level: Level | null;
  targetRole: string;
  industry: string;
  language: Language;
  linkedin: LinkedInData;
};

const INITIAL: WizardState = {
  step: 1,
  goal: null,
  level: null,
  targetRole: '',
  industry: '',
  language: 'ar',
  linkedin: {
    linkedinUrl: null,
    manualAbout: null,
    manualTopSkills: null,
    manualCurrentRole: null,
    manualYearsExperience: null,
    manualEducation: null,
  },
};

function storageKey(userId: string | undefined): string | null {
  return userId ? `wassel.onboarding.${userId}` : null;
}

export default function OnboardingWizard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [state, setState] = useState<WizardState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdProfile, setCreatedProfile] = useState<unknown>(null);

  // Hydrate from localStorage so a mid-flow refresh doesn't lose progress.
  useEffect(() => {
    const key = storageKey(user?.id);
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as WizardState;
        setState((prev) => ({ ...prev, ...parsed, step: Math.min(parsed.step ?? 1, 4) as WizardState['step'] }));
      }
    } catch {
      /* ignore corrupt draft */
    }
  }, [user?.id]);

  // Persist on every change, except after final submission (we clear then).
  useEffect(() => {
    const key = storageKey(user?.id);
    if (!key || state.step === 5) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* quota / private-mode — non-fatal */
    }
  }, [state, user?.id]);

  const setPatch = (patch: Partial<WizardState>) => setState((prev) => ({ ...prev, ...patch }));
  const setLinkedIn = (patch: Partial<LinkedInData>) =>
    setState((prev) => ({ ...prev, linkedin: { ...prev.linkedin, ...patch } }));

  const canProceed = (() => {
    switch (state.step) {
      case 1: return state.goal !== null;
      case 2: return state.level !== null;
      case 3: return state.targetRole.trim().length > 0 && state.industry.trim().length > 0;
      case 4: return true; // step 4 is optional
      default: return false;
    }
  })();

  const progressPct = (Math.min(state.step, 4) / 4) * 100;

  async function handleSubmit() {
    if (!state.goal || !state.level) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await trpc.careerProfile.create({
        goal: state.goal,
        level: state.level,
        target_role: state.targetRole.trim(),
        industry: state.industry.trim(),
        primary_language: state.language,
        linkedin_url: state.linkedin.linkedinUrl,
        manual_about: state.linkedin.manualAbout,
        manual_top_skills: state.linkedin.manualTopSkills,
        manual_current_role: state.linkedin.manualCurrentRole,
        manual_years_experience: state.linkedin.manualYearsExperience,
        manual_education: state.linkedin.manualEducation,
      });
      setCreatedProfile(result.profile);

      // Switch UI language to user's preference (so the Complete screen is in
      // their primary language).
      if (state.language !== i18n.language) {
        try { await i18n.changeLanguage(state.language); } catch { /* non-fatal */ }
      }

      // Clear draft and advance to Complete
      const key = storageKey(user?.id);
      if (key) localStorage.removeItem(key);

      setState((prev) => ({ ...prev, step: 5 }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('onboarding.errors.create_failed');
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkipLinkedIn() {
    void handleSubmit();
  }

  function handleNext() {
    if (state.step === 4) {
      void handleSubmit();
    } else {
      setState((prev) => ({ ...prev, step: (prev.step + 1) as WizardState['step'] }));
    }
  }

  function handleBack() {
    setState((prev) => ({ ...prev, step: Math.max(1, prev.step - 1) as WizardState['step'] }));
  }

  if (state.step === 5) {
    return (
      <OnboardingComplete
        goal={state.goal!}
        level={state.level!}
        targetRole={state.targetRole}
        industry={state.industry}
        hasLinkedIn={Boolean(state.linkedin.linkedinUrl)}
        onPrimaryAction={() => {
          void createdProfile;
          // /v2/analyze ships in Sprint 3 — until then route to /v2/home
          navigate('/v2/home');
        }}
        onSecondaryAction={() => navigate('/v2/home')}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-52px)] w-full max-w-[640px] flex-col px-4 pb-32 pt-6">
      {/* Progress bar */}
      <div className="mb-8 space-y-2">
        <div className="flex items-center justify-between font-ar text-[12px] text-v2-ink-muted">
          <span>{t('onboarding.progress.step', { current: state.step, total: 4 })}</span>
          <span>{`${Math.round(progressPct)}%`}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-v2-line">
          <div
            className="h-full rounded-full bg-teal-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Step body */}
      <div className="flex-1">
        {state.step === 1 && (
          <OnboardingStep1Goal value={state.goal} onChange={(goal) => setPatch({ goal })} />
        )}
        {state.step === 2 && (
          <OnboardingStep2Level value={state.level} onChange={(level) => setPatch({ level })} />
        )}
        {state.step === 3 && (
          <OnboardingStep3Identity
            targetRole={state.targetRole}
            industry={state.industry}
            language={state.language}
            onChange={(patch) =>
              setPatch({
                targetRole: patch.targetRole ?? state.targetRole,
                industry: patch.industry ?? state.industry,
                language: patch.language ?? state.language,
              })
            }
          />
        )}
        {state.step === 4 && (
          <OnboardingStep4LinkedIn data={state.linkedin} onChange={setLinkedIn} />
        )}
      </div>

      {submitError && (
        <div className="mt-6 rounded-v2-md border border-rose-200 bg-rose-50 p-3 font-ar text-[13px] text-rose-700">
          {submitError}
        </div>
      )}

      {/* Navigation */}
      <div className="sticky bottom-0 mt-8 flex items-center justify-between gap-3 border-t border-v2-line bg-v2-canvas/90 py-4 backdrop-blur">
        <button
          type="button"
          onClick={handleBack}
          disabled={state.step === 1 || submitting}
          className="rounded-v2-md border border-v2-line bg-white px-4 py-2 font-ar text-[13px] font-semibold text-v2-ink-muted transition-colors hover:text-v2-ink disabled:opacity-40"
        >
          {t('onboarding.nav.back')}
        </button>

        <div className="flex items-center gap-2">
          {state.step === 4 && (
            <button
              type="button"
              onClick={handleSkipLinkedIn}
              disabled={submitting}
              className="rounded-v2-md px-3 py-2 font-ar text-[13px] font-semibold text-v2-ink-muted hover:text-v2-ink disabled:opacity-40"
            >
              {t('onboarding.nav.skip_linkedin')}
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed || submitting}
            className="rounded-v2-md bg-v2-ink px-5 py-2 font-ar text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-v2-ink/90 disabled:opacity-40"
          >
            {submitting
              ? t('onboarding.nav.saving')
              : state.step === 4
              ? t('onboarding.nav.finish')
              : t('onboarding.nav.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
