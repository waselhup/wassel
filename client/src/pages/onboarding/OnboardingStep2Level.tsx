import { useTranslation } from 'react-i18next';

export type Level = 'entry' | 'mid' | 'senior' | 'executive';

const LEVELS: Level[] = ['entry', 'mid', 'senior', 'executive'];

interface Props {
  value: Level | null;
  onChange: (level: Level) => void;
}

export default function OnboardingStep2Level({ value, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="font-ar text-[26px] font-semibold text-v2-ink">{t('onboarding.step2.title')}</h1>
        <p className="font-ar text-[14px] text-v2-ink-muted">{t('onboarding.step2.subtitle')}</p>
      </header>

      <div role="radiogroup" aria-label={t('onboarding.step2.title')} className="grid gap-3">
        {LEVELS.map((lvl) => {
          const selected = value === lvl;
          return (
            <button
              key={lvl}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(lvl)}
              className={[
                'w-full rounded-v2-md border p-4 text-start transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60',
                selected
                  ? 'border-teal-500 bg-teal-50 shadow-sm'
                  : 'border-v2-line bg-white hover:border-v2-line-strong hover:bg-v2-canvas',
              ].join(' ')}
            >
              <div className="font-ar text-[16px] font-semibold text-v2-ink">
                {t(`onboarding.step2.levels.${lvl}.label`)}
              </div>
              <div className="mt-1 font-ar text-[13px] text-v2-ink-muted">
                {t(`onboarding.step2.levels.${lvl}.detail`)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
