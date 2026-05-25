import { useTranslation } from 'react-i18next';
import type { Goal } from './OnboardingStep1Goal';
import type { Level } from './OnboardingStep2Level';

interface Props {
  goal: Goal;
  level: Level;
  targetRole: string;
  industry: string;
  hasLinkedIn: boolean;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
}

export default function OnboardingComplete({
  goal,
  level,
  targetRole,
  industry,
  hasLinkedIn,
  onPrimaryAction,
  onSecondaryAction,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-52px)] w-full max-w-[640px] flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-700">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-8 w-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="font-ar text-[28px] font-semibold text-v2-ink">{t('onboarding.complete.title')}</h1>
      <p className="mt-3 max-w-md font-ar text-[15px] text-v2-ink-muted">
        {t('onboarding.complete.subtitle', {
          targetRole,
          industry,
          goal: t(`onboarding.step1.goals.${goal}.label`),
          level: t(`onboarding.step2.levels.${level}.label`),
        })}
      </p>

      <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={onPrimaryAction}
          className="w-full rounded-v2-md bg-v2-ink px-5 py-3 font-ar text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-v2-ink/90"
        >
          {hasLinkedIn
            ? t('onboarding.complete.cta_primary_with_linkedin')
            : t('onboarding.complete.cta_primary_no_linkedin')}
        </button>
        <button
          type="button"
          onClick={onSecondaryAction}
          className="w-full rounded-v2-md border border-v2-line bg-white px-5 py-3 font-ar text-[14px] font-semibold text-v2-ink-muted transition-colors hover:text-v2-ink"
        >
          {t('onboarding.complete.cta_secondary')}
        </button>
      </div>
    </div>
  );
}
