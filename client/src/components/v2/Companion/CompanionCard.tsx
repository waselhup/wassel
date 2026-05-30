import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import { trpc } from '@/lib/trpc';
import { useCompanionMessage } from './useCompanion';
import CompanionMessageBody from './CompanionMessageBody';

/**
 * CompanionCard — the companion's embedded presence on /v2/home.
 *
 * Same design language as Home's "Your Next Move" card (teal gradient, Card +
 * Eyebrow), but it speaks in the companion's warm voice: a personal greeting
 * line on top, then the contextual message (reused Next Task + step-by-step
 * purchase guidance) underneath via the shared CompanionMessageBody.
 *
 * It's self-contained — fetches its own message + welcome line so Home only
 * has to drop it into the grid.
 */
export default function CompanionCard({ language }: { language: 'ar' | 'en' }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const isAr = language === 'ar';
  const { message, loading } = useCompanionMessage(language);
  const [welcomeLine, setWelcomeLine] = useState<string | null>(null);

  // The cached welcome line doubles as the card's warm header on Home.
  useEffect(() => {
    let cancelled = false;
    trpc.dashboard.companion
      .getWelcome({ language })
      .then((r) => {
        if (!cancelled && r.message) setWelcomeLine(r.message);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [language]);

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

  const handleAct = async () => {
    const task = message?.task;
    if (!task) return;
    try {
      await trpc.dashboard.acknowledgeSuggestion({ suggestionId: task.id });
    } catch {
      /* non-fatal */
    }
    navigateInternal(task.cta_url);
  };

  const handleGuide = () => navigateInternal('/v2/pricing');

  return (
    <Card
      padding="lg"
      radius="lg"
      elevated
      className="bg-gradient-to-br from-teal-50 to-white border-teal-100 transition-shadow duration-300 hover:shadow-card-hover"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-600/10 text-teal-700">
          {/* canonical Wassel radar mark — landing BrandMark proportions (9/5/1.4) */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="8" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="8" cy="8" r="1" fill="currentColor" />
          </svg>
        </span>
        <Eyebrow className="text-teal-700">
          {t('companion.card.title', isAr ? 'مساعدك المهني' : 'Your career companion')}
        </Eyebrow>
      </div>

      {welcomeLine && (
        <p className="mb-3 font-ar text-[14px] font-medium leading-relaxed text-v2-ink">
          {welcomeLine}
        </p>
      )}

      <CompanionMessageBody
        message={message}
        loading={loading}
        isAr={isAr}
        onAct={handleAct}
        onGuide={handleGuide}
        showTask={false}
      />
    </Card>
  );
}
