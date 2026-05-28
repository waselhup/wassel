import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, CheckCircle2, Clock } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { timeAgo } from './timeAgo';

interface ResolutionRow {
  id: string;
  pattern_key: string;
  service: string | null;
  auto_resolution: string | null;
  last_seen: string | null;
  seen_count: number | null;
}

export default function HusseinAutoResolutions() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ResolutionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await trpc.hussein.recentResolutions({ limit: 20 });
        if (!cancelled) setRows((data as ResolutionRow[]) || []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 18, color: '#9CA3AF', fontSize: 13 }}>
        {t('ops.husseinResolutionsLoading')}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{
        padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        <Bot size={28} style={{ color: '#0EA5E9', opacity: 0.5 }} />
        {t('ops.husseinResolutionsEmpty')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <div key={r.id} style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center', gap: 12,
          padding: '12px 14px', borderRadius: 10,
          background: '#F0F9FF',
          border: '1px solid #BAE6FD',
        }}>
          <CheckCircle2 size={18} style={{ color: '#0EA5E9' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontWeight: 800, fontSize: 13, color: '#0F172A',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {r.pattern_key}
            </div>
            <div style={{
              fontSize: 12, color: '#475569', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {r.auto_resolution || t('ops.husseinResolutionsNoAction')}
              {r.service ? ` · ${r.service}` : ''}
              {r.seen_count ? ` · ×${r.seen_count}` : ''}
            </div>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: '#64748B',
          }}>
            <Clock size={11} /> {timeAgo(r.last_seen, t)}
          </div>
        </div>
      ))}
    </div>
  );
}
