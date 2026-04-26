import { useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  /** fired after the dismiss timeout, or when the user taps the close affordance */
  onDismiss?: () => void;
  /** the body text (or any node) */
  message: ReactNode;
  /** secondary line shown under the message */
  description?: ReactNode;
  /** tone affects the leading icon and accent border */
  tone?: ToastTone;
  /** ms until auto-dismiss. Default 4000. Pass `0` to disable. */
  duration?: number;
  /** optional action node (e.g. an undo button) rendered on the trailing edge */
  action?: ReactNode;
}

const toneRing: Record<ToastTone, string> = {
  success: 'border-teal-300',
  error:   'border-v2-rose/60',
  info:    'border-v2-indigo/40',
};

const toneIcon: Record<ToastTone, ReactNode> = {
  success: (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-teal-700">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2.5 6 L5 8.5 L9.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  ),
  error: (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-v2-rose-50 text-v2-rose">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  ),
  info: (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-v2-indigo-50 text-v2-indigo">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M6 5.5 V8.5 M6 3.5 H6.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  ),
};

function Toast({
  className,
  open,
  onDismiss,
  message,
  description,
  tone = 'info',
  duration = 4000,
  action,
  ...rest
}: ToastProps) {
  // Track mount so we can run a leave animation before unmounting.
  const [mounted, setMounted] = useState(open);
  useEffect(() => { if (open) setMounted(true); }, [open]);

  // Auto-dismiss timer.
  useEffect(() => {
    if (!open || duration <= 0 || !onDismiss) return;
    const id = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(id);
  }, [open, duration, onDismiss]);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4',
        'transition-all duration-300 ease-ios',
        open ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
        className,
      )}
      style={{ top: `calc(env(safe-area-inset-top) + 12px)` }}
      onTransitionEnd={() => { if (!open) setMounted(false); }}
      {...rest}
    >
      <div className={cn(
        'pointer-events-auto flex w-full max-w-[360px] items-start gap-3',
        'rounded-v2-md border-2 bg-v2-surface px-4 py-3 shadow-lift',
        toneRing[tone],
      )}>
        <span className="mt-0.5 shrink-0">{toneIcon[tone]}</span>
        <div className="min-w-0 flex-1 font-ar">
          <div className="text-[14px] font-semibold leading-snug text-v2-ink">{message}</div>
          {description && (
            <div className="mt-0.5 text-[12px] leading-snug text-v2-body">{description}</div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="إغلاق"
            className={cn(
              'shrink-0 rounded-v2-pill p-1 text-v2-mute hover:bg-v2-canvas-2 hover:text-v2-body',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
            )}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default Toast;
