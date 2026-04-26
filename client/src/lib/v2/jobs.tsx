/**
 * Jobs infrastructure for the v2 redesign.
 *
 * The real implementation will subscribe to a tRPC stream (HANDOFF §5).
 * For now this is an in-memory mock that drives the UI: PulseBar reacts
 * to active count, JobsCenter lists everything, RadarLoading reads
 * progress from a specific job.
 *
 * State lives in React Context — never localStorage (CLAUDE.md rule).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type JobType = 'analysis' | 'post-generation' | 'cv-build' | 'export';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  /** 0..1 progress, only meaningful while status === 'running' */
  progress: number;
  /** human-readable, AR */
  title: string;
  createdAt: number;
  completedAt?: number;
  error?: string;
  /** in-app deep link to view the result, e.g. /v2/analyze/result/<id> */
  resultUrl?: string;
}

/** Caller-supplied data when adding a job. */
export interface AddJobInput {
  type: JobType;
  title: string;
  /** total simulation duration in ms. Defaults vary by type. */
  durationMs?: number;
  /** in-app deep link to set on completion */
  resultUrl?: string;
  /** force this job to fail at ~80% progress (for testing) */
  forceFail?: boolean;
}

interface JobsContextValue {
  jobs: Job[];
  active: Job[];
  completed: Job[];
  failed: Job[];
  addJob: (input: AddJobInput) => Job;
  removeJob: (id: string) => void;
  retryJob: (id: string) => void;
  cancelJob: (id: string) => void;
  /** subscribe to a single job — useful for RadarLoading */
  getJob: (id: string) => Job | undefined;
}

const JobsContext = createContext<JobsContextValue | null>(null);

const DEFAULT_DURATION: Record<JobType, number> = {
  'analysis':        7500,
  'post-generation': 5000,
  'cv-build':        9000,
  'export':          3000,
};

const PROGRESS_TICK_MS = 500;
const FAIL_RATE = 0.1; // 1 in 10 jobs fails (mock)

function newId(): string {
  // Random + time keeps IDs unique across the session without a deps cost.
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface JobsProviderProps {
  children: ReactNode;
  /** when set, fires once whenever a job moves to completed/failed */
  onJobSettled?: (job: Job) => void;
}

export function JobsProvider({ children, onJobSettled }: JobsProviderProps) {
  const [jobs, setJobs] = useState<Job[]>([]);

  // Per-job interval handles + simulation params, kept out of state to avoid re-render loops.
  const timersRef = useRef<Map<string, { interval: number; durationMs: number; willFail: boolean; startedAt: number }>>(new Map());

  // Latest onJobSettled — captured in a ref so the simulator doesn't restart when the callback identity changes.
  const settledRef = useRef(onJobSettled);
  useEffect(() => { settledRef.current = onJobSettled; }, [onJobSettled]);

  const stopTimer = useCallback((id: string) => {
    const meta = timersRef.current.get(id);
    if (meta) {
      window.clearInterval(meta.interval);
      timersRef.current.delete(id);
    }
  }, []);

  const startSimulator = useCallback((id: string, durationMs: number, willFail: boolean) => {
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const ratio = Math.min(elapsed / durationMs, 1);
      const failPoint = willFail ? 0.8 : null;

      setJobs((prev) =>
        prev.map((j) => {
          if (j.id !== id) return j;
          if (j.status !== 'running') return j;

          // Force failure ~80% in.
          if (failPoint != null && ratio >= failPoint) {
            stopTimer(id);
            const failedJob: Job = {
              ...j,
              status: 'failed',
              progress: failPoint,
              completedAt: Date.now(),
              error: 'فشل التحليل — أعد المحاولة',
            };
            queueMicrotask(() => settledRef.current?.(failedJob));
            return failedJob;
          }

          if (ratio >= 1) {
            stopTimer(id);
            const completedJob: Job = {
              ...j,
              status: 'completed',
              progress: 1,
              completedAt: Date.now(),
            };
            queueMicrotask(() => settledRef.current?.(completedJob));
            return completedJob;
          }

          return { ...j, progress: ratio };
        }),
      );
    }, PROGRESS_TICK_MS);

    timersRef.current.set(id, { interval, durationMs, willFail, startedAt: performance.now() });
  }, [stopTimer]);

  const addJob = useCallback((input: AddJobInput): Job => {
    const id = newId();
    const durationMs = input.durationMs ?? DEFAULT_DURATION[input.type];
    const willFail = input.forceFail ?? Math.random() < FAIL_RATE;
    const job: Job = {
      id,
      type: input.type,
      status: 'running',
      progress: 0,
      title: input.title,
      createdAt: Date.now(),
      ...(input.resultUrl ? { resultUrl: input.resultUrl } : {}),
    };
    setJobs((prev) => [job, ...prev]);
    startSimulator(id, durationMs, willFail);
    return job;
  }, [startSimulator]);

  const removeJob = useCallback((id: string) => {
    stopTimer(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, [stopTimer]);

  const cancelJob = useCallback((id: string) => {
    stopTimer(id);
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id && j.status === 'running'
          ? { ...j, status: 'failed', completedAt: Date.now(), error: 'أُلغيت' }
          : j,
      ),
    );
  }, [stopTimer]);

  const retryJob = useCallback((id: string) => {
    setJobs((prev) => {
      const target = prev.find((j) => j.id === id);
      if (!target) return prev;
      const next: Job = {
        ...target,
        status: 'running',
        progress: 0,
        ...(target.completedAt !== undefined ? { completedAt: undefined } : {}),
        ...(target.error !== undefined ? { error: undefined } : {}),
      };
      const updated = prev.map((j) => (j.id === id ? next : j));
      // Restart the simulator after the state update lands.
      const durationMs = DEFAULT_DURATION[target.type];
      queueMicrotask(() => startSimulator(id, durationMs, false));
      return updated;
    });
  }, [startSimulator]);

  const getJob = useCallback((id: string): Job | undefined => {
    return jobs.find((j) => j.id === id);
  }, [jobs]);

  // Cleanup all timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((meta) => window.clearInterval(meta.interval));
      timers.clear();
    };
  }, []);

  const value = useMemo<JobsContextValue>(() => {
    const active    = jobs.filter((j) => j.status === 'running' || j.status === 'queued');
    const completed = jobs.filter((j) => j.status === 'completed');
    const failed    = jobs.filter((j) => j.status === 'failed');
    return { jobs, active, completed, failed, addJob, removeJob, retryJob, cancelJob, getJob };
  }, [jobs, addJob, removeJob, retryJob, cancelJob, getJob]);

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs(): JobsContextValue {
  const ctx = useContext(JobsContext);
  if (!ctx) {
    throw new Error('useJobs must be used inside <JobsProvider>');
  }
  return ctx;
}
