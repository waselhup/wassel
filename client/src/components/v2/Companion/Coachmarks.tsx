import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Button from '@/components/v2/Button';
import { cn } from '@/lib/utils';

/**
 * Coachmarks — a one-time, fully-skippable guided tour shown right after the
 * welcome moment. Explains the four pillars in 4 short steps.
 *
 * We deliberately use centered step cards (not element-anchored tooltips):
 * anchored tooltips are brittle across the mobile <Phone> column and the
 * desktop sidebar layout, and would need DOM probing. A clean stepped card
 * reads well in both, is trivially RTL-safe, and the "skip" affordance is
 * always visible — dismiss at any step ends the tour forever (parent persists
 * tour_done_at via onDone).
 */

type Step = {
  key: string;
  icon: React.ReactNode;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
};

const RadarIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
);
const ResumeIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="5" y="3" width="14" height="18" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 8 H16 M8 12 H16 M8 16 H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const ContentIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 6 H20 M4 12 H20 M4 18 H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const WalletIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 10 H21" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" />
  </svg>
);

const STEPS: Step[] = [
  {
    key: 'radar',
    icon: RadarIcon,
    titleAr: 'الرادار',
    titleEn: 'Radar',
    bodyAr: 'يقرأ ملفك ويوريك وين أنت من دورك المستهدف، وش نقاط قوتك ووين الفجوات.',
    bodyEn: 'Reads your profile and shows where you stand against your target role — your strengths and the gaps.',
  },
  {
    key: 'resume',
    icon: ResumeIcon,
    titleAr: 'السيرة',
    titleEn: 'Resume',
    bodyAr: 'يبني لك سيرة مهنية مرتّبة ومقروءة لأنظمة التوظيف، مفصّلة على دورك المستهدف.',
    bodyEn: 'Builds a clean, ATS-friendly resume tailored to your target role.',
  },
  {
    key: 'content',
    icon: ContentIcon,
    titleAr: 'المحتوى',
    titleEn: 'Content',
    bodyAr: 'يساعدك تكتب منشورات مهنية تبني حضورك، بصوتك أنت ومن غير مبالغة.',
    bodyEn: 'Helps you write professional posts that build your presence — in your own voice.',
  },
  {
    key: 'wallet',
    icon: WalletIcon,
    titleAr: 'رصيدك',
    titleEn: 'Your balance',
    bodyAr: 'كل خطوة لها تكلفة بسيطة بالتوكنات. نوريك دايماً كم تحتاج قبل ما تبدأ.',
    bodyEn: 'Each step costs a few tokens. We always show you what you need before you start.',
  },
];

export default function Coachmarks({
  language,
  onDone,
}: {
  language: 'ar' | 'en';
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const isAr = language === 'ar';
  const [i, setI] = useState(0);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const step = STEPS[i]!;
  const isLast = i === STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex items-end justify-center p-5 sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="absolute inset-0 bg-v2-ink/45 backdrop-blur-[3px]" aria-hidden="true" />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={isAr ? 'جولة تعريفية' : 'Guided tour'}
          className={cn(
            'relative w-full max-w-[400px] overflow-hidden rounded-v2-xl',
            'border border-v2-line bg-v2-surface shadow-lift',
          )}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="px-6 pb-5 pt-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-teal-600/10 text-teal-700">
                {step.icon}
              </span>
              <h3 className="font-ar text-[18px] font-bold text-v2-ink">
                {isAr ? step.titleAr : step.titleEn}
              </h3>
            </div>
            <p className="mt-3 font-ar text-[14px] leading-relaxed text-v2-body">
              {isAr ? step.bodyAr : step.bodyEn}
            </p>

            {/* progress dots */}
            <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
              {STEPS.map((s, idx) => (
                <span
                  key={s.key}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    idx === i ? 'w-5 bg-teal-600' : 'w-1.5 bg-v2-line',
                  )}
                />
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onDone}
                className="font-ar text-[13px] font-medium text-v2-mute hover:text-v2-body cursor-pointer transition-colors duration-150"
              >
                {t('companion.tour.skip', isAr ? 'تخطّي' : 'Skip')}
              </button>
              <Button
                variant="primary"
                size="md"
                onClick={() => (isLast ? onDone() : setI((n) => n + 1))}
              >
                {isLast
                  ? t('companion.tour.done', isAr ? 'تمام، فهمت' : 'Got it')
                  : t('companion.tour.next', isAr ? 'التالي' : 'Next')}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
