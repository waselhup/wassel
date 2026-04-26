import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useJobs } from '@/lib/v2/jobs';
import JobsCenter from '@/components/v2/JobsCenter';
import DesktopJobsCenter from '@/components/v2/DesktopJobsCenter';
import { useIsDesktop } from '@/components/v2/ResponsiveShell';

export interface JobsIndicatorProps {
  className?: string;
}

/**
 * Bell-style icon for the Topbar end slot. Shows a teal badge with the count
 * of active jobs; tap opens the JobsCenter — bottom-sheet on mobile, side
 * drawer on desktop.
 */
function JobsIndicator({ className }: JobsIndicatorProps) {
  const { active } = useJobs();
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const count = active.length;
  const hasActive = count > 0;

  const Center = isDesktop ? DesktopJobsCenter : JobsCenter;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`مركز المهام${count > 0 ? ` · ${count} نشطة` : ''}`}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-v2-pill cursor-pointer',
          'text-v2-ink hover:bg-v2-canvas-2 transition-colors duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
          className,
        )}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M3 7 a6 6 0 0112 0 v4 l1.5 2 H1.5 L3 11 Z"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
          />
          <path
            d="M7 15 a2 2 0 004 0"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
          />
        </svg>
        {hasActive && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -end-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-teal-500 px-1 font-en text-[10px] font-bold tabular-nums text-white shadow-card"
          >
            {count}
          </span>
        )}
      </button>
      <Center open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default JobsIndicator;
