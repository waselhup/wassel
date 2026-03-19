// Onboarding step definitions and navigation helpers
// Flow: LinkedIn Connect → Extension Install → Dashboard

export const ONBOARDING_STEPS = [
  { step: 1, label: 'LinkedIn', labelAr: 'ربط LinkedIn', path: '/onboarding/linkedin' },
  { step: 2, label: 'Extension', labelAr: 'تثبيت الإضافة', path: '/onboarding/extension' },
  { step: 3, label: 'Dashboard', labelAr: 'لوحة التحكم', path: '/app' },
] as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[number];

export function getStepByPath(pathname: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find(s => s.path === pathname);
}

export function getPrevStep(pathname: string): OnboardingStep | undefined {
  const idx = ONBOARDING_STEPS.findIndex(s => s.path === pathname);
  return idx > 0 ? ONBOARDING_STEPS[idx - 1] : undefined;
}

export function getNextStep(pathname: string): OnboardingStep | undefined {
  const idx = ONBOARDING_STEPS.findIndex(s => s.path === pathname);
  return idx >= 0 && idx < ONBOARDING_STEPS.length - 1 ? ONBOARDING_STEPS[idx + 1] : undefined;
}
