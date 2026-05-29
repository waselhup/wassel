import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import Button from '@/components/v2/Button';
import NumDisplay from '@/components/v2/NumDisplay';
import type { CompanionMessageShape, PurchaseGuidanceShape } from '@/lib/trpc';

/**
 * CompanionMessageBody — the shared rendering of the companion's contextual
 * message. Used by both the floating bubble's Sheet and the Home card. Shows:
 *   - the reused Next Task (headline + rationale + primary CTA), and
 *   - step-by-step purchase guidance when the wallet can't cover the action.
 *
 * The guidance is calm and explanatory — "to do X you need Y, you have Z" —
 * never a hard sell, never a countdown. It deeplinks to /v2/pricing.
 *
 * Pure presentational: the parent supplies the message + the two action
 * callbacks (act → navigate to the task CTA; guide → navigate to pricing).
 */

function pillarLabel(p: 'radar' | 'resume' | 'content', isAr: boolean): string {
  if (p === 'radar') return isAr ? 'تحليل الرادار' : 'the Radar';
  if (p === 'resume') return isAr ? 'سيرة ذاتية' : 'a resume';
  return isAr ? 'منشوراً' : 'a post';
}

/**
 * The calm purchase-guidance block: explains the shortfall, then offers to show
 * the plans. Shared between the full message and the Home (task-hidden) variant.
 */
function GuidanceBlock({
  guidance,
  isAr,
  onGuide,
  t,
}: {
  guidance: PurchaseGuidanceShape;
  isAr: boolean;
  onGuide: () => void;
  t: TFunction;
}) {
  return (
    <div className="rounded-v2-md border border-amber-200 bg-amber-50/60 p-3">
      <p className="font-ar text-[13px] leading-relaxed text-v2-ink">
        {isAr ? (
          <>
            لإنجاز {pillarLabel(guidance.pillar, true)} تحتاج{' '}
            <NumDisplay>{guidance.needed}</NumDisplay> توكن، ورصيدك الحالي{' '}
            <NumDisplay>{guidance.balance}</NumDisplay>.
          </>
        ) : (
          <>
            To create {pillarLabel(guidance.pillar, false)} you need{' '}
            <NumDisplay>{guidance.needed}</NumDisplay> tokens, and your balance is{' '}
            <NumDisplay>{guidance.balance}</NumDisplay>.
          </>
        )}
      </p>
      <Button variant="primary" size="sm" onClick={onGuide} className="mt-3">
        {t('companion.message.showPlans', isAr ? 'أعرض لك الباقات' : 'Show me the plans')}
      </Button>
    </div>
  );
}

export default function CompanionMessageBody({
  message,
  loading,
  isAr,
  onAct,
  onGuide,
  showTask = true,
}: {
  message: CompanionMessageShape | null;
  loading: boolean;
  isAr: boolean;
  onAct: () => void;
  onGuide: () => void;
  /**
   * When false, the task headline/rationale + primary "act" CTA are hidden and
   * only the purchase guidance (when present) is rendered. Used on /v2/home
   * where the page's own "Your Next Move" card already owns the task display —
   * this keeps the companion card from duplicating it.
   */
  showTask?: boolean;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-4 w-2/3 animate-pulse rounded bg-v2-line/60" />
        <div className="h-3 w-full animate-pulse rounded bg-v2-line/50" />
        <div className="h-9 w-32 animate-pulse rounded bg-v2-line/50" />
      </div>
    );
  }

  const task = message?.task ?? null;
  const guidance = message?.guidance ?? null;

  if (!task) {
    return (
      <p className="font-ar text-[14px] leading-relaxed text-v2-body">
        {t(
          'companion.message.empty',
          isAr
            ? 'كل شيء على ما يُرام حالياً. واصِل على راحتك ونحن معك.'
            : "You're all set for now. Carry on — we're with you.",
        )}
      </p>
    );
  }

  // Home variant: the page already shows the task. Surface only the guidance
  // (if any); when the wallet is fine there's nothing extra, so render a short
  // reassuring line instead of repeating the task.
  if (!showTask) {
    if (!guidance) {
      return (
        <p className="font-ar text-[13px] leading-relaxed text-v2-body">
          {t(
            'companion.card.onTrack',
            isAr ? 'أنت على المسار الصحيح. واصِل وأنا معك.' : "You're on track. Keep going — I'm with you.",
          )}
        </p>
      );
    }
    return <GuidanceBlock guidance={guidance} isAr={isAr} onGuide={onGuide} t={t} />;
  }

  // Full variant (bubble Sheet): task + either guidance or the primary CTA.
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-ar text-[17px] font-bold leading-snug text-v2-ink">
          {task.headline}
        </h3>
        <p className="mt-1.5 font-ar text-[13px] leading-relaxed text-v2-body">
          {task.rationale}
        </p>
      </div>

      {guidance ? (
        <GuidanceBlock guidance={guidance} isAr={isAr} onGuide={onGuide} t={t} />
      ) : (
        <Button variant="primary" size="md" onClick={onAct}>
          {task.cta_label || t('companion.message.act', isAr ? 'ابدأ الآن' : 'Start now')}
        </Button>
      )}
    </div>
  );
}
