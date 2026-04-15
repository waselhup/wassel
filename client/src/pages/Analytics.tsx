import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BarChart2, FileText, Send, PenSquare, Coins, TrendingUp, Link } from 'lucide-react';

type PeriodTab = 'week' | 'month' | 'quarter';

interface Stats {
  analyses: number; cvs: number; campaigns: number;
  posts: number; tokensUsed: number; tokenBalance: number;
}

export default function Analytics() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isAr = i18n.language === 'ar';
  const [stats, setStats] = useState<Stats>({ analyses: 0, cvs: 0, campaigns: 0, posts: 0, tokensUsed: 0, tokenBalance: 0 });
  const [daily, setDaily] = useState<{ day: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PeriodTab>('month');

  useEffect(() => {
    if (!user?.id) return;
    void load(user.id);
  }, [user?.id, tab]);

  async function load(uid: string) {
    setLoading(true);
    try {
      const now = new Date();
      let since: Date;
      if (tab === 'week') { since = new Date(now.getTime() - 7 * 86400000); }
      else if (tab === 'month') { since = new Date(now.getFullYear(), now.getMonth(), 1); }
      else { since = new Date(now.getTime() - 90 * 86400000); }
      const sinceIso = since.toISOString();

      const safeCount = async (table: string, extra?: Record<string, string>) => {
        try {
          let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('created_at', sinceIso);
          if (extra) { for (const [k, v] of Object.entries(extra)) q = q.eq(k, v); }
          const { count } = await q;
          return count || 0;
        } catch { return 0; }
      };

      const [an, cv, ca, po] = await Promise.all([
        safeCount('linkedin_analyses'),
        safeCount('cv_documents'),
        safeCount('campaigns'),
        safeCount('posts'),
      ]);

      let tokensUsed = 0;
      let tokenBalance = 0;
      try {
        const { data: txs } = await supabase.from('token_transactions').select('amount').eq('user_id', uid);
        tokensUsed = (txs || []).filter((r: any) => r.amount < 0).reduce((s: number, r: any) => s + Math.abs(r.amount), 0);
      } catch { /* noop */ }
      try {
        const { data: prof } = await supabase.from('profiles').select('token_balance').eq('id', uid).single();
        tokenBalance = prof?.token_balance ?? 0;
      } catch { /* noop */ }

      setStats({ analyses: an, cvs: cv, campaigns: ca, posts: po, tokensUsed, tokenBalance });

      // Daily activity (last 7 days from linkedin_analyses)
      const days: { day: string; count: number }[] = [];
      for (let d = 6; d >= 0; d--) {
        const dt = new Date(now.getTime() - d * 86400000);
        const nextDt = new Date(dt.getTime() + 86400000);
        try {
          const { count } = await supabase.from('linkedin_analyses').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('created_at', dt.toISOString()).lt('created_at', nextDt.toISOString());
          days.push({ day: dt.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'short' }), count: count || 0 });
        } catch { days.push({ day: '?', count: 0 }); }
      }
      setDaily(days);
    } catch { /* noop */ }
    setLoading(false);
  }

  const hasData = stats.analyses + stats.cvs + stats.campaigns + stats.posts > 0;
  const maxDaily = Math.max(...daily.map(d => d.count), 1);

  const statCards = [
    { label: t('analytics.stats.analyses', 'تحليلات LinkedIn'), value: stats.analyses, icon: BarChart2, color: '#8B5CF6', bg: '#F5F3FF' },
    { label: t('analytics.stats.cvs', 'سير مُنشأة'), value: stats.cvs, icon: FileText, color: '#059669', bg: '#ECFDF5' },
    { label: t('analytics.stats.campaigns', 'حملات'), value: stats.campaigns, icon: Send, color: '#0077B5', bg: '#EFF6FF' },
    { label: t('analytics.stats.posts', 'منشورات'), value: stats.posts, icon: PenSquare, color: '#0A8F84', bg: '#F0FDF9' },
  ];

  const tabs: { id: PeriodTab; ar: string; en: string }[] = [
    { id: 'week', ar: 'هذا الأسبوع', en: 'This Week' },
    { id: 'month', ar: 'هذا الشهر', en: 'This Month' },
    { id: 'quarter', ar: 'آخر 90 يوم', en: 'Last 90 Days' },
  ];

  return (
    <DashboardLayout pageTitle={t('analytics.title', 'تحليلاتك')}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 30, color: 'var(--wsl-ink)', letterSpacing: '-0.5px', margin: 0 }}>
            {t('analytics.title', 'تحليلاتك')}
          </h1>
          <p style={{ marginTop: 6, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif', fontSize: 14 }}>
            {t('analytics.subtitle', 'نظرة شاملة على نشاطك في وصّل')}
          </p>
        </motion.div>

        {/* Period Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--wsl-surf-2, #F3F4F6)', marginBottom: 24, width: 'fit-content' }}>
          {tabs.map(tb => {
            const active = tab === tb.id;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                style={{ padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? 'var(--wsl-ink)' : 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 13, boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none', transition: 'all 150ms ease' }}>
                {isAr ? tb.ar : tb.en}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '4px solid var(--wsl-border, #E5E7EB)', borderTopColor: 'var(--wsl-teal, #0A8F84)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : !hasData ? (
          /* Empty State */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: '#fff', border: '2px dashed var(--wsl-border, #E5E7EB)', borderRadius: 16, padding: '60px 24px', textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, margin: '0 auto 18px', background: 'linear-gradient(135deg, rgba(10,143,132,0.1), rgba(14,165,233,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={32} color="#0A8F84" />
            </div>
            <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink)', marginBottom: 8 }}>
              {t('analytics.empty', 'ابدأ باستخدام وصّل لتظهر تحليلاتك هنا')}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
              <a href="/app/profile-analysis" style={{ padding: '9px 16px', borderRadius: 9, background: 'linear-gradient(135deg, #0A8F84, #0ea5e9)', color: '#fff', textDecoration: 'none', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 13 }}>
                {isAr ? 'تحليل ملفك' : 'Analyze Profile'}
              </a>
              <a href="/app/campaigns/new" style={{ padding: '9px 16px', borderRadius: 9, background: '#F3F4F6', color: 'var(--wsl-ink)', textDecoration: 'none', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 13 }}>
                {isAr ? 'حملة جديدة' : 'New Campaign'}
              </a>
            </div>
          </motion.div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              {statCards.map((c, i) => (
                <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid var(--wsl-border, #E5E7EB)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <c.icon size={20} style={{ color: c.color }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--wsl-ink)', fontFamily: 'Inter' }}>{c.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--wsl-ink-3)', marginTop: 4, fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>{c.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Token Usage Card */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid var(--wsl-border, #E5E7EB)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Coins size={16} style={{ color: '#D97706' }} />
                  <span style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 13, color: 'var(--wsl-ink-2)' }}>{t('analytics.stats.tokens', 'توكن مُستخدم')}</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#D97706', fontFamily: 'Inter' }}>{stats.tokensUsed.toLocaleString('en-US')}</div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Coins size={16} style={{ color: '#0A8F84' }} />
                  <span style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 13, color: 'var(--wsl-ink-2)' }}>{isAr ? 'الرصيد المتبقي' : 'Remaining Balance'}</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#0A8F84', fontFamily: 'Inter' }}>{stats.tokenBalance.toLocaleString('en-US')}</div>
              </div>
            </div>

            {/* Daily Activity Chart */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid var(--wsl-border, #E5E7EB)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 15, color: 'var(--wsl-ink)', marginBottom: 20 }}>
                {isAr ? 'نشاط آخر 7 أيام (تحليلا֪)' : 'Last 7 Days Activity (Analyses)'}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120 }}>
                {daily.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--wsl-ink-2)', fontFamily: 'Inter' }}>{d.count}</span>
                    <div style={{ width: '100%', borderRadius: '4px 4px 0 0', background: d.count > 0 ? 'linear-gradient(180deg, #0A8F84, #12B5A8)' : '#F3F4F6', minHeight: 4, height: Math.max(4, (d.count / maxDaily) * 80), transition: 'height 0.6s ease' }} />
                    <span style={{ fontSize: 10, color: 'var(--wsl-ink-4)', fontFamily: 'Cairo, sans-serif' }}>{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </DashboardLayout>
  );
}
