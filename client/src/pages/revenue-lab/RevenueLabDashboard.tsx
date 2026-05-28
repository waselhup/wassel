import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Zap, FlaskConical, Gift, CheckCircle2, XCircle } from 'lucide-react';
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

export default function RevenueLabDashboard() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const [hotLeads, setHotLeads] = useState<any[]>([]);
  const [pendingPitches, setPendingPitches] = useState<any[]>([]);
  const [experiments, setExperiments] = useState<any[]>([]);
  const [refCodes, setRefCodes] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    const [h, p, e, r] = await Promise.all([
      trpc.hassan.hotLeads({ limit: 20 }),
      trpc.hassan.listPendingPitches(),
      trpc.hassan.listExperiments(),
      trpc.hassan.referralCodes(),
    ]);
    setHotLeads(h); setPendingPitches(p); setExperiments(e); setRefCodes(r);
  };

  useEffect(() => { refresh(); }, []);

  const action = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    try { await fn(); await refresh(); } finally { setBusy(null); }
  };

  return (
    <div className="admin-portal-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ ...CARD, background: 'linear-gradient(135deg, #FEF2F2 0%, #FECACA 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#EF4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(239,68,68,0.3)' }}>
            <TrendingUp size={28} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ ...SECTION_TITLE, fontSize: 22 }}>{tr('حسن', 'Hassan')}</h2>
            <div style={{ fontSize: 13, color: '#7F1D1D', marginTop: 4 }}>
              {tr('مختبر الإيرادات — يصمم العروض، يشغّل التجارب، يحوّل', 'Revenue lab — drafts pitches, runs experiments, converts')}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <button onClick={() => action('hot', () => trpc.hassan.draftHotUpgradePitches({ limit: 10 }))} disabled={busy !== null}
          style={{ ...CARD, cursor: 'pointer', textAlign: isAr ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Zap size={20} color="#EF4444" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{tr('عروض حارة', 'Hot upgrade pitches')}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{busy === 'hot' ? '...' : tr('أعلى احتمالية', 'Top propensity')}</div>
          </div>
        </button>
        <button onClick={() => action('exp', () => trpc.hassan.proposeExperiment({ surface: 'pricing_page', hypothesis: 'Showing token packs above plans increases conversion' }))} disabled={busy !== null}
          style={{ ...CARD, cursor: 'pointer', textAlign: isAr ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
          <FlaskConical size={20} color="#EF4444" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{tr('اقتراح تجربة', 'Propose experiment')}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{busy === 'exp' ? '...' : tr('A/B', 'A/B')}</div>
          </div>
        </button>
        <button onClick={() => action('ref', () => trpc.hassan.createReferralCode({ rewardInviter: 100, rewardInvitee: 100 }))} disabled={busy !== null}
          style={{ ...CARD, cursor: 'pointer', textAlign: isAr ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Gift size={20} color="#EF4444" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{tr('كود إحالة', 'New referral code')}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{busy === 'ref' ? '...' : tr('100 رمز لكل طرف', '100 tokens each')}</div>
          </div>
        </button>
      </div>

      {/* Hot leads */}
      <div style={CARD}>
        <h3 style={SECTION_TITLE}>{tr('العملاء الحارّون', 'Hot Leads')}</h3>
        <div style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto', fontSize: 13 }}>
          {hotLeads.length === 0 ? <div style={{ color: '#9CA3AF', padding: 8 }}>{tr('لا توجد بيانات', 'No leads')}</div> :
            <table style={{ width: '100%' }}>
              <thead><tr style={{ textAlign: isAr ? 'right' : 'left', color: '#6B7280' }}>
                <th style={{ padding: 6 }}>{tr('المستخدم', 'User')}</th>
                <th style={{ padding: 6 }}>{tr('الاحتمالية', 'Propensity')}</th>
                <th style={{ padding: 6 }}>{tr('النقاط', 'Score')}</th>
                <th style={{ padding: 6 }}>{tr('الباقة', 'Plan')}</th>
              </tr></thead>
              <tbody>
                {hotLeads.map((l) => (
                  <tr key={l.user_id} style={{ borderTop: '1px solid #F3F4F6' }}>
                    <td style={{ padding: 8 }}>{l.profiles?.full_name || l.profiles?.email || l.user_id.slice(0, 8)}</td>
                    <td style={{ padding: 8, fontWeight: 700, color: '#EF4444' }}>{(Number(l.upgrade_propensity) * 100).toFixed(0)}%</td>
                    <td style={{ padding: 8 }}>{l.score}</td>
                    <td style={{ padding: 8 }}>{l.profiles?.plan || 'free'}</td>
                  </tr>
                ))}
              </tbody>
            </table>}
        </div>
      </div>

      {/* Pending pitches */}
      <div style={CARD}>
        <h3 style={SECTION_TITLE}>{tr('عروض ترقية بانتظار الموافقة', 'Pending Pitches')}</h3>
        <div style={{ marginTop: 12, maxHeight: 360, overflowY: 'auto' }}>
          {pendingPitches.length === 0 ? <div style={{ color: '#9CA3AF', padding: 8 }}>{tr('لا توجد عروض', 'None')}</div> :
            pendingPitches.map((p) => (
              <div key={p.id} style={{ padding: 12, borderTop: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', alignItems: 'start', gap: 12, justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{isAr ? p.headline_ar : p.headline_en}</div>
                    <div style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>{isAr ? p.body_ar : p.body_en}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
                      {tr('للمستخدم', 'For')}: {p.profiles?.full_name || p.user_id.slice(0, 8)} · {tr('السطح', 'surface')}: {p.surface}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => action('approve', () => trpc.hassan.approvePitch({ pitchId: p.id }))}
                      style={{ background: '#10B981', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      <CheckCircle2 size={14} />
                    </button>
                    <button onClick={() => action('reject', () => trpc.hassan.rejectPitch({ pitchId: p.id }))}
                      style={{ background: '#EF4444', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      <XCircle size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Experiments */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <div style={CARD}>
          <h3 style={SECTION_TITLE}>{tr('التجارب', 'Experiments')}</h3>
          <div style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto', fontSize: 12 }}>
            {experiments.length === 0 ? <div style={{ color: '#9CA3AF', padding: 8 }}>{tr('لا توجد تجارب', 'None')}</div> :
              experiments.map((e) => (
                <div key={e.id} style={{ padding: 8, borderTop: '1px solid #F3F4F6' }}>
                  <div style={{ fontWeight: 700 }}>{e.name}</div>
                  <div style={{ color: '#475569', marginTop: 2 }}>{e.hypothesis}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{e.status} · {e.surface}</div>
                </div>
              ))}
          </div>
        </div>
        <div style={CARD}>
          <h3 style={SECTION_TITLE}>{tr('برنامج الإحالة', 'Referrals')}</h3>
          <div style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto', fontSize: 12 }}>
            {refCodes.length === 0 ? <div style={{ color: '#9CA3AF', padding: 8 }}>{tr('لا توجد أكواد', 'None')}</div> :
              refCodes.map((c) => (
                <div key={c.id} style={{ padding: 8, borderTop: '1px solid #F3F4F6' }}>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{c.code}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{tr('استخدامات', 'uses')}: {c.uses_count}{c.max_uses ? `/${c.max_uses}` : ''} · {c.reward_tokens_inviter} ↔ {c.reward_tokens_invitee}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
