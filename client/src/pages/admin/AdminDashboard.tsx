import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Shield, Users, Activity, AlertTriangle, Star, CheckCircle2,
  XCircle, Loader2, Search, Coins, BarChart3, MessageSquare,
  Send, RefreshCw, Ban, TicketCheck, MessageSquarePlus, Bot, Building2, Zap,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';
import AdminAgents from './AdminAgents';
import AdminCompanies from './AdminCompanies';
import AdminExecutorAgents from './AdminExecutorAgents';
import ErrorBoundary from '@/components/ErrorBoundary';

type Tab = 'overview' | 'users' | 'reviews' | 'alerts' | 'campaigns' | 'companies' | 'tokens' | 'tickets' | 'agents' | 'executor';

interface Toast { id: number; type: 'success' | 'error'; message: string }

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (type: Toast['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };
  const View = () => (
    <div style={{ position: 'fixed', top: 20, insetInlineEnd: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}
            style={{ padding: '12px 18px', borderRadius: 12, minWidth: 260, background: t.type === 'success' ? '#ECFDF5' : '#FEF2F2', color: t.type === 'success' ? '#065F46' : '#991B1B', border: `1px solid ${t.type === 'success' ? '#A7F3D0' : '#FECACA'}`, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
            {t.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { push, View };
}

export default function AdminDashboard() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const isAr = i18n.language === 'ar';
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackTickets, setFeedbackTickets] = useState<any[]>([]);
  const [ticketFilter, setTicketFilter] = useState<string>('all');
  const [respondModal, setRespondModal] = useState<any | null>(null);
  const [respondText, setRespondText] = useState('');
  const [addTokensModal, setAddTokensModal] = useState<{ userId: string; name: string } | null>(null);
  const [tokenAmount, setTokenAmount] = useState(100);
  const [tokenReason, setTokenReason] = useState('');

  const ADMIN_EMAILS = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];
  const isAdmin = ADMIN_EMAILS.includes(user?.email || '');

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  async function loadData() {
    setLoading(true);
    try {
      const [statsRes, statusRes, usersRes, reviewsRes, campaignsRes, ticketsRes] = await Promise.allSettled([
        trpc.admin.stats(),
        trpc.admin.systemStatus(),
        trpc.admin.users(),
        trpc.reviews.listPending(),
        trpc.admin.campaigns(),
        trpc.feedback.listAll(),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (statusRes.status === 'fulfilled') setSystemStatus(statusRes.value);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value || []);
      if (reviewsRes.status === 'fulfilled') setPendingReviews(reviewsRes.value || []);
      if (campaignsRes.status === 'fulfilled') setCampaigns(campaignsRes.value || []);
      if (ticketsRes.status === 'fulfilled') setFeedbackTickets(ticketsRes.value || []);
    } catch (e) {
      console.error('[Admin] Load error:', e);
    }
    setLoading(false);
  }

  async function handleApproveReview(id: string) {
    try {
      await trpc.reviews.approve({ id });
      toast.push('success', isAr ? 'تم قبول المراجعة' : 'Review approved');
      setPendingReviews(prev => prev.filter(r => r.id !== id));
    } catch (e: any) { toast.push('error', e?.message || 'Failed'); }
  }

  async function handleRejectReview(id: string) {
    try {
      await trpc.reviews.reject({ id });
      toast.push('success', isAr ? 'تم رفض المراجعة' : 'Review rejected');
      setPendingReviews(prev => prev.filter(r => r.id !== id));
    } catch (e: any) { toast.push('error', e?.message || 'Failed'); }
  }

  async function handleToggleBan(userId: string) {
    try {
      const res = await trpc.admin.toggleBan({ userId });
      toast.push('success', res.banned ? (isAr ? 'تم حظر المستخدم' : 'User banned') : (isAr ? 'تم إلغاء الحظر' : 'User unbanned'));
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: res.banned } : u));
    } catch (e: any) { toast.push('error', e?.message || 'Failed'); }
  }

  async function handleAddTokens() {
    if (!addTokensModal) return;
    try {
      await trpc.admin.addTokens({ userId: addTokensModal.userId, amount: tokenAmount, reason: tokenReason || 'Admin grant' });
      toast.push('success', isAr ? `تمت إضافة ${tokenAmount} توكن` : `Added ${tokenAmount} tokens`);
      setAddTokensModal(null); setTokenAmount(100); setTokenReason('');
      loadData();
    } catch (e: any) { toast.push('error', e?.message || 'Failed'); }
  }

  if (!isAdmin) {
    return (
      <DashboardLayout pageTitle={isAr ? 'لوحة الإدارة' : 'Admin Dashboard'}>
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Shield size={48} style={{ color: '#DC2626', margin: '0 auto 16px' }} />
          <div style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 20, color: '#DC2626' }}>
            {isAr ? 'غير مصرّح' : 'Unauthorized'}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const tabs: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: 'overview', label: isAr ? 'نظرة عامة' : 'Overview', icon: BarChart3 },
    { id: 'users', label: isAr ? 'المستخدمين' : 'Users', icon: Users, count: users.length },
    { id: 'reviews', label: isAr ? 'المراجعات' : 'Reviews', icon: Star, count: pendingReviews.length },
    { id: 'alerts', label: isAr ? 'التنبيهات' : 'Alerts', icon: AlertTriangle, count: systemStatus?.recentErrors?.length || 0 },
    { id: 'campaigns', label: isAr ? 'الحملات' : 'Campaigns', icon: Send, count: campaigns.length },
    { id: 'companies', label: isAr ? 'الشركات' : 'Companies', icon: Building2 },
    { id: 'tokens', label: isAr ? 'التوكنز' : 'Tokens', icon: Coins },
    { id: 'tickets', label: isAr ? 'الملاحظات' : 'Tickets', icon: TicketCheck, count: feedbackTickets.filter(t => t.status === 'open').length },
    { id: 'agents', label: isAr ? 'الوكلاء' : 'Agents', icon: Bot },
    { id: 'executor', label: isAr ? 'الوكلاء التنفيذيين' : 'Executor Agents', icon: Zap },
  ];

  const filteredUsers = searchQuery
    ? users.filter(u => (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) || (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : users;

  const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'start', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '10px 14px', fontFamily: 'Cairo, Inter, sans-serif', fontSize: 13 };

  return (
    <DashboardLayout pageTitle={isAr ? 'لوحة الإدارة' : 'Admin Dashboard'}>
      <toast.View />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 4px' }}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 28, color: 'var(--wsl-ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #DC2626, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} color="#fff" />
            </div>
            {isAr ? 'لوحة الإدارة' : 'Admin Dashboard'}
          </h1>
          <button onClick={loadData} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1px solid var(--wsl-border, #E5E7EB)', background: '#fff', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 13, color: 'var(--wsl-ink-2)' }}>
            <RefreshCw size={14} /> {isAr ? 'تحديث' : 'Refresh'}
          </button>
        </motion.div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--wsl-surf-2, #F3F4F6)', marginBottom: 20, overflowX: 'auto' }}>
          {tabs.map(tb => {
            const active = tab === tb.id;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                style={{ flex: 1, minWidth: 90, padding: '9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? 'var(--wsl-ink)' : 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 12, boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 150ms ease', whiteSpace: 'nowrap' }}>
                <tb.icon size={13} />
                {tb.label}
                {(tb.count || 0) > 0 && (
                  <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 900, background: active ? '#FEE2E2' : 'rgba(0,0,0,0.06)', color: active ? '#DC2626' : 'var(--wsl-ink-3)' }}>{tb.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><Loader2 size={32} style={{ color: '#0A8F84', animation: 'spin 1s linear infinite' }} /></div>
        ) : (
          <>
            {tab === 'overview' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {[
                    { label: isAr ? 'المستخدمين' : 'Users', value: stats?.totalUsers || 0, icon: Users, color: '#0A8F84' },
                    { label: isAr ? 'الإيراد الشهري' : 'MRR', value: `${stats?.mrr || 0} SAR`, icon: Coins, color: '#D97706' },
                    { label: isAr ? 'الحملات' : 'Campaigns', value: stats?.totalCampaigns || 0, icon: Send, color: '#7C3AED' },
                    { label: isAr ? 'الرسائل' : 'Emails', value: stats?.emailsSent || 0, icon: MessageSquare, color: '#2563EB' },
                    { label: isAr ? 'مراجعات معلقة' : 'Pending', value: pendingReviews.length, icon: Star, color: '#DC2626' },
                    { label: isAr ? 'نشط' : 'Active', value: stats?.activeUsers || 0, icon: Activity, color: '#059669' },
                  ].map((s, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--wsl-border, #E5E7EB)', padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif' }}>{s.label}</span>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: s.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <s.icon size={14} style={{ color: s.color }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--wsl-ink)', fontFamily: 'Inter' }}>{s.value}</div>
                    </motion.div>
                  ))}
                </div>

                {/* System Status */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--wsl-border, #E5E7EB)', padding: 20, marginBottom: 20 }}>
                  <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 16, color: 'var(--wsl-ink)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={16} style={{ color: '#0A8F84' }} /> {isAr ? 'حالة الخدمات' : 'Service Status'}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                    {Object.entries(systemStatus?.stats || {}).map(([service, data]: [string, any]) => {
                      const errorRate = data.total > 0 ? (data.errors / data.total) * 100 : 0;
                      const statusColor = errorRate > 20 ? '#DC2626' : errorRate > 5 ? '#D97706' : '#059669';
                      return (
                        <div key={service} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--wsl-border, #E5E7EB)', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--wsl-ink)', fontFamily: 'Inter', textTransform: 'capitalize' }}>{service}</div>
                            <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)' }}>{data.total} calls · {data.errors} errors</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(systemStatus?.recentErrors || []).length > 0 && (
                  <div style={{ background: '#FEF2F2', borderRadius: 14, border: '1px solid #FECACA', padding: 20 }}>
                    <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 16, color: '#991B1B', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle size={16} /> {isAr ? 'أخطاء حديثة' : 'Recent Errors'}
                    </h3>
                    {(systemStatus.recentErrors || []).slice(0, 8).map((err: any, i: number) => (
                      <div key={i} style={{ padding: 10, borderRadius: 8, background: '#fff', border: '1px solid #FECACA', fontSize: 12, fontFamily: 'Inter', marginBottom: 6 }}>
                        <strong style={{ color: '#DC2626' }}>{err.service}</strong> <span style={{ color: '#6B7280' }}>{err.endpoint}</span> <span style={{ color: '#991B1B' }}>{err.status_code}</span>
                        <div style={{ color: '#6B7280', marginTop: 2, fontSize: 11 }}>{(err.error_msg || '').substring(0, 100)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'users' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ marginBottom: 16, position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', top: '50%', insetInlineStart: 12, transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder={isAr ? 'بحث بالبريد أو الاسم...' : 'Search by email or name...'}
                    style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1.5px solid var(--wsl-border)', fontFamily: 'Cairo, Inter, sans-serif', fontSize: 13, outline: 'none', background: '#F9FAFB', boxSizing: 'border-box' }} />
                </div>
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--wsl-border)', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB', borderBottom: '1px solid var(--wsl-border)' }}>
                        <th style={thStyle}>{isAr ? 'المستخدم' : 'User'}</th>
                        <th style={thStyle}>{isAr ? 'الباقة' : 'Plan'}</th>
                        <th style={thStyle}>{isAr ? 'التوكنز' : 'Tokens'}</th>
                        <th style={thStyle}>{isAr ? 'الحالة' : 'Status'}</th>
                        <th style={thStyle}>{isAr ? 'تاريخ' : 'Joined'}</th>
                        <th style={thStyle}>{isAr ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--wsl-border)' }}>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 800 }}>{u.full_name || '-'}</div>
                            <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', direction: 'ltr' }}>{u.email}</div>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ padding: '2px 8px', borderRadius: 999, background: u.plan === 'pro' ? '#D1FAE5' : '#F3F4F6', color: u.plan === 'pro' ? '#065F46' : '#6B7280', fontSize: 11, fontWeight: 800 }}>{u.plan || 'free'}</span>
                          </td>
                          <td style={tdStyle}><span style={{ fontWeight: 900, color: '#0A8F84', fontFamily: 'Inter' }}>{u.token_balance || 0}</span></td>
                          <td style={tdStyle}>
                            {u.is_admin && <span style={{ padding: '2px 6px', borderRadius: 999, background: '#EDE9FE', color: '#7C3AED', fontSize: 10, fontWeight: 800, marginInlineEnd: 4 }}>Admin</span>}
                            {u.is_banned && <span style={{ padding: '2px 6px', borderRadius: 999, background: '#FEE2E2', color: '#DC2626', fontSize: 10, fontWeight: 800 }}>Banned</span>}
                            {!u.is_admin && !u.is_banned && <span style={{ color: '#059669', fontSize: 11, fontWeight: 800 }}>Active</span>}
                          </td>
                          <td style={tdStyle}><span style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Inter' }}>{new Date(u.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span></td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => setAddTokensModal({ userId: u.id, name: u.full_name || u.email })} title="Add tokens"
                                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #D1FAE5', background: '#ECFDF5', color: '#065F46', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Coins size={12} /></button>
                              <button onClick={() => handleToggleBan(u.id)} title={u.is_banned ? 'Unban' : 'Ban'}
                                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #FECACA', background: u.is_banned ? '#ECFDF5' : '#FEF2F2', color: u.is_banned ? '#065F46' : '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Ban size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {tab === 'reviews' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {pendingReviews.length === 0 ? (
                  <div style={{ background: '#fff', borderRadius: 14, border: '2px dashed var(--wsl-border)', padding: '60px 24px', textAlign: 'center' }}>
                    <Star size={32} style={{ color: '#D97706', margin: '0 auto 12px' }} />
                    <div style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 16 }}>{isAr ? 'لا توجد مراجعات معلقة' : 'No Pending Reviews'}</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {pendingReviews.map(r => (
                      <div key={r.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--wsl-border)', padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div>
                            <span style={{ fontWeight: 800, fontFamily: 'Cairo, sans-serif', fontSize: 14 }}>{r.user_name || r.user_email || 'Unknown'}</span>
                            <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                              {[1, 2, 3, 4, 5].map(s => (
                                <Star key={s} size={14} style={{ color: s <= r.rating ? '#D97706' : '#E5E7EB', fill: s <= r.rating ? '#D97706' : 'none' }} />
                              ))}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Inter' }}>{new Date(r.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--wsl-ink-2)', lineHeight: 1.7, fontFamily: 'Cairo, Inter, sans-serif', marginBottom: 14 }}>{r.comment}</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleApproveReview(r.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>
                            <CheckCircle2 size={14} /> {isAr ? 'قبول' : 'Approve'}
                          </button>
                          <button onClick={() => handleRejectReview(r.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>
                            <XCircle size={14} /> {isAr ? 'رفض' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'alerts' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {(systemStatus?.recentErrors || []).length === 0 ? (
                  <div style={{ background: '#ECFDF5', borderRadius: 14, border: '1px solid #A7F3D0', padding: '40px 24px', textAlign: 'center' }}>
                    <CheckCircle2 size={32} style={{ color: '#059669', margin: '0 auto 12px' }} />
                    <div style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 16, color: '#065F46' }}>{isAr ? 'لا توجد أخطاء حديثة' : 'All Clear'}</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(systemStatus.recentErrors || []).map((err: any, i: number) => (
                      <div key={i} style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--wsl-border)', padding: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <AlertTriangle size={16} style={{ color: err.status_code >= 500 ? '#DC2626' : '#D97706', flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: 13, color: 'var(--wsl-ink)', textTransform: 'capitalize' as const }}>{err.service}</strong>
                          <span style={{ padding: '1px 6px', borderRadius: 4, background: err.status_code >= 500 ? '#FEE2E2' : '#FEF3C7', color: err.status_code >= 500 ? '#DC2626' : '#92400E', fontSize: 11, fontWeight: 800, marginInlineStart: 6 }}>{err.status_code}</span>
                          <span style={{ fontSize: 11, color: 'var(--wsl-ink-3)', marginInlineStart: 6 }}>{err.endpoint}</span>
                          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{(err.error_msg || '').substring(0, 200)}</div>
                          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{new Date(err.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'campaigns' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--wsl-border)', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB', borderBottom: '1px solid var(--wsl-border)' }}>
                        <th style={thStyle}>{isAr ? 'الحملة' : 'Campaign'}</th>
                        <th style={thStyle}>{isAr ? 'المستخدم' : 'User'}</th>
                        <th style={thStyle}>{isAr ? 'الحالة' : 'Status'}</th>
                        <th style={thStyle}>{isAr ? 'المستلمين' : 'Recipients'}</th>
                        <th style={thStyle}>{isAr ? 'التاريخ' : 'Date'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.slice(0, 20).map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--wsl-border)' }}>
                          <td style={tdStyle}><span style={{ fontWeight: 800 }}>{c.campaign_name || '-'}</span></td>
                          <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--wsl-ink-3)' }}>{c.profiles?.full_name || c.profiles?.email || '-'}</span></td>
                          <td style={tdStyle}>
                            <span style={{ padding: '2px 8px', borderRadius: 999, background: c.status === 'completed' ? '#D1FAE5' : '#F3F4F6', color: c.status === 'completed' ? '#065F46' : '#6B7280', fontSize: 11, fontWeight: 800 }}>{c.status}</span>
                          </td>
                          <td style={tdStyle}>{c.total_recipients || 0}</td>
                          <td style={tdStyle}><span style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Inter' }}>{new Date(c.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {tab === 'tokens' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--wsl-border)', padding: 20, marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', marginBottom: 6 }}>{isAr ? 'إجمالي التوكنز المشتراة' : 'Total Tokens Purchased'}</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#0A8F84', fontFamily: 'Inter' }}>{(stats?.tokensPurchased || 0).toLocaleString('en-US')}</div>
                </div>
                <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 16, marginBottom: 12 }}>{isAr ? 'أعلى المستخدمين' : 'Top Users by Balance'}</h3>
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--wsl-border)', overflow: 'hidden' }}>
                  {[...users].sort((a, b) => (b.token_balance || 0) - (a.token_balance || 0)).slice(0, 10).map((u, i) => (
                    <div key={u.id} style={{ padding: '12px 16px', borderBottom: i < 9 ? '1px solid var(--wsl-border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 800, fontSize: 13, fontFamily: 'Cairo, sans-serif' }}>{u.full_name || u.email} <span style={{ fontSize: 11, color: 'var(--wsl-ink-3)' }}>({u.plan || 'free'})</span></span>
                      <span style={{ fontWeight: 900, fontSize: 16, color: '#0A8F84', fontFamily: 'Inter' }}>{(u.token_balance || 0).toLocaleString('en-US')}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {tab === 'tickets' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {['all', 'open', 'in_progress', 'resolved', 'closed'].map(f => (
                    <button key={f} onClick={() => setTicketFilter(f)}
                      style={{ padding: '6px 14px', borderRadius: 8, border: ticketFilter === f ? '1.5px solid #0A8F84' : '1.5px solid var(--wsl-border)', background: ticketFilter === f ? 'rgba(10,143,132,0.07)' : '#fff', color: ticketFilter === f ? '#0A8F84' : '#6B7280', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>
                      {f === 'all' ? (isAr ? 'الكل' : 'All') : f === 'open' ? (isAr ? 'مفتوحة' : 'Open') : f === 'in_progress' ? (isAr ? 'قيد المعالجة' : 'In Progress') : f === 'resolved' ? (isAr ? 'تم الحل' : 'Resolved') : (isAr ? 'مغلقة' : 'Closed')}
                    </button>
                  ))}
                </div>
                {feedbackTickets.filter(t => ticketFilter === 'all' || t.status === ticketFilter).length === 0 ? (
                  <div style={{ background: '#fff', borderRadius: 14, border: '2px dashed var(--wsl-border)', padding: '40px 24px', textAlign: 'center' }}>
                    <TicketCheck size={32} style={{ color: '#059669', margin: '0 auto 12px' }} />
                    <div style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 16, color: '#065F46' }}>{isAr ? 'لا توجد ملاحظات' : 'No Tickets'}</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {feedbackTickets.filter(t => ticketFilter === 'all' || t.status === ticketFilter).map(t => {
                      const stColors: Record<string, string> = { open: '#FEF3C7', in_progress: '#DBEAFE', resolved: '#D1FAE5', closed: '#F3F4F6' };
                      const stTextColors: Record<string, string> = { open: '#92400E', in_progress: '#1E40AF', resolved: '#065F46', closed: '#6B7280' };
                      return (
                        <div key={t.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--wsl-border)', padding: 18 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ padding: '2px 8px', borderRadius: 999, background: stColors[t.status] || '#F3F4F6', color: stTextColors[t.status] || '#6B7280', fontSize: 10, fontWeight: 900 }}>{t.status}</span>
                              <span style={{ padding: '2px 6px', borderRadius: 4, background: '#F3F4F6', color: '#6B7280', fontSize: 10, fontWeight: 800 }}>{t.category}</span>
                              {t.priority === 'urgent' && <span style={{ padding: '2px 6px', borderRadius: 4, background: '#FEE2E2', color: '#DC2626', fontSize: 10, fontWeight: 900 }}>URGENT</span>}
                              {t.priority === 'high' && <span style={{ padding: '2px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', fontSize: 10, fontWeight: 900 }}>HIGH</span>}
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--wsl-ink-4)', fontFamily: 'Inter' }}>{new Date(t.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                          </div>
                          <h4 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 15, color: 'var(--wsl-ink)', marginBottom: 4 }}>{t.subject}</h4>
                          <p style={{ fontSize: 13, color: 'var(--wsl-ink-2)', lineHeight: 1.6, marginBottom: 8, fontFamily: 'Cairo, Inter, sans-serif' }}>{t.description.substring(0, 200)}{t.description.length > 200 ? '...' : ''}</p>
                          <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', marginBottom: 10 }}>
                            {isAr ? 'من:' : 'From:'} <strong>{t.user?.full_name || t.user?.email || 'Unknown'}</strong>
                            {t.page_url && <span style={{ marginInlineStart: 8 }}>({t.page_url})</span>}
                          </div>
                          {t.admin_response && (
                            <div style={{ padding: 10, borderRadius: 8, background: '#F0FDF9', border: '1px solid #A7F3D0', marginBottom: 8 }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: '#065F46', marginBottom: 2 }}>{isAr ? 'الرد:' : 'Response:'}</div>
                              <div style={{ fontSize: 12, color: '#065F46' }}>{t.admin_response}</div>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => { setRespondModal(t); setRespondText(t.admin_response || ''); }}
                              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #D1FAE5', background: '#ECFDF5', color: '#065F46', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MessageSquarePlus size={12} /> {isAr ? 'رد' : 'Respond'}
                            </button>
                            {['open', 'in_progress', 'resolved', 'closed'].filter(s => s !== t.status).map(s => (
                              <button key={s} onClick={async () => {
                                try { await trpc.feedback.updateStatus({ id: t.id, status: s }); toast.push('success', 'Updated'); loadData(); } catch (e: any) { toast.push('error', e?.message || 'Failed'); }
                              }} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--wsl-border)', background: '#fff', color: '#6B7280', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'agents' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AdminAgents />
              </motion.div>
            )}

            {tab === 'companies' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AdminCompanies />
              </motion.div>
            )}

            {tab === 'executor' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ErrorBoundary fallbackTitle={isAr ? 'خطأ في الوكلاء التنفيذيين' : 'Executor agents error'}>
                  <AdminExecutorAgents />
                </ErrorBoundary>
              </motion.div>
            )}
          </>
        )}

        {/* Respond Modal */}
        {respondModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setRespondModal(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 18, marginBottom: 8 }}>{isAr ? 'الرد على الملاحظة' : 'Respond to Ticket'}</h3>
              <p style={{ fontSize: 13, color: 'var(--wsl-ink-3)', marginBottom: 16, fontWeight: 800 }}>{respondModal.subject}</p>
              <textarea value={respondText} onChange={e => setRespondText(e.target.value)} rows={4}
                placeholder={isAr ? 'اكتب ردك...' : 'Write your response...'}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--wsl-border)', fontSize: 13, fontFamily: 'Cairo, Inter, sans-serif', outline: 'none', resize: 'none', marginBottom: 14, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setRespondModal(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--wsl-border)', background: '#fff', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 13 }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button onClick={async () => {
                  try { await trpc.feedback.respond({ id: respondModal.id, response: respondText, status: 'resolved' }); toast.push('success', isAr ? 'تم الرد' : 'Responded'); setRespondModal(null); loadData(); } catch (e: any) { toast.push('error', e?.message || 'Failed'); }
                }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0A8F84', color: '#fff', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 13 }}>{isAr ? 'إرسال الرد' : 'Send Response'}</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Tokens Modal */}
        {addTokensModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setAddTokensModal(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Coins size={18} style={{ color: '#0A8F84' }} /> {isAr ? 'إضافة توكنز' : 'Add Tokens'}
              </h3>
              <div style={{ fontSize: 13, color: 'var(--wsl-ink-3)', marginBottom: 16, fontFamily: 'Cairo, sans-serif' }}>{isAr ? 'إلى:' : 'To:'} <strong>{addTokensModal.name}</strong></div>
              <input type="number" value={tokenAmount} onChange={e => setTokenAmount(parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--wsl-border)', fontFamily: 'Inter', fontSize: 16, fontWeight: 900, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
              <input value={tokenReason} onChange={e => setTokenReason(e.target.value)} placeholder={isAr ? 'السبب (اختياري)' : 'Reason (optional)'}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--wsl-border)', fontFamily: 'Cairo, Inter, sans-serif', fontSize: 13, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setAddTokensModal(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--wsl-border)', background: '#fff', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 13 }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button onClick={handleAddTokens} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0A8F84', color: '#fff', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 13 }}>{isAr ? 'إضافة' : 'Add'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </DashboardLayout>
  );
}
