import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';
import { Users, UserPlus, Send, BarChart2 } from 'lucide-react';

interface Stats { totalUsers: number; newUsersWeek: number; activeCampaigns: number; totalAnalyses: number; tokenTotal: number; tokenCount: number; }
interface ActivityLog { id: string; type: string; description: string; created_at: string; }
interface DailyCount { day: string; count: number; }

export default function Analytics() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, newUsersWeek: 0, activeCampaigns: 0, totalAnalyses: 0, tokenTotal: 0, tokenCount: 0 });
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [daily, setDaily] = useState<DailyCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [usersR, newR, activeR, analysesR, tokensR, actR] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
          supabase.from('campaigns').select('id', { count: 'exact', head: true }).in('status', ['active', 'running']),
          supabase.from('linkedin_analyses').select('id', { count: 'exact', head: true }),
          supabase.from('token_transactions').select('amount'),
          supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10),
        ]);
        setStats({
          totalUsers: usersR.count || 0, newUsersWeek: newR.count || 0,
          activeCampaigns: activeR.count || 0, totalAnalyses: analysesR.count || 0,
          tokenTotal: (tokensR.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0),
          tokenCount: (tokensR.data || []).length,
        });
        setActivity((actR.data || []) as ActivityLog[]);
        const days: DailyCount[] = [];
        for (let d = 6; d >= 0; d--) {
          const date = new Date(Date.now() - d * 86400000);
          const dayStr = date.toISOString().slice(0, 10);
          const nextDay = new Date(date.getTime() + 86400000).toISOString().slice(0, 10);
          const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', dayStr).lt('created_at', nextDay);
          days.push({ day: date.toLocaleDateString('ar-SA', { weekday: 'short' }), count: count || 0 });
        }
        setDaily(days);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  const maxDaily = Math.max(...daily.map(d => d.count), 1);
  const cards = [
    { label: '\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646 \u0643\u0644\u064a', value: stats.totalUsers, icon: Users, color: 'var(--wsl-teal)' },
    { label: '\u062c\u062f\u062f \u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639', value: stats.newUsersWeek, icon: UserPlus, color: '#10b981' },
    { label: '\u062d\u0645\u0644\u0627\u062a \u0646\u0634\u0637\u0629', value: stats.activeCampaigns, icon: Send, color: 'var(--wsl-gold)' },
    { label: '\u062a\u062d\u0644\u064a\u0644\u0627\u062a LinkedIn', value: stats.totalAnalyses, icon: BarChart2, color: '#8b5cf6' },
  ];

  return (
    <DashboardLayout pageTitle={t('nav.analytics', '\u0627\u0644\u062a\u062d\u0644\u064a\u0644\u0627\u062a')}>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--wsl-border)', borderTopColor: 'var(--wsl-teal)' }} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c, i) => (
              <div key={i} className="rounded-2xl bg-white p-5 shadow-sm border" style={{ borderColor: 'var(--wsl-border)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.color + '18' }}>
                    <c.icon size={20} style={{ color: c.color }} />
                  </div>
                </div>
                <div className="text-3xl font-extrabold" style={{ color: 'var(--wsl-ink)', fontFamily: 'Inter, sans-serif' }}>{c.value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Daily Chart */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border" style={{ borderColor: 'var(--wsl-border)' }}>
            <h3 className="text-base font-extrabold mb-4" style={{ color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif' }}>
              {t('analytics.newUsersChart', '\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646 \u062c\u062f\u062f \u0622\u062e\u0631 7 \u0623\u064a\u0627\u0645')}
            </h3>
            <div className="flex items-end gap-3" style={{ height: '160px' }}>
              {daily.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold" style={{ color: 'var(--wsl-ink-2)', fontFamily: 'Inter' }}>{d.count}</span>
                  <div className="w-full rounded-t-lg transition-all" style={{ height: Math.max(4, d.count / maxDaily * 120) + 'px', background: 'var(--wsl-teal)', opacity: 0.8 + (d.count / maxDaily) * 0.2 }} />
                  <span className="text-[10px] font-bold" style={{ color: 'var(--wsl-ink-4)', fontFamily: 'Cairo' }}>{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Token Summary */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border" style={{ borderColor: 'var(--wsl-border)' }}>
            <h3 className="text-base font-extrabold mb-3" style={{ color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif' }}>
              {t('analytics.tokenSummary', '\u0645\u0644\u062e\u0635 \u0627\u0644\u062a\u0648\u0643\u0646\u0627\u062a')}
            </h3>
            <div className="flex gap-8">
              <div>
                <div className="text-2xl font-extrabold" style={{ color: 'var(--wsl-teal)', fontFamily: 'Inter' }}>{stats.tokenCount}</div>
                <div className="text-xs" style={{ color: 'var(--wsl-ink-3)', fontFamily: 'Cairo', fontWeight: 700 }}>{t('analytics.transactions', '\u0639\u0645\u0644\u064a\u0629')}</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold" style={{ color: 'var(--wsl-gold)', fontFamily: 'Inter' }}>{stats.tokenTotal}</div>
                <div className="text-xs" style={{ color: 'var(--wsl-ink-3)', fontFamily: 'Cairo', fontWeight: 700 }}>{t('analytics.totalTokens', '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062a\u0648\u0643\u0646\u0627\u062a')}</div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border" style={{ borderColor: 'var(--wsl-border)' }}>
            <h3 className="text-base font-extrabold mb-4" style={{ color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif' }}>
              {t('analytics.recentActivity', '\u0627\u0644\u0646\u0634\u0627\u0637 \u0627\u0644\u0623\u062e\u064a\u0631')}
            </h3>
            {activity.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--wsl-ink-4)' }}>{t('analytics.noActivity', '\u0644\u0627 \u064a\u0648\u062c\u062f \u0646\u0634\u0627\u0637 \u062d\u062a\u0649 \u0627\u0644\u0622\u0646')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--wsl-border)' }}>
                      <th className="py-2 text-start font-bold" style={{ color: 'var(--wsl-ink-2)' }}>{t('analytics.type', '\u0627\u0644\u0646\u0648\u0639')}</th>
                      <th className="py-2 text-start font-bold" style={{ color: 'var(--wsl-ink-2)' }}>{t('analytics.description', '\u0627\u0644\u0648\u0635\u0641')}</th>
                      <th className="py-2 text-start font-bold" style={{ color: 'var(--wsl-ink-2)' }}>{t('analytics.time', '\u0627\u0644\u0648\u0642\u062a')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((a) => (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--wsl-border)' }}>
                        <td className="py-2 font-semibold" style={{ color: 'var(--wsl-teal)' }}>{a.type}</td>
                        <td className="py-2" style={{ color: 'var(--wsl-ink-2)' }}>{a.description}</td>
                        <td className="py-2 text-xs" style={{ color: 'var(--wsl-ink-4)', fontFamily: 'Inter' }}>{new Date(a.created_at).toLocaleString('ar-SA')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
