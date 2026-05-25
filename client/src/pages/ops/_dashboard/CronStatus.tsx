import { useTranslation } from 'react-i18next';
import { Play, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { timeAgo } from './timeAgo';

interface CronRow {
  name: string;
  path: string;
  schedule: string;
  last_run: string | null;
  last_status: 'ok' | 'fail' | 'unknown';
}

interface Props {
  crons: CronRow[];
  onTrigger: (endpoint: string) => void;
}

export default function CronStatus({ crons, onTrigger }: Props) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {crons.map((c) => {
        const statusColor = c.last_status === 'ok' ? '#10B981'
          : c.last_status === 'fail' ? '#DC2626' : '#9CA3AF';
        const StatusIcon = c.last_status === 'ok' ? CheckCircle2
          : c.last_status === 'fail' ? XCircle : Clock;
        return (
          <div key={c.path} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10, background: '#F9FAFB',
            border: '1px solid var(--border-subtle, #E5E7EB)',
          }}>
            <StatusIcon size={14} style={{ color: statusColor, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                fontWeight: 800, fontSize: 12, color: 'var(--wsl-ink, #0F172A)',
              }}>{c.name}</div>
              <div dir="ltr" style={{
                fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)',
                fontFamily: 'monospace',
              }}>{c.schedule} · {c.path}</div>
            </div>
            <div style={{ textAlign: 'end', minWidth: 100 }}>
              <div style={{
                fontSize: 10, fontWeight: 800, color: statusColor,
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                textTransform: 'uppercase',
              }}>{c.last_status === 'ok' ? t('ops.cronStatusOk') : c.last_status === 'fail' ? t('ops.cronStatusFail') : t('ops.cronStatusUnknown')}</div>
              <div style={{
                fontSize: 9, color: 'var(--wsl-ink-3, #6B7280)',
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              }}>{t('ops.cronLastRun')}: {timeAgo(c.last_run, t)}</div>
            </div>
            <button onClick={() => onTrigger(c.path)} style={{
              padding: '4px 8px', borderRadius: 6,
              border: '1px solid var(--border-subtle, #E5E7EB)',
              background: '#fff', color: '#0EA5E9', cursor: 'pointer',
              fontSize: 9, fontWeight: 900,
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <Play size={10} /> {t('ops.triggerNow')}
            </button>
          </div>
        );
      })}
    </div>
  );
}
