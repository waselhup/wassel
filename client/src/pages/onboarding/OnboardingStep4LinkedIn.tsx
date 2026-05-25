import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type LinkedInData = {
  linkedinUrl: string | null;
  manualAbout: string | null;
  manualTopSkills: string[] | null;
  manualCurrentRole: string | null;
  manualYearsExperience: number | null;
  manualEducation: string | null;
};

interface Props {
  data: LinkedInData;
  onChange: (patch: Partial<LinkedInData>) => void;
}

// Light LinkedIn URL validation — we accept the common formats but don't
// block edge cases (the server validates strictly via Zod).
function isPlausibleLinkedInUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true; // empty is OK at this step (it's optional)
  return /^https?:\/\/(www\.)?linkedin\.com\/in\/[^\s/]+/i.test(trimmed);
}

export default function OnboardingStep4LinkedIn({ data, onChange }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'linkedin' | 'manual'>('linkedin');

  const [skillDraft, setSkillDraft] = useState('');
  const skills = data.manualTopSkills ?? [];

  const linkedInValid = isPlausibleLinkedInUrl(data.linkedinUrl ?? '');

  function addSkill() {
    const next = skillDraft.trim();
    if (!next) return;
    if (skills.includes(next)) {
      setSkillDraft('');
      return;
    }
    if (skills.length >= 8) return;
    onChange({ manualTopSkills: [...skills, next] });
    setSkillDraft('');
  }

  function removeSkill(s: string) {
    onChange({ manualTopSkills: skills.filter((x) => x !== s) });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="font-ar text-[26px] font-semibold text-v2-ink">{t('onboarding.step4.title')}</h1>
        <p className="font-ar text-[14px] text-v2-ink-muted">{t('onboarding.step4.subtitle')}</p>
      </header>

      {/* Mode toggle */}
      <div role="tablist" className="grid grid-cols-2 gap-2 rounded-v2-md bg-v2-canvas p-1">
        <button
          role="tab"
          type="button"
          aria-selected={mode === 'linkedin'}
          onClick={() => setMode('linkedin')}
          className={[
            'rounded-v2-md px-3 py-2 font-ar text-[13px] font-semibold transition-colors',
            mode === 'linkedin'
              ? 'bg-white text-v2-ink shadow-sm'
              : 'text-v2-ink-muted hover:text-v2-ink',
          ].join(' ')}
        >
          {t('onboarding.step4.modes.linkedin')}
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={mode === 'manual'}
          onClick={() => setMode('manual')}
          className={[
            'rounded-v2-md px-3 py-2 font-ar text-[13px] font-semibold transition-colors',
            mode === 'manual'
              ? 'bg-white text-v2-ink shadow-sm'
              : 'text-v2-ink-muted hover:text-v2-ink',
          ].join(' ')}
        >
          {t('onboarding.step4.modes.manual')}
        </button>
      </div>

      {mode === 'linkedin' ? (
        <div className="space-y-2">
          <label htmlFor="linkedin_url" className="block font-ar text-[14px] font-semibold text-v2-ink">
            {t('onboarding.step4.linkedin.label')}
          </label>
          <input
            id="linkedin_url"
            type="url"
            inputMode="url"
            dir="ltr"
            value={data.linkedinUrl ?? ''}
            onChange={(e) => onChange({ linkedinUrl: e.target.value || null })}
            placeholder="https://www.linkedin.com/in/your-handle"
            className={[
              'w-full rounded-v2-md border bg-white px-4 py-3 font-mono text-[14px] text-v2-ink outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
              linkedInValid ? 'border-v2-line focus-visible:border-teal-500' : 'border-rose-400 focus-visible:border-rose-500',
            ].join(' ')}
          />
          {!linkedInValid && (
            <p className="font-ar text-[12px] text-rose-600">{t('onboarding.step4.linkedin.invalid')}</p>
          )}
          <p className="font-ar text-[12px] text-v2-ink-muted">{t('onboarding.step4.linkedin.hint')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* About */}
          <div className="space-y-2">
            <label htmlFor="manual_about" className="block font-ar text-[14px] font-semibold text-v2-ink">
              {t('onboarding.step4.manual.about.label')}
            </label>
            <textarea
              id="manual_about"
              rows={4}
              maxLength={1000}
              value={data.manualAbout ?? ''}
              onChange={(e) => onChange({ manualAbout: e.target.value || null })}
              placeholder={t('onboarding.step4.manual.about.placeholder')}
              className="w-full resize-y rounded-v2-md border border-v2-line bg-white px-4 py-3 font-ar text-[14px] text-v2-ink outline-none placeholder:text-v2-ink-muted/60 focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500/30"
            />
          </div>

          {/* Top skills */}
          <div className="space-y-2">
            <span className="block font-ar text-[14px] font-semibold text-v2-ink">
              {t('onboarding.step4.manual.skills.label')}
            </span>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-2 rounded-v2-pill border border-teal-400 bg-teal-50 px-3 py-1 font-ar text-[12px] text-teal-800"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSkill(s)}
                    aria-label={t('onboarding.step4.manual.skills.remove', { skill: s })}
                    className="text-teal-700 hover:text-teal-900"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillDraft}
                maxLength={40}
                disabled={skills.length >= 8}
                onChange={(e) => setSkillDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder={t('onboarding.step4.manual.skills.placeholder')}
                className="flex-1 rounded-v2-md border border-v2-line bg-white px-3 py-2 font-ar text-[14px] text-v2-ink outline-none focus-visible:border-teal-500"
              />
              <button
                type="button"
                onClick={addSkill}
                disabled={!skillDraft.trim() || skills.length >= 8}
                className="rounded-v2-md bg-v2-ink px-4 py-2 font-ar text-[13px] font-semibold text-white disabled:opacity-40"
              >
                {t('onboarding.step4.manual.skills.add')}
              </button>
            </div>
            <p className="font-ar text-[11px] text-v2-ink-muted">
              {t('onboarding.step4.manual.skills.counter', { count: skills.length, max: 8 })}
            </p>
          </div>

          {/* Current role */}
          <div className="space-y-2">
            <label htmlFor="manual_current_role" className="block font-ar text-[14px] font-semibold text-v2-ink">
              {t('onboarding.step4.manual.current_role.label')}
            </label>
            <input
              id="manual_current_role"
              type="text"
              maxLength={120}
              value={data.manualCurrentRole ?? ''}
              onChange={(e) => onChange({ manualCurrentRole: e.target.value || null })}
              placeholder={t('onboarding.step4.manual.current_role.placeholder')}
              className="w-full rounded-v2-md border border-v2-line bg-white px-4 py-3 font-ar text-[14px] text-v2-ink outline-none focus-visible:border-teal-500"
            />
          </div>

          {/* Years of experience */}
          <div className="space-y-2">
            <label htmlFor="manual_years_experience" className="block font-ar text-[14px] font-semibold text-v2-ink">
              {t('onboarding.step4.manual.years.label')}
            </label>
            <input
              id="manual_years_experience"
              type="number"
              min={0}
              max={60}
              value={data.manualYearsExperience ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? null : Math.max(0, Math.min(60, Number(e.target.value)));
                onChange({ manualYearsExperience: v });
              }}
              className="w-full rounded-v2-md border border-v2-line bg-white px-4 py-3 font-mono text-[14px] text-v2-ink outline-none focus-visible:border-teal-500"
            />
          </div>

          {/* Education */}
          <div className="space-y-2">
            <label htmlFor="manual_education" className="block font-ar text-[14px] font-semibold text-v2-ink">
              {t('onboarding.step4.manual.education.label')}
            </label>
            <input
              id="manual_education"
              type="text"
              maxLength={200}
              value={data.manualEducation ?? ''}
              onChange={(e) => onChange({ manualEducation: e.target.value || null })}
              placeholder={t('onboarding.step4.manual.education.placeholder')}
              className="w-full rounded-v2-md border border-v2-line bg-white px-4 py-3 font-ar text-[14px] text-v2-ink outline-none focus-visible:border-teal-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
