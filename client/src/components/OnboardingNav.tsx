import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { getPrevStep, getNextStep, ONBOARDING_STEPS, getStepByPath } from '@/lib/onboarding';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

export default function OnboardingNav() {
  const [pathname, navigate] = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const prev = getPrevStep(pathname);
  const next = getNextStep(pathname);
  const current = getStepByPath(pathname);

  return (
    <div className="w-full mt-8">
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-1 mb-5">
        {ONBOARDING_STEPS.map((s, i) => {
          const isActive = current?.step === s.step;
          const isCompleted = current ? s.step < current.step : false;
          return (
            <div key={s.step} className="flex items-center">
              {/* Step dot */}
              <div
                className="flex items-center justify-center transition-all duration-300"
                style={{
                  width: isActive ? 32 : 28,
                  height: isActive ? 32 : 28,
                  borderRadius: '50%',
                  background: isCompleted
                    ? '#059669'
                    : isActive
                    ? 'var(--accent-primary, #8B5CF6)'
                    : '#e2e8f0',
                  color: isCompleted || isActive ? 'white' : '#94a3b8',
                  fontWeight: 700,
                  fontSize: isActive ? 13 : 12,
                  boxShadow: isActive ? '0 2px 8px rgba(26,86,219,0.3)' : 'none',
                }}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : s.step}
              </div>
              {/* Label */}
              <span
                className="text-xs font-medium mx-1.5 hidden sm:inline"
                style={{
                  color: isCompleted
                    ? '#059669'
                    : isActive
                    ? 'var(--accent-primary, #8B5CF6)'
                    : '#94a3b8',
                }}
              >
                {isAr ? s.labelAr : s.label}
              </span>
              {/* Connector line */}
              {i < ONBOARDING_STEPS.length - 1 && (
                <div
                  className="mx-1"
                  style={{
                    width: 32,
                    height: 2,
                    borderRadius: 1,
                    background: isCompleted ? '#059669' : '#e2e8f0',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between px-2">
        <button
          onClick={() => prev && navigate(prev.path)}
          disabled={!prev}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
          style={{
            background: prev ? 'var(--bg-card, white)' : 'transparent',
            border: prev ? '1px solid var(--border-subtle, #e2e8f0)' : '1px solid transparent',
            color: prev ? 'var(--text-secondary, #64748b)' : '#cbd5e1',
            opacity: prev ? 1 : 0.3,
            cursor: prev ? 'pointer' : 'not-allowed',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          {isAr ? 'السابق' : 'Previous'}
        </button>

        <button
          onClick={() => next && navigate(next.path)}
          disabled={!next}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
          style={{
            background: next ? 'var(--accent-primary, #8B5CF6)' : '#e2e8f0',
            color: next ? 'white' : '#94a3b8',
            opacity: next ? 1 : 0.3,
            cursor: next ? 'pointer' : 'not-allowed',
            boxShadow: next ? '0 2px 8px rgba(26,86,219,0.25)' : 'none',
          }}
        >
          {isAr ? 'التالي' : 'Next'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
