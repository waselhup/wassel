import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EmptyStateVariant = 'default' | 'search' | 'error' | 'success';

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  /** override the default icon for the variant */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const ICON_BG: Record<EmptyStateVariant, string> = {
  default: 'bg-v2-canvas-2 text-v2-mute',
  search:  'bg-v2-canvas-2 text-v2-mute',
  error:   'bg-v2-rose-50 text-v2-rose',
  success: 'bg-teal-50 text-teal-700',
};

const DEFAULT_ICONS: Record<EmptyStateVariant, ReactNode> = {
  default: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 9.5 H18 M9 13 H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="9.5" cy="9.5" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14 14 L18 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  error: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M11 4 L19 18 H3 L11 4 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M11 9 V13 M11 15.5 V15.51" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  success: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 11 L10 14 L15 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function EmptyState({ variant = 'default', icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center px-5 py-12 text-center', className)}
    >
      <div
        className={cn(
          'mb-3 flex h-12 w-12 items-center justify-center rounded-v2-md',
          ICON_BG[variant],
        )}
      >
        {icon ?? DEFAULT_ICONS[variant]}
      </div>
      <div className="font-ar text-[15px] font-semibold text-v2-ink">{title}</div>
      {description && (
        <div className="mt-1 max-w-[280px] font-ar text-[13px] leading-relaxed text-v2-dim">
          {description}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;
