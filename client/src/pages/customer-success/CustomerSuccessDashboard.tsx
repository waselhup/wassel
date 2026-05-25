import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HeartHandshake, Users, RefreshCw, Crown, MessageCircle, Mail } from 'lucide-react';
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

const SEGMENT_COLORS: Record<string, string> = {
  vip: '#D4AF37',
  active: '#10B981',
  warm_lead: '#06B6D4',
  hot_lead: '#F59E0B',
  at_risk: '#EF4444',
  dormant: '#6B7280',
  churned: '#374151',
};

export default function CustomerSuccessDashboard() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const [cohorts, setCohorts] = useState<Record<string, number>>({});
  const [scores, setScores] = useState<any[]>([]);
  const [whatsappMessages, setWhatsappMessages] = useState<any[]>([]);
  const [emailMessages, setEmailMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [c, s, wa, em] = await Promise.all([
        trpc.alMukhadram.healthCohorts(),
        trpc.alMukhadram.listHealthScores({ limit: 50 }),
        trpc.alMukhadram.listWhatsappMessages({ limit: 30 }),
        trpc.alMukhadram.listEmailMessages({ limit: 30 }),
      ]);
      setCohorts(c);
      setScores(s);
      setWhatsappMessages(wa);
      setEmailMessages(em);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const runAction = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    try { await fn(); await refresh(); } finally { setBusy(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Agent header */}
      <div style={{ ...CARD, background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#F59E0B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(245,158,11,0.3)' }}>
            <HeartHandshake size={28} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ ...SECTION_TITLE, fontSize: 22 }}>{tr('المخضرم', 'Al-Mukhadram')}</h2>
            <div style={{ fontSize: 13, color: '#78350F', marginTop: 4 }}>
              {tr('عضوكم الكبير في نجاح العملاء — يحافظ، يرعى، ويرفع', 'Your seasoned customer success lead — retains, nurtures, lifts')}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <button
          onClick={() => runAction('welcome', () => trpc.alMukhadram.draftWelcomeSequence())}
          disabled={busy !== null}
          style={{ ...CARD, cursor: 'pointer', textAlign: isAr ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <Mail size={20} color="#F59E0B" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{tr('صياغة تسلسل الترحيب', 'Draft welcome sequence')}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{busy === 'welcome' ? '...' : tr('7 أيام · ثنائي اللغة', '7 days · bilingual')}</div>
          </div>
        </button>
        <button
          onClick={() => runAction('rescues', () => trpc.alMukhadram.draftDailyRescues({ limit: 20 }))}
          disabled={busy !== null}
          style={{ ...CARD, cursor: 'pointer', textAlign: isAr ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <RefreshCw size={20} color="#F59E0B" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{tr('رسائل استرداد يومية', 'Daily rescue drafts')}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{busy === 'rescues' ? '...' : tr('خامل + استنفد الرموز', 'Dormant + free-consumed')}</div>
          </div>
        </button>
        <button
          onClick={() => runAction('recompute', () => trpc.alMukhadram.recomputeAllScores({ limit: 500 }))}
          disabled={busy !== null}
          style={{ ...CARD, cursor: 'pointer', textAlign: isAr ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <Users size={20} color="#F59E0B" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{tr('إعادة حساب الصحة', 'Recompute health')}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{busy === 'recompute' ? '...' : tr('كل المستخدمين', 'All users')}</div>
          </div>
        </button>
        <button
          onClick={() => runAction('vips', () => trpc.alMukhadram.flagVips())}
          disabled={busy !== null}
          style={{ ...CARD, cursor: 'pointer', textAlign: isAr ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <Crown size={20} color="#F59E0B" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{tr('وسم كبار العملاء', 'Flag VIPs')}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{busy === 'vips' ? '...' : tr('للمتابعة من المؤسس', 'For founder outreach')}</div>
          </div>
        </button>
      </div>

      {/* Health cohorts */}
      <div style={CARD}>
        <h3 style={SECTION_TITLE}><Users size={18} color="#F59E0B" /> {tr('شرائح الصحة', 'Health Cohorts')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 16 }}>
          {Object.entries(SEGMENT_COLORS).map(([seg, color]) => (
            <div key={seg} style={{ padding: 12, borderRadius: 10, background: color + '14', borderInlineStart: `3px solid ${color}` }}>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{cohorts[seg] || 0}</div>
              <div style={{ fontSize: 11, color: '#475569', textTransform: 'capitalize' }}>{seg.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top users by score */}
      <div style={CARD}>
        <h3 style={SECTION_TITLE}>{tr('أعلى نقاط الصحة', 'Top Health Scores')}</h3>
        <div style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
          {loading ? <div style={{ color: '#9CA3AF', padding: 12 }}>...</div> : scores.length === 0 ? (
            <div style={{ color: '#9CA3AF', padding: 12 }}>{tr('لا توجد بيانات بعد', 'No data yet')}</div>
          ) : (
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead><tr style={{ textAlign: isAr ? 'right' : 'left', color: '#6B7280' }}>
                <th style={{ padding: 6 }}>{tr('المستخدم', 'User')}</th>
                <th style={{ padding: 6 }}>{tr('النقاط', 'Score')}</th>
                <th style={{ padding: 6 }}>{tr('الشريحة', 'Segment')}</th>
                <th style={{ padding: 6 }}>{tr('احتمالية الترقية', 'Propensity')}</th>
              </tr></thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.user_id} style={{ borderTop: '1px solid #F3F4F6' }}>
                    <td style={{ padding: 8 }}>{s.profiles?.full_name || s.profiles?.email || s.user_id.slice(0, 8)}</td>
                    <td style={{ padding: 8, fontWeight: 700 }}>{s.score}</td>
                    <td style={{ padding: 8 }}><span style={{ background: (SEGMENT_COLORS[s.segment] || '#9CA3AF') + '22', color: SEGMENT_COLORS[s.segment] || '#9CA3AF', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s.segment}</span></td>
                    <td style={{ padding: 8 }}>{(Number(s.upgrade_propensity) * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent messages */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <div style={CARD}>
          <h3 style={SECTION_TITLE}><MessageCircle size={18} color="#25D366" /> {tr('رسائل واتساب', 'WhatsApp Messages')}</h3>
          <div style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto', fontSize: 12 }}>
            {whatsappMessages.length === 0 ? <div style={{ color: '#9CA3AF', padding: 8 }}>{tr('لا رسائل', 'No messages')}</div> :
              whatsappMessages.map((m) => (
                <div key={m.id} style={{ padding: 8, borderTop: '1px solid #F3F4F6' }}>
                  <div style={{ fontWeight: 700 }}>{m.direction === 'outbound' ? '↗' : '↘'} {m.to_phone || m.from_phone}</div>
                  <div style={{ color: '#475569', marginTop: 2 }}>{(m.body || '').slice(0, 100)}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{m.status} · {new Date(m.created_at).toLocaleString()}</div>
                </div>
              ))}
          </div>
        </div>
        <div style={CARD}>
          <h3 style={SECTION_TITLE}><Mail size={18} color="#6B7280" /> {tr('رسائل البريد', 'Email Messages')}</h3>
          <div style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto', fontSize: 12 }}>
            {emailMessages.length === 0 ? <div style={{ color: '#9CA3AF', padding: 8 }}>{tr('لا رسائل', 'No messages')}</div> :
              emailMessages.map((m) => (
                <div key={m.id} style={{ padding: 8, borderTop: '1px solid #F3F4F6' }}>
                  <div style={{ fontWeight: 700 }}>{m.to_email}</div>
                  <div style={{ color: '#475569', marginTop: 2 }}>{m.subject}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{m.status} · {m.sequence_name || ''}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
