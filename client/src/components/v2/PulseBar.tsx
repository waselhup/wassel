import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useJobs } from '@/lib/v2/jobs';

export type PulseState = 'idle' | 'spike' | 'working' | 'complete';

export interface PulseBarProps {
  /** override the state derived from useJobs() — useful for tests/storybook */
  state?: PulseState;
  className?: string;
}

/**
 * 2px strip rendered immediately under the Topbar. State is derived from the
 * job pool (HANDOFF §5):
 *   idle      → no active jobs and nothing recently completed (hidden)
 *   working   → at least one job is running
 *   complete  → a job just finished — fades teal-500 for 1s, then returns to idle
 *   spike     → caller-provided one-shot shimmer (reserved for non-job events)
 */
function PulseBar({ state, className }: PulseBarProps) {
  const { active, jobs } = useJobs();
  const [completePulse, setCompletePulse] = useState(false);

  // Trigger a 1s "complete" fade whenever the count of completed/failed jobs grows.
  const settledCount = jobs.filter((j) => j.status === 'completed' || j.status === 'failed').length;
  useEffect(() => {
    if (settledCount === 0) return;
    setCompletePulse(true);
    const t = window.setTimeout(() => setCompletePulse(false), 1000);
    return () => window.clearTimeout(t);
  }, [settledCount]);

  const derived: PulseState =
    active.length > 0 ? 'working' :
    completePulse    ? 'complete' :
                       'idle';

  const effective = state ?? derived;

  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative h-[2px] w-full overflow-hidden',
        effective === 'idle' ? 'bg-transparent' : 'bg-v2-line/40',
        className,
      )}
    >
      <style>{`
        @keyframes v2-pulse-flow {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes v2-pulse-shimmer {
          0%   { opacity: 0; transform: scaleX(0.4); }
          50%  { opacity: 1; transform: scaleX(1); }
          100% { opacity: 0; transform: scaleX(0.4); }
        }
        @keyframes v2-pulse-complete {
          0%   { opacity: 0; }
          15%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {effective === 'working' && (
        <div
          className="absolute inset-y-0 w-1/2 bg-teal-500"
          style={{
            animation: 'v2-pulse-flow 1.6s linear infinite',
            transformOrigin: 'left center',
          }}
        />
      )}

      {effective === 'spike' && (
        <div
          className="absolute inset-0 origin-center bg-teal-500"
          style={{ animation: 'v2-pulse-shimmer 200ms var(--ease-out) 1' }}
        />
      )}

      {effective === 'complete' && (
        <div
          className="absolute inset-0 bg-teal-500"
          style={{ animation: 'v2-pulse-complete 1000ms var(--ease-out) 1 forwards' }}
        />
      )}
    </div>
  );
}

export default PulseBar;
