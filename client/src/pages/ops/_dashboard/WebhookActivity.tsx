import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { timeAgo, maskEmail } from './timeAgo';

interface WebhookRow {
  id: string;
  user_id: string | null;
  amount_sar?: number | string;
  status: string;
  type?: string;
  muyassar_transaction_id?: string | null;
  muyassar_invoice_id?: string | null;
  metadata?: any;
  created_at: string;
  completed_at?: string | null;
  user?: { email?: string | null; full_name?: string | null } | null;
}

interface Props {
  rows: WebhookRow[];
  emptyLabel: string;
  onRetry: (id: string) => void;
}

export default function WebhookActivity({ rows, emptyLabel, onRetry }: Props) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div style={{
        padding: '28px 12px', textAlign: 'center',
        fontSize: 12, fontWeight: 600, color: 'var(--wsl-ink-3, #6B7280)',
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
      }}>{emptyLabel}</div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      maxHeight: 480, overflowY: 'auto',
    }}>
      {rows.map((r) => {
        const isOpen = openId === r.id;
        const statusColor = r.status === 'completed' || r.status === 'paid' ? '#10B981'
          : r.status === 'failed' || r.status === 'cancelled' ? '#DC2626'
          : r.status === 'refunded' ? '#F59E0B'
          : '#6B7280';
        const amt = typeof r.amount_sar === 'string' ? Number(r.amount_sar) : (r.amount_sar || 0);
        return (
          <div key={r.id} style={{
            borderRadius: 8, background: '#F9FAFB',
            border: '1px solid transparent',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 800, fontSize: 12, color: 'var(--wsl-ink, #0F172A)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span dir="ltr" style={{
                    padding: '1px 6px', borderRadius: 4,
                    background: statusColor + '15', color: statusColor,
                    fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                  }}>{r.status}</span>
                  {r.type && (
                    <span style={{ fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)' }}>{r.type}</span>
                  )}
                </div>
                <div dir="ltr" style={{
                  fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                }}>{maskEmail(r.user?.email)} · {timeAgo(r.created_at, t)}</div>
              </div>
              <span dir="ltr" style={{
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                fontWeight: 900, fontSize: 12, color: '#D4AF37',
                fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'end',
              }}>{amt.toLocaleString('en-US')} {t('ops.sarSuffix')}</span>
              {(r.status === 'failed' || r.status === 'pending') && (
                <button onClick={() => onRetry(r.id)} style={{
                  padding: '3px 8px', borderRadius: 6,
                  border: '1px solid var(--border-subtle, #E5E7EB)',
                  background: '#fff', color: '#0EA5E9', cursor: 'pointer',
                  fontSize: 9, fontWeight: 900,
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                }}>{t('ops.retryFulfillment')}</button>
              )}
              <button onClick={() => setOpenId(isOpen ? null : r.id)} style={{
                padding: 4, border: 'none', background: 'transparent', cursor: 'pointer',
                color: 'var(--wsl-ink-3, #6B7280)',
              }} aria-label={t('ops.viewRaw') as string}>
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
            {isOpen && (
              <pre dir="ltr" style={{
                margin: 0, padding: '6px 10px 10px',
                fontFamily: 'monospace', fontSize: 10,
                color: 'var(--wsl-ink-2, #374151)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>{JSON.stringify({
                moyasar_transaction_id: r.muyassar_transaction_id,
                muyassar_invoice_id: r.muyassar_invoice_id,
                completed_at: r.completed_at,
                metadata: r.metadata,
              }, null, 2)}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
