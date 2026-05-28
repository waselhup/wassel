import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, AlertOctagon, Eye, Database, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 14,
  border: '1px solid var(--border-subtle, #E5E7EB)',
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
  fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink, #0F172A)',
  margin: 0, display: 'flex', alignItems: 'center', gap: 8,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#DC2626', high: '#EF4444', medium: '#F59E0B', low: '#06B6D4',
};

export default function ComplianceDashboard() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const [fraudSignals, setFraudSignals] = useState<any[]>([]);
  const [moderationLog, setModerationLog] = useState<any[]>([]);
  const [pdplLog, setPdplLog] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [sweep, setSweep] = useState<{ openSignals: number; flaggedContent: number; pdplEvents: number } | null>(null);

  const refresh = async () => {
    const [f, m, p] = await Promise.all([
      trpc.dhai.listFraudSignals({ limit: 50 }),
      trpc.dhai.contentModerationLog({ limit: 30 }),
      trpc.dhai.pdplAuditLog({ limit: 30 }),
    ]);
    setFraudSignals(f); setModerationLog(m); setPdplLog(p);
  };

  useEffect(() => { refresh(); }, []);

  const action = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    try {
      const r = await fn();
      if (label === 'sweep') setSweep(r as any);
      await refresh();
    } finally { setBusy(null); }
  };

  const reviewSignal = async (signalId: string, decision: 'confirmed_fraud' | 'false_positive') => {
    setBusy('review');
    try {
      await trpc.dhai.reviewSignal({ signalId, decision });
      await refresh();
    } finally { setBusy(null); }
  };

  return (
    <div className="admin-portal-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ ...CARD, background: 'linear-gradient(135deg, #EEF2FF 0%, #C7D2FE 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#6366F1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(99,102,241,0.3)' }}>
            <ShieldCheck size={28} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ ...SECTION_TITLE, fontSize: 22 }}>{tr('ضي', 'Dhai')}</h2>
            <div style={{ fontSize: 13, color: '#312E81', marginTop: 4 }}>
              {tr('الامتثال والاحتيال — تحرس وتراقب وتوثّق', 'Compliance & fraud — guards, monitors, records')}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <button onClick={() => action('sweep', () => trpc.dhai.dailySweep())} disabled={busy !== null}
          style={{ ...CARD, cursor: 'pointer', textAlign: isAr ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
          <RefreshCw size={20} color="#6366F1" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{tr('فحص يومي شامل', 'Daily sweep')}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{busy === 'sweep' ? '...' : tr('احتيال + محتوى + PDPL', 'Fraud + content + PDPL')}</div>
          </div>
        </button>
      </div>

      {sweep && (
        <div style={{ ...CARD, background: '#EEF2FF' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div><div style={{ fontSize: 24, fontWeight: 900, color: '#6366F1' }}>{sweep.openSignals}</div><div style={{ fontSize: 11, color: '#475569' }}>{tr('إشارات احتيال', 'Open fraud signals')}</div></div>
            <div><div style={{ fontSize: 24, fontWeight: 900, color: '#6366F1' }}>{sweep.flaggedContent}</div><div style={{ fontSize: 11, color: '#475569' }}>{tr('محتوى موسوم', 'Flagged content')}</div></div>
            <div><div style={{ fontSize: 24, fontWeight: 900, color: '#6366F1' }}>{sweep.pdplEvents}</div><div style={{ fontSize: 11, color: '#475569' }}>{tr('أحداث PDPL', 'PDPL events')}</div></div>
          </div>
        </div>
      )}

      {/* Fraud signals */}
      <div style={CARD}>
        <h3 style={SECTION_TITLE}><AlertOctagon size={18} color="#6366F1" /> {tr('إشارات الاحتيال', 'Fraud Signals')}</h3>
        <div style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
          {fraudSignals.length === 0 ? <div style={{ color: '#9CA3AF', padding: 8 }}>{tr('لا توجد إشارات', 'No signals')}</div> :
            fraudSignals.map((s) => (
              <div key={s.id} style={{ padding: 12, borderTop: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: (SEVERITY_COLORS[s.severity] || '#9CA3AF') + '22', color: SEVERITY_COLORS[s.severity] || '#9CA3AF', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s.severity}</span>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{s.signal_type}</span>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>{s.profiles?.email || s.user_id?.slice(0, 8)}</span>
                  </div>
                  {['open', 'investigating'].includes(s.status) && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => reviewSignal(s.id, 'confirmed_fraud')} style={{ background: '#EF4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{tr('احتيال', 'Fraud')}</button>
                      <button onClick={() => reviewSignal(s.id, 'false_positive')} style={{ background: '#9CA3AF', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{tr('سليم', 'OK')}</button>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{JSON.stringify(s.details).slice(0, 200)}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Content moderation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <div style={CARD}>
          <h3 style={SECTION_TITLE}><Eye size={18} color="#6366F1" /> {tr('سجل تدقيق المحتوى', 'Moderation Log')}</h3>
          <div style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto', fontSize: 12 }}>
            {moderationLog.length === 0 ? <div style={{ color: '#9CA3AF', padding: 8 }}>{tr('لا توجد سجلات', 'None')}</div> :
              moderationLog.map((m) => (
                <div key={m.id} style={{ padding: 8, borderTop: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      background: m.decision === 'blocked' ? '#FEE2E2' : m.decision === 'flagged' ? '#FEF3C7' : '#D1FAE5',
                      color: m.decision === 'blocked' ? '#991B1B' : m.decision === 'flagged' ? '#92400E' : '#065F46',
                      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                    }}>{m.decision}</span>
                    <span style={{ fontWeight: 700 }}>{m.content_type}</span>
                  </div>
                  <div style={{ color: '#475569', marginTop: 4 }}>{(m.scanned_text || '').slice(0, 120)}</div>
                </div>
              ))}
          </div>
        </div>
        <div style={CARD}>
          <h3 style={SECTION_TITLE}><Database size={18} color="#6366F1" /> {tr('سجل PDPL', 'PDPL Audit Log')}</h3>
          <div style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto', fontSize: 12 }}>
            {pdplLog.length === 0 ? <div style={{ color: '#9CA3AF', padding: 8 }}>{tr('لا توجد أحداث', 'None')}</div> :
              pdplLog.map((p) => (
                <div key={p.id} style={{ padding: 8, borderTop: '1px solid #F3F4F6' }}>
                  <div style={{ fontWeight: 700 }}>{p.event_type}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{new Date(p.created_at).toLocaleString()}{p.data_category ? ` · ${p.data_category}` : ''}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
