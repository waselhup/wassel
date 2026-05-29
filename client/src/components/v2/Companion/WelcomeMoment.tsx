import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import Button from '@/components/v2/Button';
import SpinningLogo from '@/components/v2/SpinningLogo';
import { cn } from '@/lib/utils';

/**
 * WelcomeMoment — the one-time greeting the moment a user lands on their
 * dashboard after onboarding.
 *
 * Design contract (from the sprint):
 *   - Shows a template INSTANTLY (name + target role) — never waits on the
 *     network. The one smart line is a background bonus injected if/when it
 *     resolves.
 *   - Warm, light Gulf register. References the user's goal so it feels
 *     personal. No "AI", no vendor, no regenerate.
 *   - Appears exactly once; the parent persists `welcomed_at` via onClose.
 */
export default function WelcomeMoment({
  language,
  onClose,
}: {
  language: 'ar' | 'en';
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const isAr = language === 'ar';

  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [smartLine, setSmartLine] = useState<string | null>(null);

  // First name from the auth profile (same helper Home uses, inlined).
  const fullName = (profile?.full_name ?? '').trim();
  const emailLocal = (user?.email ?? '').split('@')[0] ?? '';
  const firstName =
    (fullName ? fullName.split(/\s+/)[0] : emailLocal) ||
    (isAr ? 'صديقي' : 'there');

  // Pull target role for the template line (best-effort).
  useEffect(() => {
    let cancelled = false;
    trpc.careerProfile
      .get()
      .then((r) => {
        if (!cancelled) {
          const role = (r?.profile as { target_role?: string } | null)?.target_role;
          if (role) setTargetRole(role);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The one smart line — background bonus, never blocks the moment.
  useEffect(() => {
    let cancelled = false;
    trpc.dashboard.companion
      .getWelcome({ language })
      .then((r) => {
        if (!cancelled && r.message) setSmartLine(r.message);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [language]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Template greeting (instant). The smart line, when present, replaces the
  // generic sub-line so the moment feels tailored.
  const greeting = isAr ? `أهلاً ${firstName} 👋` : `Hi ${firstName} 👋`;
  const templateSub = targetRole
    ? isAr
      ? `جهّزنا لك أول خطوة في طريقك إلى ${targetRole}.`
      : `We've lined up your first step toward ${targetRole}.`
    : isAr
      ? 'جهّزنا لك أول خطوة في طريقك.'
      : "We've lined up your first step.";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex items-center justify-center p-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className="absolute inset-0 bg-v2-ink/45 backdrop-blur-[3px]"
          onClick={onClose}
          aria-hidden="true"
        />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={isAr ? 'ترحيب' : 'Welcome'}
          className={cn(
            'relative w-full max-w-[400px] overflow-hidden rounded-v2-xl',
            'border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-white',
            'shadow-lift',
          )}
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Wassel brand spinner — same mark as the landing hero, so the
              moment reads as genuinely part of the product. */}
          <div className="flex justify-center pt-7">
            <SpinningLogo size="md" speed="slow" />
          </div>

          <div className="px-6 pb-6 pt-4 text-center">
            <h2 className="font-ar text-[22px] font-bold leading-tight text-v2-ink">
              {greeting}
            </h2>
            <p className="mx-auto mt-3 max-w-[300px] font-ar text-[14px] leading-relaxed text-v2-body">
              {smartLine || templateSub}
            </p>

            <div className="mt-6 flex flex-col items-center gap-2">
              <Button variant="primary" size="md" onClick={onClose} className="w-full">
                {t('companion.welcome.cta', isAr ? 'لنبدأ' : "Let's begin")}
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="font-ar text-[12px] font-medium text-v2-mute hover:text-v2-body cursor-pointer transition-colors duration-150"
              >
                {t('companion.welcome.skip', isAr ? 'تخطّي' : 'Skip')}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
