import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Sheet from '@/components/v2/Sheet';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { useCompanionMessage } from './useCompanion';
import CompanionMessageBody from './CompanionMessageBody';

/**
 * CompanionBubble — the floating companion presence on every protected page
 * EXCEPT /v2/home (where the embedded card stands in).
 *
 * THE GOLDEN RULE: the bubble NEVER opens a message on its own. It sits
 * quietly in the corner; when there's something new it shows a small badge
 * (NotificationBell pattern) and gives a single, soft pulse — nothing more.
 * The user opens it when they choose. Zero interruption, full respect for
 * their time.
 *
 * Tapping opens a Sheet with the companion's message + CTA (reused Next Task
 * + step-by-step purchase guidance). Opening clears the badge for that message
 * (tracked per-task in sessionStorage so navigation doesn't re-nag).
 */

const SEEN_KEY = 'wassel.companion.bubble.seenTaskId';

export default function CompanionBubble({ language }: { language: 'ar' | 'en' }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const isAr = language === 'ar';
  const { message, loading } = useCompanionMessage(language);

  const [open, setOpen] = useState(false);
  const [seenTaskId, setSeenTaskId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SEEN_KEY);
    } catch {
      return null;
    }
  });

  const taskId = message?.task?.id ?? null;
  // "New" = there's an active task the user hasn't already opened this session.
  const hasNew = !!taskId && taskId !== seenTaskId;

  // Pulse exactly once when a new message arrives (not on every render).
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!hasNew) return undefined;
    setPulse(true);
    const id = window.setTimeout(() => setPulse(false), 1600);
    return () => window.clearTimeout(id);
  }, [hasNew]);

  const handleOpen = () => {
    setOpen(true);
    // Opening clears the badge for this task.
    if (taskId) {
      setSeenTaskId(taskId);
      try {
        sessionStorage.setItem(SEEN_KEY, taskId);
      } catch {
        /* ignore */
      }
    }
  };

  const handleAct = async () => {
    const task = message?.task;
    if (!task) return;
    setOpen(false);
    try {
      await trpc.dashboard.acknowledgeSuggestion({ suggestionId: task.id });
    } catch {
      /* non-fatal */
    }
    navigateInternal(task.cta_url);
  };

  const handleGuide = () => {
    setOpen(false);
    navigateInternal('/v2/pricing');
  };

  function navigateInternal(url: string) {
    try {
      const u = new URL(url, window.location.origin);
      if (u.origin === window.location.origin) {
        navigate(u.pathname + u.search + u.hash);
      } else {
        window.location.href = url;
      }
    } catch {
      navigate(url);
    }
  }

  return (
    <>
      {/* Floating bubble — bottom-end corner, lifted above the mobile BottomNav.
          Logical `end-*` keeps it in the correct corner for RTL + LTR. */}
      <motion.button
        type="button"
        onClick={handleOpen}
        aria-label={t('companion.bubble.open', isAr ? 'افتح المساعد' : 'Open your companion')}
        className={cn(
          'fixed z-[55] end-4 bottom-[88px] lg:bottom-6',
          'flex h-14 w-14 items-center justify-center rounded-full cursor-pointer',
          'bg-teal-600 text-white shadow-lift',
          'transition-colors duration-200 hover:bg-teal-500',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40',
        )}
        initial={{ scale: 0, opacity: 0 }}
        animate={
          pulse
            ? { scale: [1, 1.08, 1], opacity: 1 }
            : { scale: 1, opacity: 1 }
        }
        transition={{ duration: pulse ? 1.4 : 0.3, ease: 'easeOut' }}
        whileTap={{ scale: 0.94 }}
      >
        {/* radar mark — consistent with the companion's identity */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </svg>

        {/* "new message" badge — NotificationBell pattern, logical end corner */}
        {hasNew && (
          <span
            className={cn(
              'absolute -top-0.5 end-0 inline-flex h-3.5 w-3.5 items-center justify-center',
              'rounded-full bg-red-500 ring-2 ring-v2-canvas',
            )}
            aria-label={isAr ? 'رسالة جديدة' : 'New message'}
          />
        )}
      </motion.button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('companion.bubble.title', isAr ? 'مساعدك' : 'Your companion')}
        snapPoints={[50, 90]}
      >
        <CompanionMessageBody
          message={message}
          loading={loading}
          isAr={isAr}
          onAct={handleAct}
          onGuide={handleGuide}
        />
      </Sheet>
    </>
  );
}
