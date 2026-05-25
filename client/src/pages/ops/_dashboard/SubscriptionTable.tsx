import { useTranslation } from 'react-i18next';
import { timeAgo } from './timeAgo';

interface SubRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  monthly_amount_sar: number | string;
  user?: { email?: string | null; full_name?: string | null; avatar_url?: string | null } | null;
}

interface Props {
  rows: SubRow[];
  emptyLabel: string;
  onAction: (row: SubRow, action: 'extend' | 'cancel' | 'mark_paid') => void;
}

const PLAN_COLOR: Record<string, string> = {
  free: '#9CA3AF',
  starter: '#3B82F6',
  pro: '#14b8a6',
  growth: '#10B981',
  elite: '#8B5CF6',
};

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const s = (name || email || '?').trim();
  const parts = s.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export default function SubscriptionTable({ rows, emptyLabel, onAction }: Props) {
  const { t } = useTranslation();
  const now = Date.now();

  if (rows.length === 0) {
    return (
      <div style={{
        padding: '36px 12px', textAlign: 'center',
        fontSize: 12, fontWeight: 600, color: 'var(--wsl-ink-3, #6B7280)',
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
      }}>{emptyLabel}</div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle, #E5E7EB)' }}>
            {[t('ops.subUser'), t('ops.subPlan'), t('ops.subMrr'), t('ops.subPeriodEnd'), t('ops.subStatus'), t('ops.subActions')].map((h) => (
              <th key={h} style={{
                padding: '8px 10px', textAlign: 'start',
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                fontWeight: 900, fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)',
                textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const endMs = new Date(r.current_period_end).getTime();
            const daysLeft = Math.round((endMs - now) / (24 * 60 * 60 * 1000));
            const isOverdue = daysLeft < 0;
            const planColor = PLAN_COLOR[r.plan] || '#9CA3AF';
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle, #E5E7EB)' }}>
                <td style={{ padding: '10px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: '#0EA5E915', color: '#0EA5E9',
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                      fontWeight: 900, fontSize: 10,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {r.user?.avatar_url
                        ? <img src={r.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        : initials(r.user?.full_name, r.user?.email)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontWeight: 800, fontSize: 12, color: 'var(--wsl-ink, #0F172A)',
                        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180,
                      }}>{r.user?.full_name || r.user?.email || '—'}</div>
                      {r.user?.email && (
                        <div dir="ltr" style={{
                          fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)',
                          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                          maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{r.user.email}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 10px' }}>
                  <span dir="ltr" style={{
                    padding: '2px 8px', borderRadius: 999,
                    background: planColor + '15', color: planColor,
                    fontSize: 10, fontWeight: 900, textTransform: 'capitalize',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  }}>{r.plan}</span>
                </td>
                <td dir="ltr" style={{
                  padding: '10px 10px',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 900, fontSize: 12, color: '#D4AF37',
                  fontVariantNumeric: 'tabular-nums',
                }}>{Number(r.monthly_amount_sar || 0).toLocaleString('en-US')} {t('ops.sarSuffix')}</td>
                <td dir="ltr" style={{
                  padding: '10px 10px',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontSize: 11, fontWeight: 800,
                  color: isOverdue ? '#DC2626' : daysLeft <= 7 ? '#F59E0B' : 'var(--wsl-ink-2, #374151)',
                }}>
                  {isOverdue
                    ? t('ops.overdueDays', { n: Math.abs(daysLeft) })
                    : daysLeft >= 0 ? t('ops.inXDays', { n: daysLeft }) : '—'}
                  <div style={{ fontSize: 9, color: 'var(--wsl-ink-3, #6B7280)', fontWeight: 600, marginTop: 1 }}>
                    {timeAgo(r.current_period_end, t)}
                  </div>
                </td>
                <td style={{ padding: '10px 10px' }}>
                  <span dir="ltr" style={{
                    padding: '2px 8px', borderRadius: 999,
                    background: r.status === 'active' ? '#D1FAE5' : r.status === 'past_due' ? '#FEE2E2' : '#F3F4F6',
                    color: r.status === 'active' ? '#065F46' : r.status === 'past_due' ? '#991B1B' : '#6B7280',
                    fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  }}>{r.status}</span>
                </td>
                <td style={{ padding: '10px 10px' }}>
                  <div style={{ display: 'inline-flex', gap: 4 }}>
                    <button onClick={() => onAction(r, 'extend')} title={t('ops.actionExtend') as string} style={{
                      padding: '3px 8px', borderRadius: 6,
                      border: '1px solid #D1FAE5', background: '#ECFDF5', color: '#065F46',
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                      fontWeight: 900, fontSize: 9, cursor: 'pointer',
                    }}>{t('ops.actionExtend')}</button>
                    <button onClick={() => onAction(r, 'mark_paid')} title={t('ops.actionMarkPaid') as string} style={{
                      padding: '3px 8px', borderRadius: 6,
                      border: '1px solid var(--border-subtle, #E5E7EB)', background: '#fff', color: '#0EA5E9',
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                      fontWeight: 900, fontSize: 9, cursor: 'pointer',
                    }}>{t('ops.actionMarkPaid')}</button>
                    <button onClick={() => onAction(r, 'cancel')} title={t('ops.actionCancel') as string} style={{
                      padding: '3px 8px', borderRadius: 6,
                      border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626',
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                      fontWeight: 900, fontSize: 9, cursor: 'pointer',
                    }}>{t('ops.actionCancel')}</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
