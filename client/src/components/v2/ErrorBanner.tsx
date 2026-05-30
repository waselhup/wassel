import type React from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import Button from '@/components/v2/Button';

/**
 * ErrorBanner — Sprint 8.
 *
 * Reusable error UI that answers Wassel's R06 "3 questions":
 *   1. What happened?           (the title + body from the messageKey)
 *   2. Did I lose anything?     (refundedTokens > 0 → "tokens refunded")
 *   3. What do I do now?        (a single primary CTA driven by `recovery`)
 *
 * Designed to consume the new tRPC error shape:
 *   error.data?.messageKey | params | refundedTokens | recovery | category
 *
 * For UI flows that just want to render a known error code directly (e.g. a
 * page that knows "this is a NOT_FOUND") pass `messageKey` + `category`.
 */

export type ErrorCategory =
  | 'auth' | 'tokens' | 'ai_service' | 'database' | 'network'
  | 'validation' | 'payment' | 'linkedin' | 'unknown';

export type RecoveryAction =
  | 'auto_refund'
  | 'silent_retry'
  | 'user_action_required'
  | 'escalated';

export interface ErrorBannerProps {
  /** Translation key under errors.* (e.g. "errors.ai.timeout") */
  messageKey: string;
  /** Translation params merged into the t() call */
  params?: Record<string, unknown>;
  /**
   * Raw, already-localized message to show as the body instead of the
   * messageKey lookup. Used at call sites that only hold a caught server/error
   * string (no structured code yet) but still want the shared banner chrome +
   * the R06 "3 questions" + retry CTA. The title still comes from messageKey /
   * category so the banner reads consistently.
   */
  rawMessage?: string | null;
  /** Backend category — drives the icon/color */
  category?: ErrorCategory;
  /** Refunded token count — shown as the "did I lose anything?" line */
  refundedTokens?: number;
  /** Recovery hint — drives the CTA button choice */
  recovery?: RecoveryAction;
  /** Click handler for the primary "Retry" CTA. If absent, the CTA is hidden for silent_retry. */
  onRetry?: () => void;
  /** Compact 1-line variant — used inside forms / lists */
  compact?: boolean;
  /** Optional className passthrough */
  className?: string;
}

const CATEGORY_STYLES: Record<ErrorCategory, { bg: string; border: string; iconBg: string; iconColor: string; icon: React.ReactNode }> = {
  auth:        styleFor('amber',  WarnIcon),
  tokens:      styleFor('amber',  CoinIcon),
  ai_service:  styleFor('blue',   AiIcon),
  database:    styleFor('slate',  ServerIcon),
  network:     styleFor('blue',   NetIcon),
  validation:  styleFor('amber',  WarnIcon),
  payment:     styleFor('red',    CardIcon),
  linkedin:    styleFor('blue',   LinkIcon),
  unknown:     styleFor('slate',  WarnIcon),
};

