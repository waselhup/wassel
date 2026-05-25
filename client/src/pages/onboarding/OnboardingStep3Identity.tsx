import { useTranslation } from 'react-i18next';

export type Language = 'ar' | 'en';

const INDUSTRY_SUGGESTIONS = [
  'fintech',
  'healthtech',
  'edtech',
  'government',
  'retail',
  'real_estate',
  'energy',
];

interface Props {
  targetRole: string;
  industry: string;
  language: Language;
  onChange: (patch: Partial<{ targetRole: string; industry: string; language: Language }>) => void;
}

export default function OnboardingStep3Identity({ targetRole, industry, language, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="font-ar text-[26px] font-semibold text-v2-ink">{t('onboarding.step3.title')}</h1>
        <p className="font-ar text-[14px] text-v2-ink-muted">{t('onboarding.step3.subtitle')}</p>
      </header>

      {/* Target role */}
      <div className="space-y-2">
        <label htmlFor="target_role" className="block font-ar text-[14px] font-semibold text-v2-ink">
          {t('onboarding.step3.fields.target_role.label')}
        </label>
        <input
          id="target_role"
          type="text"
          value={targetRole}
          maxLength={80}
          placeholder={t('onboarding.step3.fields.target_role.placeholder')}
          onChange={(e) => onChange({ targetRole: e.target.value })}
          className="w-full rounded-v2-md border border-v2-line bg-white px-4 py-3 font-ar text-[15px] text-v2-ink outline-none placeholder:text-v2-ink-muted/60 focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500/30"
        />
        <p className="font-ar text-[12px] text-v2-ink-muted">
          {t('onboarding.step3.fields.target_role.hint')}
        </p>
      </div>

      {/* Industry */}
      <div className="space-y-2">
        <label htmlFor="industry" className="block font-ar text-[14px] font-semibold text-v2-ink">
          {t('onboarding.step3.fields.industry.label')}
        </label>
        <input
          id="industry"
          type="text"
          value={industry}
          maxLength={60}
          placeholder={t('onboarding.step3.fields.industry.placeholder')}
          onChange={(e) => onChange({ industry: e.target.value })}
          className="w-full rounded-v2-md border border-v2-line bg-white px-4 py-3 font-ar text-[15px] text-v2-ink outline-none placeholder:text-v2-ink-muted/60 focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500/30"
        />
        <div className="flex flex-wrap gap-2 pt-1">
          {INDUSTRY_SUGGESTIONS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ industry: t(`onboarding.step3.fields.industry.suggestions.${key}`) })}
              className="rounded-v2-pill border border-v2-line bg-white px-3 py-1 font-ar text-[12px] text-v2-ink-muted transition-colors hover:border-teal-400 hover:text-teal-700"
            >
              {t(`onboarding.step3.fields.industry.suggestions.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Primary language */}
      <div className="space-y-2">
        <span className="block font-ar text-[14px] font-semibold text-v2-ink">
          {t('onboarding.step3.fields.language.label')}
        </span>
        <div role="radiogroup" className="grid grid-cols-2 gap-3">
          {(['ar', 'en'] as Language[]).map((code) => {
            const selected = language === code;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ language: code })}
                className={[
                  'rounded-v2-md border px-4 py-3 text-center transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60',
                  selected
                    ? 'border-teal-500 bg-teal-50 text-v2-ink shadow-sm'
                    : 'border-v2-line bg-white text-v2-ink-muted hover:border-v2-line-strong hover:text-v2-ink',
                ].join(' ')}
              >
                <span className="font-ar text-[15px] font-semibold">
                  {t(`onboarding.step3.fields.language.options.${code}`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
