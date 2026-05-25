import { useTranslation } from 'react-i18next';
import { CheckCircle2, X, AlertOctagon } from 'lucide-react';
import { timeAgo } from './timeAgo';

interface Incident {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical' | string;
  source: string;
  title: string;
  description: string | null;
  affected_service: string | null;
  status: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

interface Props {
  incidents: Incident[];
  emptyLabel: string;
  onAcknowledge: (id: string) => void;
  onResolve: (incident: Incident) => void;
  onDismiss: (id: string) => void;
}

const SEV_COLOR: Record<string, string> = {
  info: '#0EA5E9',
  warning: '#F59E0B',
  error: '#DC2626',
  critical: '#991B1B',
};

const SEV_LABEL_KEY: Record<string, string> = {
  info: 'ops.sevInfo',
  warning: 'ops.sevWarning',
  error: 'ops.sevError',
  critical: 'ops.sevCritical',
};

export default function IncidentTimeline({ incidents, emptyLabel, onAcknowledge, onResolve, onDismiss }: Props) {
  const { t } = useTranslation();
  if (incidents.length === 0) {
    return (
      <div style={{
        padding: '36px 12px', textAlign: 'center',
        background: '#ECFDF5', borderRadius: 10, border: '1px solid #A7F3D0',
        fontSize: 13, fontWeight: 800, color: '#065F46',
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
      }}>{emptyLabel}</div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {incidents.map((inc) => {
        const sevColor = SEV_COLOR[inc.severity] || '#6B7280';
        const sevKey = SEV_LABEL_KEY[inc.severity] || 'ops.sevInfo';
        const isOpen = inc.status === 'open' || inc.status === 'investigating';
        return (
          <div key={inc.id} style={{
            background: '#fff', borderRadius: 12,
            border: `1px solid ${isOpen ? sevColor + '55' : 'var(--border-subtle, #E5E7EB)'}`,
            padding: 14,
            display: 'flex', flexDirection: 'column', gap: 8,
            boxShadow: isOpen ? `0 0 0 3px ${sevColor}15` : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span dir="ltr" style={{
                padding: '2px 8px', borderRadius: 999,
                background: sevColor + '15', color: sevColor,
                fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <AlertOctagon size={10} />{t(sevKey)}
              </span>
              {inc.affected_service && (
                <span dir="ltr" style={{
                  padding: '2px 8px', borderRadius: 4,
                  background: '#F3F4F6', color: 'var(--wsl-ink-2, #374151)',
                  fontSize: 10, fontWeight: 800,
                }}>{inc.affected_service}</span>
              )}
              <span style={{
                marginInlineStart: 'auto',
                fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)',
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              }}>{timeAgo(inc.created_at, t)}</span>
            </div>
            <div style={{
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontWeight: 900, fontSize: 14, color: 'var(--wsl-ink, #0F172A)',
            }}>{inc.title}</div>
            {inc.description && (
              <div style={{
                fontSize: 12, color: 'var(--wsl-ink-2, #374151)',
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>{inc.description}</div>
            )}
            {inc.resolved_at && inc.resolution_notes && (
              <div style={{
                padding: '8px 10px', borderRadius: 8,
                background: '#ECFDF5', border: '1px solid #A7F3D0',
                fontSize: 11, color: '#065F46',
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              }}>
                <strong>{t('ops.resolveNotes')}:</strong> {inc.resolution_notes}
              </div>
            )}
            {isOpen && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {inc.status === 'open' && (
                  <button onClick={() => onAcknowledge(inc.id)} style={{
                    padding: '5px 10px', borderRadius: 6,
                    border: '1px solid var(--border-subtle, #E5E7EB)',
                    background: '#fff', color: '#0EA5E9', cursor: 'pointer',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                    fontWeight: 800, fontSize: 11,
                  }}>{t('ops.actionAcknowledge')}</button>
                )}
                <button onClick={() => onResolve(inc)} style={{
                  padding: '5px 10px', borderRadius: 6,
                  border: '1px solid #D1FAE5', background: '#ECFDF5', color: '#065F46',
                  cursor: 'pointer',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 800, fontSize: 11,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <CheckCircle2 size={11} /> {t('ops.actionResolve')}
                </button>
                <button onClick={() => onDismiss(inc.id)} style={{
                  padding: '5px 10px', borderRadius: 6,
                  border: '1px solid var(--border-subtle, #E5E7EB)',
                  background: '#fff', color: 'var(--wsl-ink-3, #6B7280)', cursor: 'pointer',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 800, fontSize: 11,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <X size={11} /> {t('ops.actionDismiss')}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
