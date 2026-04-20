import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { trpc } from '../lib/trpc';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, FileText, Sparkles, Zap, Coins,
} from 'lucide-react';

type TimeRange = 'today' | 'week' | 'month' | 'all';

interface Overview {
  range: string;
  kpis: {
    profile_analyses: number;
    cvs_generated: number;
    posts_generated: number;
    campaigns_active?: number;
    messages_sent?: number;
    connections_accepted?: number;
    response_rate?: number;
    jobs_applied?: number;
  };
  tokens: { balance: number; used_total: number };
}

interface ActivityRow {
  date: string;
  analyses: number;
  cvs: number;
  posts: number;
}

export default function Analytics() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [range, setRange] = useState<TimeRange>('month');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [tokensBd, setTokensBd] = useState<Array<{ feature: string; total: number }>>([]);
  const [loadingOv, setLoadingOv] = useState(true);
  const [loadingTs, setLoadingTs] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingOv(true);
    trpc.analytics.overview({ range })
      .then(d => { if (!cancelled) setOverview(d); })
      .catch(e => console.error('[analytics.overview]', e))
      .finally(() => { if (!cancelled) setLoadingOv(false); });
    trpc.analytics.tokensBreakdown({ range })
      .then(d => { if (!cancelled) setTokensBd(d || []); })
      .catch(e => console.error('[analytics.tokens]', e));
    return () => { cancelled = true; };
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    setLoadingTs(true);
    trpc.analytics.activityTimeseries({ days: 30 })
      .then(d => { if (!cancelled) setActivity(d || []); })
      .catch(e => console.error('[analytics.timeseries]', e))
      .finally(() => { if (!cancelled) setLoadingTs(false); });
    return () => { cancelled = true; };
  }, []);

  const k = overview?.kpis;

  const kpiCards: Array<{
    key: string; icon: any; label: string; value: number | undefined;
    color: string; bg: string; framework?: string; suffix?: string;
  }> = [
    { key: 'profile_analyses', icon: Sparkles, label: t('analytics.kpi.analyses'), value: k?.profile_analyses, color: '#0A8F84', bg: '#ECFDF5', framework: 'Harvard HBR' },
    { key: 'cvs_generated', icon: FileText, label: t('analytics.kpi.cvs'), value: k?.cvs_generated, color: '#C9922A', bg: '#FEF3C7', framework: 'STAR · Stanford' },
    { key: 'posts_generated', icon: TrendingUp, label: t('analytics.kpi.posts'), value: k?.posts_generated, color: '#3B82F6', bg: '#DBEAFE', framework: 'Kellogg' },
  ];

  const ranges: TimeRange[] = ['today', 'week', 'month', 'all'];

  const cardBase: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    padding: 20,
    border: '1px solid var(--wsl-border, #E5E7EB)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  };

  return (
    <DashboardLayout pageTitle={t('analytics.title', 'لوحة التحليلات')}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 4px', paddingBottom: 48 }}>

        {/* Header + Filter */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <h1 style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 30, color: 'var(--wsl-ink)', letterSpacing: '-0.5px', margin: 0 }}>
              {t('analytics.title', 'لوحة التحليلات')}
            </h1>
            <p style={{ marginTop: 6, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif', fontSize: 14 }}>
              {t('analytics.subtitle', 'تتبّع أداءك المهني بمعايير أكاديمية')}
            </p>
          </motion.div>

          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--wsl-surf-2, #F3F4F6)', width: 'fit-content', border: '1px solid var(--wsl-border, #E5E7EB)' }}>
            {ranges.map(r => {
              const active = range === r;
              return (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
                    border: 'none',
                    cursor: 'pointer',
                    background: active ? 'linear-gradient(135deg, #0A8F84, #12B5A8)' : 'transparent',
                    color: active ? '#fff' : 'var(--wsl-ink-3)',
                    fontFamily: 'Cairo, Inter, sans-serif',
                    fontWeight: 900,
                    fontSize: 12.5,
                    transition: 'all 150ms ease',
                  }}
                >
                  {t(`analytics.range.${r}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Token Balance Hero */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7 60%, #FFFFFF)',
            border: '1px solid #FDE68A',
            borderRadius: 18,
            padding: 22,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(217,119,6,0.08)',
          }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Coins size={16} style={{ color: '#B45309' }} />
              <span style={{ fontSize: 13, color: '#92400E', fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>
                {t('analytics.tokens.balance', 'رصيد التوكنات')}
              </span>
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, color: '#92400E', fontFamily: 'Inter', marginTop: 4, lineHeight: 1 }}>
              {(overview?.tokens?.balance ?? 0).toLocaleString('en-US')}
            </div>
            <div style={{ fontSize: 11, color: '#B45309', fontFamily: 'Cairo, sans-serif', marginTop: 6 }}>
              {t('analytics.tokens.usedTotal', { n: (overview?.tokens?.used_total ?? 0).toLocaleString('en-US') })}
            </div>
          </div>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #F59E0B, #C9922A)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(217,119,6,0.25)' }}>
            <Zap size={28} color="#fff" />
          </div>
        </motion.div>

        {/* KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
          {kpiCards.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div key={c.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                style={cardBase}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Icon size={18} style={{ color: c.color }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {c.label}
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--wsl-ink)', fontFamily: 'Inter', marginTop: 4, lineHeight: 1 }}>
                  {loadingOv ? (
                    <span style={{ display: 'inline-block', width: 50, height: 26, background: '#F3F4F6', borderRadius: 6 }} />
                  ) : (
                    <>
                      {(c.value ?? 0).toLocaleString('en-US')}
                      {c.suffix && <span style={{ fontSize: 16, color: 'var(--wsl-ink-3)', marginInlineStart: 4 }}>{c.suffix}</span>}
                    </>
                  )}
                </div>
                {c.framework && (
                  <div style={{ fontSize: 9.5, color: 'var(--wsl-ink-4, #94A3B8)', marginTop: 8, fontFamily: 'Inter', letterSpacing: 0.3 }}>
                    📚 {c.framework}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Activity Timeline */}
        <div style={{ ...cardBase, padding: 22, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 16, color: 'var(--wsl-ink)', margin: 0 }}>
              {t('analytics.activity.title', 'نشاطك خلال الفترة')}
            </h2>
            <span style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif' }}>
              {t('analytics.activity.last30', 'آخر 30 يوماً')}
            </span>
          </div>
          <div style={{ height: 280 }}>
            {loadingTs ? (
              <div style={{ width: '100%', height: '100%', background: '#F3F4F6', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', fontSize: 13 }}>
                {isRTL ? '...جاري التحميل' : 'Loading...'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activity} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748B"
                    fontSize={10}
                    reversed={isRTL}
                    tickFormatter={d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#64748B" fontSize={10} allowDecimals={false} orientation={isRTL ? 'right' : 'left'} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 4px 14px rgba(0,0,0,0.08)', fontFamily: 'Cairo, Inter, sans-serif', fontSize: 12 }}
                    labelFormatter={d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  />
                  <Legend wrapperStyle={{ fontFamily: 'Cairo, Inter, sans-serif', fontSize: 12 }} />
                  <Line type="monotone" dataKey="analyses" stroke="#0A8F84" strokeWidth={2.5} dot={{ r: 2 }} name={t('analytics.kpi.analyses')} />
                  <Line type="monotone" dataKey="cvs" stroke="#C9922A" strokeWidth={2.5} dot={{ r: 2 }} name={t('analytics.kpi.cvs')} />
                  <Line type="monotone" dataKey="posts" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 2 }} name={t('analytics.kpi.posts')} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Tokens Breakdown */}
        <div style={{ ...cardBase, padding: 22, marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 16, color: 'var(--wsl-ink)', margin: '0 0 14px' }}>
            {t('analytics.tokens.breakdown', 'استهلاك التوكنات حسب الميزة')}
          </h2>
          <div style={{ height: 260 }}>
            {tokensBd.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', fontSize: 13 }}>
                {t('analytics.empty.tokens', 'لا توجد معاملات في هذه الفترة')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tokensBd} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="feature" stroke="#64748B" fontSize={10} reversed={isRTL} />
                  <YAxis stroke="#64748B" fontSize={10} allowDecimals={false} orientation={isRTL ? 'right' : 'left'} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, fontFamily: 'Cairo, Inter, sans-serif', fontSize: 12 }} />
                  <Bar dataKey="total" fill="#C9922A" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Academic Note */}
        <div style={{
          background: 'linear-gradient(135deg, #ECFDF5, #FFFFFF)',
          border: '1px solid #A7F3D0',
          borderRadius: 14,
          padding: 16,
          fontSize: 13,
          color: '#065F46',
          fontFamily: 'Cairo, sans-serif',
          lineHeight: 1.6,
        }}>
          📚 {t('analytics.academicNote', 'التحليلات مبنية على إطار Career Capital من LBS، وإطار Cialdini للإقناع، ومعايير McKinsey MENA 2024 مع مواءمة رؤية 2030')}
        </div>
      </div>
    </DashboardLayout>
  );
}
