import { useTranslation } from 'react-i18next';

export type Goal = 'job_search' | 'promotion' | 'personal_brand' | 'opportunities' | 'career_change';

const GOALS: Goal[] = ['job_search', 'promotion', 'personal_brand', 'opportunities', 'career_change'];

interface Props {
  value: Goal | null;
  onChange: (goal: Goal) => void;
}

export default function OnboardingStep1Goal({ value, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="font-ar text-[26px] font-semibold text-v2-ink">{t('onboarding.step1.title')}</h1>
        <p className="font-ar text-[14px] text-v2-ink-muted">{t('onboarding.step1.subtitle')}</p>
      </header>

      <div role="radiogroup" aria-label={t('onboarding.step1.title')} className="grid gap-3">
        {GOALS.map((g) => {
          const selected = value === g;
          return (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(g)}
              className={[
                'w-full rounded-v2-md border p-4 text-start transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60',
                selected
                  ? 'border-teal-500 bg-teal-50 shadow-sm'
                  : 'border-v2-line bg-white hover:border-v2-line-strong hover:bg-v2-canvas',
              ].join(' ')}
            >
              <div className="font-ar text-[16px] font-semibold text-v2-ink">
                {t(`onboarding.step1.goals.${g}.label`)}
              </div>
              <div className="mt-1 font-ar text-[13px] text-v2-ink-muted">
                {t(`onboarding.step1.goals.${g}.detail`)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