function ErrorBanner({
  messageKey,
  params,
  rawMessage,
  category = 'unknown',
  refundedTokens,
  recovery,
  onRetry,
  compact = false,
  className,
}: ErrorBannerProps) {
  const { t, i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const [, navigate] = useLocation();
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.unknown;

  const title = t(`${messageKey}.title`, {
    ...params,
    defaultValue: t('errors.generic.unknown.title', { defaultValue: isAr ? 'حدث خطأ' : 'Something went wrong' }),
  });
  const body  = (rawMessage && rawMessage.trim())
    ? rawMessage.trim()
    : t(`${messageKey}.body`,  {
        ...params,
        defaultValue: t('errors.generic.unknown.body', { defaultValue: isAr ? 'تواصل مع الدعم لو تكرر.' : 'Contact support if it keeps happening.' }),
      });
  const ctaLabel = t(`${messageKey}.cta`, {
    ...params,
    defaultValue: t('errors.generic.unknown.cta', { defaultValue: isAr ? 'إعادة المحاولة' : 'Try again' }),
  });

  // R06 Q2: "Did I lose anything?"
  const lossLine = (refundedTokens && refundedTokens > 0)
    ? (isAr
        ? `تم استرداد ${refundedTokens} توكن إلى رصيدك.`
        : `${refundedTokens} tokens refunded to your wallet.`)
    : recovery === 'user_action_required' && category === 'tokens'
      ? null
      : (isAr ? 'لم تخسر شيئاً.' : 'You didn\'t lose anything.');

  // R06 Q3: "What do I do now?"
  let primaryCta: React.ReactNode | null = null;
  switch (recovery) {
    case 'auto_refund':
    case 'silent_retry':
      if (onRetry) {
        primaryCta = (
          <Button variant="primary" size={compact ? 'sm' : 'md'} onClick={onRetry}>
            {ctaLabel}
          </Button>
        );
      }
      break;
    case 'user_action_required':
      if (category === 'tokens') {
        primaryCta = (
          <Button variant="primary" size={compact ? 'sm' : 'md'} onClick={() => navigate('/v2/pricing')}>
            {isAr ? 'إضافة توكنات' : 'Add tokens'}
          </Button>
        );
      } else if (category === 'auth') {
        primaryCta = (
          <Button variant="primary" size={compact ? 'sm' : 'md'} onClick={() => navigate('/v2/login')}>
            {isAr ? 'تسجيل دخول' : 'Sign in'}
          </Button>
        );
      } else if (onRetry) {
        primaryCta = (
          <Button variant="primary" size={compact ? 'sm' : 'md'} onClick={onRetry}>
            {ctaLabel}
          </Button>
        );
      }
      break;
    case 'escalated':
      primaryCta = (
        <a
          href="mailto:support@wasselhub.com"
          className="inline-flex h-9 items-center justify-center rounded-v2-sm bg-teal-600 px-4 font-ar text-[13px] font-semibold text-white hover:bg-teal-700"
        >
          {isAr ? 'تواصل مع الدعم' : 'Contact support'}
        </a>
      );
      break;
    default:
      if (onRetry) {
        primaryCta = (
          <Button variant="primary" size={compact ? 'sm' : 'md'} onClick={onRetry}>
            {ctaLabel}
          </Button>
        );
      }
  }

  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-center gap-3 rounded-v2-sm border px-3 py-2',
          style.bg, style.border, className,
        )}
      >
        <div className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full', style.iconBg, style.iconColor)}>
          {style.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-ar text-[13px] font-semibold text-v2-ink truncate">{title}</div>
          <div className="font-ar text-[12px] text-v2-body line-clamp-1">{body}</div>
        </div>
        {primaryCta}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'rounded-v2-md border p-5',
        style.bg, style.border, className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full', style.iconBg, style.iconColor)}>
          {style.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-ar text-[16px] font-bold text-v2-ink">{title}</h3>
          <p className="mt-1.5 font-ar text-[13px] leading-relaxed text-v2-body">{body}</p>
          {lossLine && (
            <p className="mt-2 font-ar text-[12px] font-medium text-v2-mute">
              {lossLine}
            </p>
          )}
          {primaryCta && (
            <div className="mt-4 flex items-center gap-2">{primaryCta}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── icon helpers ───────────────────────────────────────────────────

function styleFor(tone: 'amber' | 'blue' | 'red' | 'slate', Icon: () => React.ReactNode) {
  const map = {
    amber: { bg: 'bg-amber-50',  border: 'border-amber-200',  iconBg: 'bg-amber-100',  iconColor: 'text-amber-700' },
    blue:  { bg: 'bg-blue-50',   border: 'border-blue-200',   iconBg: 'bg-blue-100',   iconColor: 'text-blue-700'  },
    red:   { bg: 'bg-red-50',    border: 'border-red-200',    iconBg: 'bg-red-100',    iconColor: 'text-red-700'   },
    slate: { bg: 'bg-slate-50',  border: 'border-slate-200',  iconBg: 'bg-slate-100',  iconColor: 'text-slate-700' },
  } as const;
  return { ...map[tone], icon: <Icon /> };
}

function WarnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2 L14 13 L2 13 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 7 V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.8" fill="currentColor" />
    </svg>
  );
}
function CoinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 8 H10 M8 6 V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function AiIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2 L9 6 L13 7 L9 8 L8 12 L7 8 L3 7 L7 6 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
function ServerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="3" width="11" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2.5" y="9" width="11" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5" cy="5" r="0.6" fill="currentColor" />
      <circle cx="5" cy="11" r="0.6" fill="currentColor" />
    </svg>
  );
}
function NetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 6 a8 8 0 0 1 12 0 M4 9 a5 5 0 0 1 8 0 M6 12 a2 2 0 0 1 4 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 7 H14" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 8 a3 3 0 0 1 0-3 L8 3 a3 3 0 0 1 4.2 4.2 L10.5 8.9 M10 8 a3 3 0 0 1 0 3 L8 13 a3 3 0 0 1-4.2-4.2 L5.5 7.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export default ErrorBanner;
