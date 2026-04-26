import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TopbarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** main heading rendered in the center column */
  title?: ReactNode;
  /** small uppercase line above the title (e.g. "STEP 01 / 03") */
  eyebrow?: ReactNode;
  /** show a back chevron in the start slot, optionally with a click handler */
  back?: boolean;
  /** callback fired when the back chevron is pressed */
  onBack?: () => void;
  /** custom content for the start slot (overrides the back chevron) */
  leading?: ReactNode;
  /** content rendered in the end slot (icon button, action, etc.) */
  trailing?: ReactNode;
  /** stick to the top while the screen scrolls. Defaults to true. */
  sticky?: boolean;
  /** background color override (defaults to canvas) */
  bg?: 'canvas' | 'surface' | 'transparent';
}

const bgClasses = {
  canvas:     'bg-v2-canvas',
  surface:    'bg-v2-surface',
  transparent: 'bg-transparent',
} as const;

function Topbar({
  className,
  title,
  eyebrow,
  back = false,
  onBack,
  leading,
  trailing,
  sticky = true,
  bg = 'canvas',
  ...rest
}: TopbarProps) {
  return (
    <div
      className={cn(
        'z-10 border-b border-v2-line',
        bgClasses[bg],
        sticky ? 'sticky top-0' : 'relative',
        className,
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      {...rest}
    >
      <div className="flex h-[52px] items-center justify-between px-[18px]">
        <div className="flex min-w-[64px] items-center gap-1.5">
          {leading ?? (back && (
            <button
              type="button"
              onClick={onBack}
              aria-label="رجوع"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-v2-pill',
                'cursor-pointer text-v2-ink hover:bg-v2-canvas-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
              )}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
                className="rtl:rotate-180">
                <path d="M9 2 L4 7 L9 12" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col items-center text-center">
          {eyebrow && (
            <div className="font-en text-[10.5px] font-medium uppercase tracking-[0.1em] text-v2-dim">
              {eyebrow}
            </div>
          )}
          {title && (
            <div className="font-ar text-[17px] font-semibold leading-tight text-v2-ink">
              {title}
            </div>
          )}
        </div>
        <div className="flex min-w-[64px] items-center justify-end gap-1.5">{trailing}</div>
      </div>
    </div>
  );
}

export default Topbar;
