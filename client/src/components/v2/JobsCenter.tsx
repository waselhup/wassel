import { useLocation } from 'wouter';
import Sheet from '@/components/v2/Sheet';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import { useJobs, type Job, type JobType } from '@/lib/v2/jobs';

export interface JobsCenterProps {
  open: boolean;
  onClose: () => void;
}

const TYPE_LABEL: Record<JobType, string> = {
  'analysis':        'تحليل',
  'post-generation': 'منشور',
  'cv-build':        'سيرة',
  'export':          'تصدير',
};

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.round(diff / 1000);
  if (sec < 60)   return `قبل ${sec} ث`;
  const min = Math.round(sec / 60);
  if (min < 60)   return `قبل ${min} د`;
  const hr  = Math.round(min / 60);
  if (hr  < 24)  return `قبل ${hr} س`;
  const day = Math.round(hr / 24);
  return `قبل ${day} ي`;
}

function StatusIcon({ status }: { status: Job['status'] }) {
  if (status === 'running' || status === 'queued') {
    return (
      <span
        className="block h-2 w-2 rounded-full bg-teal-500"
        style={{ animation: 'live-pulse 2s ease-in-out infinite' }}
        aria-hidden="true"
      />
    );
  }
  if (status === 'completed') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 text-teal-700" aria-hidden="true">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6 L5 8.5 L9.5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-v2-rose-50 text-v2-rose" aria-hidden="true">
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function JobRow({ job, onClose }: { job: Job; onClose: () => void }) {
  const { cancelJob, retryJob, removeJob } = useJobs();
  const [, navigate] = useLocation();

  const isActive    = job.status === 'running' || job.status === 'queued';
  const isCompleted = job.status === 'completed';
  const isFailed    = job.status === 'failed';
  const ts = job.completedAt ?? job.createdAt;

  return (
    <div className="border-b border-v2-line py-3.5">
      <div className="mb-1.5 flex items-start gap-2.5">
        <span className="mt-1 shrink-0">
          <StatusIcon status={job.status} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-en text-[10px] font-semibold uppercase tracking-[0.1em] text-v2-mute">
              {TYPE_LABEL[job.type]}
            </span>
            <span className="font-ar text-[14px] font-semibold text-v2-ink truncate">{job.title}</span>
          </div>
          {isActive && (
            <p className="mt-1 font-ar text-[12px] text-v2-dim">
              <NumDisplay>{Math.round(job.progress * 100)}</NumDisplay>%
            </p>
          )}
          {isFailed && job.error && (
            <p className="mt-1 font-ar text-[12px] text-v2-rose">{job.error}</p>
          )}
          {isCompleted && (
            <p className="mt-1 font-ar text-[12px] text-v2-dim">{relativeTime(ts)}</p>
          )}
        </div>
        <span className="shrink-0 font-ar text-[11px] text-v2-mute">{relativeTime(ts)}</span>
      </div>

      {isActive && (
        <div className="mt-1 mb-2.5 h-1 overflow-hidden rounded-full bg-v2-line">
          <div
            className="h-full bg-teal-500 transition-all duration-300 ease-out"
            style={{ width: `${Math.round(job.progress * 100)}%` }}
          />
        </div>
      )}

      <div className="flex gap-2">
        {isActive && (
          <Button variant="secondary" size="sm" onClick={() => cancelJob(job.id)}>
            إلغاء
          </Button>
        )}
        {isCompleted && job.resultUrl && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => { navigate(job.resultUrl!); onClose(); }}
          >
            عرض النتيجة
          </Button>
        )}
        {isCompleted && !job.resultUrl && (
          <Button variant="ghost" size="sm" onClick={() => removeJob(job.id)}>
            إخفاء
          </Button>
        )}
        {isFailed && (
          <>
            <Button variant="primary" size="sm" onClick={() => retryJob(job.id)}>
              إعادة المحاولة
            </Button>
            <Button variant="ghost" size="sm" onClick={() => removeJob(job.id)}>
              إخفاء
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  count,
  emptyMessage,
  jobs,
  onClose,
}: {
  label: string;
  count: number;
  emptyMessage: string;
  jobs: Job[];
  onClose: () => void;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <Eyebrow>{label}</Eyebrow>
        <NumDisplay className="rounded-full bg-v2-canvas-2 px-2 py-0.5 text-[10px] text-v2-mute">
          {count}
        </NumDisplay>
        <div className="h-px flex-1 bg-v2-line" />
      </div>
      {jobs.length === 0 ? (
        <p className="px-1 py-3 font-ar text-[13px] text-v2-dim">{emptyMessage}</p>
      ) : (
        jobs.map((j) => <JobRow key={j.id} job={j} onClose={onClose} />)
      )}
    </section>
  );
}

function JobsCenter({ open, onClose }: JobsCenterProps) {
  const { active, completed, failed } = useJobs();

  return (
    <Sheet open={open} onClose={onClose} title="مركز المهام" snapPoints={[50, 90]}>
      <Section label="نشطة"  count={active.length}    emptyMessage="لا توجد مهام نشطة الآن"        jobs={active}    onClose={onClose} />
      <Section label="مكتملة" count={completed.length} emptyMessage="لا توجد مهام مكتملة بعد"      jobs={completed} onClose={onClose} />
      <Section label="فاشلة"  count={failed.length}    emptyMessage="لا توجد مهام فاشلة — كل شيء جيد" jobs={failed}    onClose={onClose} />
    </Sheet>
  );
}

export default JobsCenter;
