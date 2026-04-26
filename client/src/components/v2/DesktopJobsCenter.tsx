import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import JobsCenterContent from '@/components/v2/JobsCenterContent';

export interface DesktopJobsCenterProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Desktop variant of JobsCenter — a 400px drawer that slides in from the
 * inline-end (left in RTL, right in LTR) so it visually originates from the
 * Topbar's JobsIndicator. Backdrop blurs the page behind it.
 */
function DesktopJobsCenter({ open, onClose }: DesktopJobsCenterProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Move focus into the drawer when it opens.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const node = drawerRef.current;
      if (!node) return;
      const focusable = node.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (focusable ?? node).focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" aria-hidden={!open}>
      <style>{`
        @keyframes v2-drawer-in-end {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }
        @keyframes v2-drawer-in-start {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(0); }
        }
        :root[dir="rtl"] [data-v2-drawer-end="true"] {
          animation-name: v2-drawer-in-start;
        }
        @keyframes v2-backdrop-in {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>

      <div
        onClick={onClose}
        className="absolute inset-0 bg-v2-ink/40 backdrop-blur-[2px]"
        style={{ animation: 'v2-backdrop-in 200ms var(--ease-out) both' }}
        aria-hidden="true"
      />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="مركز المهام"
        tabIndex={-1}
        data-v2-drawer-end="true"
        className={cn(
          'absolute inset-y-0 end-0 flex w-[400px] max-w-[100vw] flex-col',
          'border-s border-v2-line bg-v2-surface shadow-lift',
          'focus-visible:outline-none',
        )}
        style={{ animation: 'v2-drawer-in-end 280ms var(--ease-ios) both' }}
      >
        <div className="flex items-center justify-between border-b border-v2-line px-5 py-4">
          <h2 className="font-ar text-[17px] font-semibold text-v2-ink">مركز المهام</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-v2-pill cursor-pointer',
              'text-v2-mute hover:bg-v2-canvas-2 hover:text-v2-ink',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
            )}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <JobsCenterContent onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

export default DesktopJobsCenter;
