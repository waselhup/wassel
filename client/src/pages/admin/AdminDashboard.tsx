import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Shield, Users, Activity, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Sparkles, Flame, Coins, Wallet, TrendingUp, AlertOctagon, Crown,
  ChevronDown, ChevronUp, TicketCheck, Bot, Ban, Server, Download, Megaphone, Wrench,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';
import Sparkline from './_dashboard/Sparkline';
import StatTile, { type Verdict } from './_dashboard/StatTile';
import FunnelChart from './_dashboard/FunnelChart';
import CohortCard from './_dashboard/CohortCard';
import TokenBurnBar from './_dashboard/TokenBurnBar';

// ───────────────────────────────────────────────────────────────────
// Local toast (re-used pattern from AdminUsers)
// ───────────────────────────────────────────────────────────────────
interface Toast { id: number; type: 'success' | 'error'; message: string; }

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (type: Toast['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };
  const View = () => (
    <div style={{ position: 'fixed', top: 20, insetInlineEnd: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 40 }}
            style={{
              padding: '12px 18px', borderRadius: 12, minWidth: 260,
              background: t.type === 'success' ? '#ECFDF5' : '#FEF2F2',
              color: t.type === 'success' ? '#065F46' : '#991B1B',
              border: `1px solid ${t.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            {t.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { push, View };
}

const ADMIN_EMAILS = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];

// Shared style helpers
const sectionHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14,
};
const sectionTitle: React.CSSProperties = {
  fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 900, fontSize: 18,
  color: 'var(--wsl-ink, #0F172A)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8,
};
const sectionSub: React.CSSProperties = {
  fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 500, fontSize: 12,
  color: 'var(--wsl-ink-3, #6B7280)',
};
const cardSurface: React.CSSProperties = {
  background: '#fff', borderRadius: 14, border: '1px solid var(--wsl-border, #E5E7EB)',
  padding: 22, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};
const sectionWrap: React.CSSProperties = { marginBottom: 32 };

// ───────────────────────────────────────────────────────────────────
// Reusable inline pieces
// ───────────────────────────────────────────────────────────────────
function LoadingBox({ height = 120 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: 14,
        background: 'linear-gradient(90deg, #F9FAFB, #F3F4F6, #F9FAFB)',
        backgroundSize: '200% 100%',
        animation: 'wsl-shimmer 1.4s linear infinite',
      }}
    />
  );
}

// ───────────────────────────────────────────────────────────────────
// Users list with inline +/- token controls + token movements ledger.
// Self-contained so the main dashboard stays readable. Reuses the same
// inline-style vocabulary and the project's custom tRPC wrapper.
// ───────────────────────────────────────────────────────────────────
interface AdminUserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  plan: string;
  token_balance: number;
  is_banned: boolean;
  is_admin?: boolean;
}
interface TxRow {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  wallet: 'bonus' | 'subscription' | 'topup';
  direction: 'credit' | 'debit';
  amount: number;
  reason: string | null;
  adminEmail: string | null;
  createdAt: string;
}

function UsersAndTransactions({
  onToast,
}: {
  onToast: (type: 'success' | 'error', msg: string) => void;
}) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [txFilterUser, setTxFilterUser] = useState<string | null>(null);

  // per-row draft state (amount + reason), keyed by user id
  const [draft, setDraft] = useState<Record<string, { amount: string; reason: string }>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(h);
  }, [q]);

  const loadUsers = async (search: string) => {
    setLoadingUsers(true);
    setErr(null);
    try {
      const data = await trpc.admin.users(search ? { search } : undefined);
      setUsers((data as AdminUserRow[]) || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadTx = async (userId: string | null) => {
    setLoadingTx(true);
    try {
      const data = await trpc.admin.listTokenTransactions(userId ? { userId, limit: 50 } : { limit: 50 });
      setTxs(data.transactions || []);
    } catch {
      // non-fatal — ledger is read-only display
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => { loadUsers(debouncedQ); }, [debouncedQ]);
  useEffect(() => { loadTx(txFilterUser); }, [txFilterUser]);

  const getDraft = (id: string) => draft[id] || { amount: '', reason: '' };
  const setDraftField = (id: string, field: 'amount' | 'reason', value: string) =>
    setDraft((d) => ({ ...d, [id]: { ...getDraft(id), [field]: value } }));

  async function adjust(u: AdminUserRow, sign: 1 | -1) {
    const d = getDraft(u.id);
    const magnitude = Math.floor(Math.abs(Number(d.amount)));
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      onToast('error', t('admin.cc.usersErrAmount'));
      return;
    }
    const reason = (d.reason || '').trim();
    if (reason.length < 1) {
      onToast('error', t('admin.cc.usersErrReason'));
      return;
    }
    const signed = sign * magnitude;
    const name = u.full_name || u.email || '';
    setSubmitting(u.id);
    // optimistic legacy-balance update
    const prevBalance = u.token_balance || 0;
    setUsers((list) =>
      list.map((x) => (x.id === u.id ? { ...x, token_balance: Math.max(0, prevBalance + signed) } : x))
    );
    try {
      const res = await trpc.admin.adjustUserTokens({ userId: u.id, amount: signed, reason });
      // reconcile with server's authoritative legacy balance
      setUsers((list) =>
        list.map((x) => (x.id === u.id ? { ...x, token_balance: res.newLegacyBalance } : x))
      );
      onToast(
        'success',
        sign > 0
          ? t('admin.cc.usersAddSuccess', { amount: magnitude.toLocaleString('en-US'), name })
          : t('admin.cc.usersRemoveSuccess', { amount: magnitude.toLocaleString('en-US'), name })
      );
      setDraft((dd) => ({ ...dd, [u.id]: { amount: '', reason: '' } }));
      loadTx(txFilterUser); // refresh ledger
    } catch (e: any) {
      // rollback optimistic update
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, token_balance: prevBalance } : x)));
      onToast('error', e?.message || t('admin.cc.usersAdjustFail'));
    } finally {
      setSubmitting(null);
    }
  }

  const walletLabel = (w: string) =>
    w === 'bonus' ? t('admin.cc.txWalletBonus')
    : w === 'subscription' ? t('admin.cc.txWalletSubscription')
    : t('admin.cc.txWalletTopup');

  const fmtDate = (iso: string) => {
    try {
      const dt = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    } catch { return '—'; }
  };

  const thStyle: React.CSSProperties = {
    fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 11,
    color: 'var(--wsl-ink-3, #6B7280)', textAlign: 'start', paddingBottom: 8, whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontSize: 12,
    color: 'var(--wsl-ink, #0F172A)', padding: '8px 0', verticalAlign: 'middle',
  };
  const miniInput: React.CSSProperties = {
    padding: '5px 8px', borderRadius: 7, border: '1px solid var(--wsl-border, #E5E7EB)',
    fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontSize: 11, outline: 'none', boxSizing: 'border-box',
  };
  const miniBtn = (bg: string): React.CSSProperties => ({
    padding: '5px 10px', borderRadius: 7, border: 'none', background: bg, color: '#fff',
    cursor: 'pointer', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 11,
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
      {/* ── Users + inline adjust ── */}
      <div style={cardSurface}>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin.cc.usersSearch')}
            style={{ ...miniInput, width: '100%', fontSize: 12, padding: '8px 12px' }}
          />
        </div>
        {err ? (
          <ErrorBox message={err} retryLabel={t('admin.cc.retry')} onRetry={() => loadUsers(debouncedQ)} />
        ) : loadingUsers ? (
          <LoadingBox height={200} />
        ) : users.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--wsl-ink-3, #6B7280)', fontSize: 12, fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>
            {t('admin.cc.usersEmpty')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--wsl-border, #E5E7EB)' }}>
                  <th style={thStyle}>{t('admin.cc.usersColName')}</th>
                  <th style={{ ...thStyle, textAlign: 'end' }}>{t('admin.cc.usersColBalance')}</th>
                  <th style={{ ...thStyle, textAlign: 'end' }}>{t('admin.cc.usersColAdjust')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const d = getDraft(u.id);
                  const busy = submitting === u.id;
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {u.full_name || '—'}
                          {u.is_admin && (
                            <span style={{ padding: '1px 5px', borderRadius: 4, background: '#EDE9FE', color: '#7C3AED', fontSize: 9, fontWeight: 900 }}>
                              {t('au.adminBadge', 'admin')}
                            </span>
                          )}
                        </div>
                        <div dir="ltr" style={{ fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)', textAlign: 'start', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.email || '—'}
                        </div>
                      </td>
                      <td dir="ltr" style={{ ...tdStyle, textAlign: 'end', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#14b8a6' }}>
                        {(u.token_balance || 0).toLocaleString('en-US')}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                          <input
                            type="number" min={1} dir="ltr" disabled={busy}
                            value={d.amount}
                            onChange={(e) => setDraftField(u.id, 'amount', e.target.value)}
                            placeholder={t('admin.cc.usersAmountPh')}
                            style={{ ...miniInput, width: 110, fontVariantNumeric: 'tabular-nums' }}
                          />
                          <input
                            type="text" disabled={busy}
                            value={d.reason}
                            onChange={(e) => setDraftField(u.id, 'reason', e.target.value)}
                            placeholder={t('admin.cc.usersReasonPh')}
                            style={{ ...miniInput, width: 160 }}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button disabled={busy} onClick={() => adjust(u, 1)} style={miniBtn('#14b8a6')}>
                              {busy ? t('admin.cc.usersAdjusting') : `+ ${t('admin.cc.usersAdd')}`}
                            </button>
                            <button disabled={busy} onClick={() => adjust(u, -1)} style={miniBtn('#DC2626')}>
                              {busy ? t('admin.cc.usersAdjusting') : `− ${t('admin.cc.usersRemove')}`}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Token movements ledger ── */}
      <div style={cardSurface}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...sectionTitle, fontSize: 14 }}>{t('admin.cc.txTitle')}</div>
            <div style={{ ...sectionSub, marginTop: 2 }}>{t('admin.cc.txSubtitle')}</div>
          </div>
          {txFilterUser && (
            <button
              onClick={() => setTxFilterUser(null)}
              style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid var(--wsl-border, #E5E7EB)', background: '#fff', cursor: 'pointer', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 10 }}
            >
              {t('admin.cc.txClearFilter')}
            </button>
          )}
        </div>
        {loadingTx ? (
          <LoadingBox height={200} />
        ) : txs.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--wsl-ink-3, #6B7280)', fontSize: 12, fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>
            {t('admin.cc.txEmpty')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--wsl-border, #E5E7EB)' }}>
                  <th style={thStyle}>{t('admin.cc.txColUser')}</th>
                  <th style={{ ...thStyle, textAlign: 'end' }}>{t('admin.cc.txColAmount')}</th>
                  <th style={thStyle}>{t('admin.cc.txColWallet')}</th>
                  <th style={thStyle}>{t('admin.cc.txColReason')}</th>
                  <th style={thStyle}>{t('admin.cc.txColAdmin')}</th>
                  <th style={{ ...thStyle, textAlign: 'end' }}>{t('admin.cc.txColDate')}</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={tdStyle}>
                      <button
                        onClick={() => setTxFilterUser(tx.userId)}
                        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'start' }}
                      >
                        <div style={{ fontWeight: 700, color: 'var(--wsl-ink, #0F172A)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.userName || tx.userEmail || '—'}
                        </div>
                      </button>
                    </td>
                    <td dir="ltr" style={{ ...tdStyle, textAlign: 'end', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: tx.amount >= 0 ? '#10B981' : '#DC2626' }}>
                      {tx.amount >= 0 ? '+' : '−'}{Math.abs(tx.amount).toLocaleString('en-US')}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ padding: '1px 6px', borderRadius: 4, background: '#F3F4F6', color: 'var(--wsl-ink-2, #374151)', fontSize: 10, fontWeight: 800 }}>
                        {walletLabel(tx.wallet)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--wsl-ink-2, #374151)' }}>
                      {tx.reason || '—'}
                    </td>
                    <td dir="ltr" style={{ ...tdStyle, fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)', textAlign: 'start', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.adminEmail || '—'}
                    </td>
                    <td dir="ltr" style={{ ...tdStyle, textAlign: 'end', fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {fmtDate(tx.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorBox({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: '#FEF2F2',
        border: '1px solid #FECACA',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <AlertTriangle size={16} style={{ color: '#DC2626', flexShrink: 0 }} />
      <div style={{ flex: 1, fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontSize: 12, color: '#991B1B', fontWeight: 700 }}>
        {message}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '6px 12px', borderRadius: 8, background: '#DC2626', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 11,
          }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isAr = i18n.language === 'ar';
  const toast = useToast();
  const isAdmin = ADMIN_EMAILS.includes(user?.email || '');

  // Loadable data slots — each tracked independently for resilience
  const [overview, setOverview] = useState<any>(null);
  const [funnel, setFunnel] = useState<any>(null);
  const [cohorts, setCohorts] = useState<any>(null);
  const [tokenEconomy, setTokenEconomy] = useState<any>(null);
  const [growth, setGrowth] = useState<any>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({
    overview: true, funnel: true, cohorts: true, tokens: true, growth: true, system: true, tickets: true,
  });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    system: true, tickets: false, alerts: false, agents: false,
  });

  // Grant tokens modal state
  const [grantModal, setGrantModal] = useState<{ userId: string; name: string } | null>(null);
  const [grantAmount, setGrantAmount] = useState(50);

  async function loadSection<T>(key: string, fn: () => Promise<T>, setter: (v: T) => void) {
    setLoading((s) => ({ ...s, [key]: true }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
    try {
      const data = await fn();
      setter(data);
    } catch (e: any) {
      setErrors((er) => ({ ...er, [key]: e?.message || 'Failed' }));
    } finally {
      setLoading((s) => ({ ...s, [key]: false }));
    }
  }

  async function loadAll() {
    loadSection('overview', () => trpc.admin.dashboardOverview(), setOverview);
    loadSection('funnel', () => trpc.admin.funnel(), setFunnel);
    loadSection('cohorts', () => trpc.admin.cohorts(), setCohorts);
    loadSection('tokens', () => trpc.admin.tokenEconomy(), setTokenEconomy);
    loadSection('growth', () => trpc.admin.growthSignals(), setGrowth);
    loadSection('system', () => trpc.admin.systemStatus(), setSystemStatus);
    loadSection('tickets', () => trpc.feedback.listAll(), setTickets);
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadAll();
  }, [isAdmin]);

  async function handleGrantTokens(userId: string) {
    setGrantModal({ userId, name: '' });
  }

  async function confirmGrant() {
    if (!grantModal) return;
    try {
      await trpc.admin.addTokens({
        userId: grantModal.userId,
        amount: grantAmount,
        reason: 'Admin grant from cohort card',
      });
      toast.push('success', isAr ? `تمت إضافة ${grantAmount} توكن` : `Granted ${grantAmount} tokens`);
      setGrantModal(null);
      loadSection('cohorts', () => trpc.admin.cohorts(), setCohorts);
    } catch (e: any) {
      toast.push('error', e?.message || 'Failed');
    }
  }

  function sendEmailTo(userId: string) {
    const u = (cohorts?.hotProspects || []).find((x: any) => x.id === userId)
          || (cohorts?.churnRisk || []).find((x: any) => x.id === userId);
    if (u?.email) window.location.href = `mailto:${u.email}`;
  }

  function askTestimonial(userId: string) {
    const u = (cohorts?.heroes || []).find((x: any) => x.id === userId);
    if (!u?.email) return;
    const subject = isAr
      ? 'هل تشاركنا تجربتك مع وصل؟'
      : 'Would you share your Wassel story?';
    const body = isAr
      ? `مرحباً ${u.full_name || ''},%0A%0Aلاحظنا أنك من أكثر مستخدمي وصل نشاطاً. هل يمكنك مشاركة تجربتك معنا في شهادة قصيرة؟%0A%0Aشكراً،%0Aفريق وصل`
      : `Hi ${u.full_name || ''},%0A%0AYou're one of Wassel's most active users — would you share a short testimonial about your experience?%0A%0AThanks,%0AThe Wassel team`;
    window.location.href = `mailto:${u.email}?subject=${encodeURIComponent(subject)}&body=${body}`;
  }

  // ─── Derived: verdicts for hero strip ───
  function verdictFor(key: string, today: number, yesterday: number): Verdict {
    if (key === 'fires') {
      if (today === 0) return 'healthy';
      if (today >= 3) return 'fire';
      return 'watch';
    }
    if (key === 'tokensBurned') {
      const delta = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : 0;
      if (delta > 50) return 'watch'; // huge spike in cost
      return 'neutral';
    }
    // signups / activated / paying / mrr — up is good
    const delta = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : today > 0 ? 100 : 0;
    if (delta < -20) return 'fire';
    if (delta < 0) return 'watch';
    return 'healthy';
  }

  // ─── Derived: funnel stages with localized labels ───
  const funnelStages = useMemo(() => {
    if (!funnel?.stages) return [];
    const labelByKey: Record<string, string> = {
      signups: t('admin.cc.stageSignups'),
      onboarded: t('admin.cc.stageOnboarded'),
      firstAnalysis: t('admin.cc.stageFirstAnalysis'),
      firstCv: t('admin.cc.stageFirstCv'),
      savedKb: t('admin.cc.stageSavedKb'),
      paid: t('admin.cc.stagePaid'),
    };
    return funnel.stages.map((s: any) => ({ ...s, label: labelByKey[s.key] || s.key }));
  }, [funnel, t]);

  // ─── Burn-by-category segments ───
  const burnSegments = useMemo(() => {
    if (!tokenEconomy?.burnByCategory) return [];
    const labelByKey: Record<string, string> = {
      linkedin: t('admin.cc.catLinkedin'),
      cv: t('admin.cc.catCv'),
      campaign: t('admin.cc.catCampaign'),
      other: t('admin.cc.catOther'),
    };
    const colorByKey: Record<string, string> = {
      linkedin: '#14b8a6',
      cv: '#8B5CF6',
      campaign: '#F59E0B',
      other: '#9CA3AF',
    };
    return tokenEconomy.burnByCategory.map((c: any) => ({
      ...c,
      label: labelByKey[c.key] || c.key,
      color: colorByKey[c.key] || '#9CA3AF',
    }));
  }, [tokenEconomy, t]);

  // ─── Auth gate ───
  if (!isAdmin) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Shield size={48} style={{ color: '#DC2626', margin: '0 auto 16px' }} />
        <div style={{ fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 900, fontSize: 20, color: '#DC2626' }}>
          {isAr ? 'غير مصرّح' : 'Unauthorized'}
        </div>
      </div>
    );
  }

  const fmtNum = (n: number) => (n || 0).toLocaleString('en-US');
  const openTicketsCount = (tickets || []).filter((x: any) => x.status === 'open').length;
  const recentErrors = systemStatus?.recentErrors || [];

  return (
    <>
      <toast.View />
      <style>{`
        @keyframes wsl-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
      <div style={{ margin: '0 auto', padding: '0 4px' }}>
        {/* Page header is provided by PortalLayout; we only show a subtitle
            + refresh button so the user knows when the data was last loaded. */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}
        >
          <div style={{ fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 500, fontSize: 13, color: 'var(--wsl-ink-3, #6B7280)' }}>
            {t('admin.cc.headerSubtitle')}
          </div>
          <button
            onClick={loadAll}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 10, border: '1px solid var(--wsl-border, #E5E7EB)',
              background: '#fff', cursor: 'pointer',
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 12,
              color: 'var(--wsl-ink-2, #374151)',
            }}
          >
            <RefreshCw size={13} />
            {t('admin.cc.refresh')}
          </button>
        </motion.div>

        {/* ═══ SECTION 1 — TODAY AT A GLANCE ═══════════════════════════ */}
        <div style={sectionWrap}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>
              <Sparkles size={16} style={{ color: '#14b8a6' }} />
              {t('admin.cc.s1Title')}
            </h2>
          </div>

          {errors.overview ? (
            <ErrorBox message={errors.overview} onRetry={() => loadSection('overview', () => trpc.admin.dashboardOverview(), setOverview)} retryLabel={t('admin.cc.retry')} />
          ) : loading.overview ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              {Array.from({ length: 6 }).map((_, i) => <LoadingBox key={i} height={150} />)}
            </div>
          ) : overview ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <StatTile
                index={0}
                label={t('admin.cc.tileSignups')}
                value={fmtNum(overview.signups.today)}
                today={overview.signups.today}
                yesterday={overview.signups.yesterday}
                spark={overview.signups.spark}
                verdict={verdictFor('signups', overview.signups.today, overview.signups.yesterday)}
                verdictLabel={t(`admin.cc.verdict${verdictFor('signups', overview.signups.today, overview.signups.yesterday).charAt(0).toUpperCase() + verdictFor('signups', overview.signups.today, overview.signups.yesterday).slice(1)}`)}
                icon={<Users size={14} />}
              />
              <StatTile
                index={1}
                label={t('admin.cc.tileActivated')}
                value={fmtNum(overview.activated.today)}
                today={overview.activated.today}
                yesterday={overview.activated.yesterday}
                spark={overview.activated.spark}
                verdict={verdictFor('activated', overview.activated.today, overview.activated.yesterday)}
                verdictLabel={t(`admin.cc.verdict${verdictFor('activated', overview.activated.today, overview.activated.yesterday).charAt(0).toUpperCase() + verdictFor('activated', overview.activated.today, overview.activated.yesterday).slice(1)}`)}
                icon={<Activity size={14} />}
              />
              <StatTile
                index={2}
                label={t('admin.cc.tilePaying')}
                value={fmtNum(overview.paying.today)}
                today={overview.paying.today}
                yesterday={overview.paying.yesterday}
                spark={overview.paying.spark}
                verdict="healthy"
                verdictLabel={t('admin.cc.verdictHealthy')}
                icon={<Crown size={14} />}
              />
              <StatTile
                index={3}
                label={t('admin.cc.tileMrr')}
                value={`${fmtNum(overview.mrr.today)} ${t('admin.cc.sar')}`}
                today={overview.mrr.today}
                yesterday={overview.mrr.yesterday}
                spark={overview.mrr.spark}
                verdict="healthy"
                verdictLabel={t('admin.cc.verdictHealthy')}
                icon={<Wallet size={14} />}
              />
              <StatTile
                index={4}
                label={t('admin.cc.tileTokensBurned')}
                value={fmtNum(overview.tokensBurned.today)}
                today={overview.tokensBurned.today}
                yesterday={overview.tokensBurned.yesterday}
                spark={overview.tokensBurned.spark}
                verdict={verdictFor('tokensBurned', overview.tokensBurned.today, overview.tokensBurned.yesterday)}
                verdictLabel={t(`admin.cc.verdict${verdictFor('tokensBurned', overview.tokensBurned.today, overview.tokensBurned.yesterday).charAt(0).toUpperCase() + verdictFor('tokensBurned', overview.tokensBurned.today, overview.tokensBurned.yesterday).slice(1)}`)}
                icon={<Coins size={14} />}
              />
              <StatTile
                index={5}
                label={t('admin.cc.tileFires')}
                value={fmtNum(overview.fires.today)}
                today={overview.fires.today}
                yesterday={overview.fires.yesterday}
                spark={overview.fires.spark}
                verdict={verdictFor('fires', overview.fires.today, overview.fires.yesterday)}
                verdictLabel={t(`admin.cc.verdict${verdictFor('fires', overview.fires.today, overview.fires.yesterday).charAt(0).toUpperCase() + verdictFor('fires', overview.fires.today, overview.fires.yesterday).slice(1)}`)}
                icon={<Flame size={14} />}
                hint={String(t('admin.cc.firesBreakdown', overview.fires.breakdown))}
              />
            </div>
          ) : null}
        </div>

        {/* ═══ SECTION 2 — FUNNEL ══════════════════════════════════════ */}
        <div style={sectionWrap}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>
                <TrendingUp size={16} style={{ color: '#14b8a6' }} />
                {t('admin.cc.s2Title')}
              </h2>
              <div style={{ ...sectionSub, marginTop: 4 }}>{t('admin.cc.s2Subtitle')}</div>
            </div>
          </div>
          <div style={cardSurface}>
            {errors.funnel ? (
              <ErrorBox message={errors.funnel} onRetry={() => loadSection('funnel', () => trpc.admin.funnel(), setFunnel)} retryLabel={t('admin.cc.retry')} />
            ) : loading.funnel ? (
              <LoadingBox height={360} />
            ) : funnel ? (
              <FunnelChart
                stages={funnelStages}
                biggestDropIdx={funnel.biggestDropIdx}
                biggestDropPct={funnel.biggestDropPct}
                biggestLeakLabel={
                  funnel.biggestDropPct > 0 && funnelStages[funnel.biggestDropIdx - 1] && funnelStages[funnel.biggestDropIdx]
                    ? t('admin.cc.biggestLeak', {
                        from: funnelStages[funnel.biggestDropIdx - 1].label,
                        to: funnelStages[funnel.biggestDropIdx].label,
                        pct: funnel.biggestDropPct,
                      })
                    : undefined
                }
                noLeaksLabel={funnel.biggestDropPct === 0 ? t('admin.cc.noLeaks') : undefined}
                pctOfPrevFmt={(pct) => t('admin.cc.stagePctOfPrev', { pct })}
              />
            ) : null}
          </div>
        </div>

        {/* ═══ SECTION 3 — COHORTS ═════════════════════════════════════ */}
        <div style={sectionWrap}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>
              <Users size={16} style={{ color: '#14b8a6' }} />
              {t('admin.cc.s3Title')}
            </h2>
          </div>

          {errors.cohorts ? (
            <ErrorBox message={errors.cohorts} onRetry={() => loadSection('cohorts', () => trpc.admin.cohorts(), setCohorts)} retryLabel={t('admin.cc.retry')} />
          ) : loading.cohorts ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {Array.from({ length: 3 }).map((_, i) => <LoadingBox key={i} height={320} />)}
            </div>
          ) : cohorts ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              <CohortCard
                index={0}
                emoji="🔥"
                accentColor="#DC2626"
                title={t('admin.cc.hotProspectsTitle')}
                subtitle={t('admin.cc.hotProspectsSub')}
                emptyLabel={t('admin.cc.cohortEmpty')}
                viewAllLabel={t('admin.cc.viewAll')}
                actions={[
                  { label: t('admin.cc.cohortGrantTokens'), onClick: handleGrantTokens, variant: 'primary' },
                  { label: t('admin.cc.cohortSendEmail'), onClick: sendEmailTo },
                ]}
                rows={(cohorts.hotProspects || []).map((u: any) => ({
                  id: u.id,
                  email: u.email,
                  full_name: u.full_name,
                  avatar_url: u.avatar_url,
                  meta: [
                    t('admin.cc.cohortAnalysesShort', { n: u.analyses_7d }),
                    t('admin.cc.cohortDaysOld', { n: u.days_old }),
                    t('admin.cc.cohortTokensLeft', { n: u.token_balance }),
                  ].join(' · '),
                }))}
              />
              <CohortCard
                index={1}
                emoji="💀"
                accentColor="#F59E0B"
                title={t('admin.cc.churnRiskTitle')}
                subtitle={t('admin.cc.churnRiskSub')}
                emptyLabel={t('admin.cc.cohortEmpty')}
                viewAllLabel={t('admin.cc.viewAll')}
                actions={[
                  { label: t('admin.cc.cohortSendEmail'), onClick: sendEmailTo, variant: 'primary' },
                ]}
                rows={(cohorts.churnRisk || []).map((u: any) => ({
                  id: u.id,
                  email: u.email,
                  full_name: u.full_name,
                  avatar_url: u.avatar_url,
                  badge: { label: u.plan, color: '#7C3AED', bg: '#EDE9FE' },
                  meta: [
                    t('admin.cc.cohortMrr', { n: u.mrr }),
                    t('admin.cc.cohortTokensLeft', { n: u.token_balance }),
                  ].join(' · '),
                }))}
              />
              <CohortCard
                index={2}
                emoji="🦄"
                accentColor="#14b8a6"
                title={t('admin.cc.heroesTitle')}
                subtitle={t('admin.cc.heroesSub')}
                emptyLabel={t('admin.cc.cohortEmpty')}
                viewAllLabel={t('admin.cc.viewAll')}
                actions={[
                  { label: t('admin.cc.cohortAskTestimonial'), onClick: askTestimonial, variant: 'primary' },
                ]}
                rows={(cohorts.heroes || []).map((u: any) => ({
                  id: u.id,
                  email: u.email,
                  full_name: u.full_name,
                  avatar_url: u.avatar_url,
                  badge: { label: u.plan, color: '#065F46', bg: '#D1FAE5' },
                  meta: [
                    t('admin.cc.cohortAnalysesShort', { n: u.analyses_lifetime }),
                    t('admin.cc.cohortKbItems', { n: u.kb_items }),
                  ].join(' · '),
                }))}
              />
            </div>
          ) : null}
        </div>

        {/* ═══ SECTION 3.5 — USERS & TOKEN MOVEMENTS ═══════════════════ */}
        <div style={sectionWrap}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>
                <Coins size={16} style={{ color: '#14b8a6' }} />
                {t('admin.cc.usersTitle')}
              </h2>
              <div style={{ ...sectionSub, marginTop: 4 }}>{t('admin.cc.usersSubtitle')}</div>
            </div>
          </div>
          <UsersAndTransactions
            onToast={(type, msg) => toast.push(type, msg)}
          />
        </div>

        {/* ═══ SECTION 4 — TOKEN ECONOMY ═══════════════════════════════ */}
        <div style={sectionWrap}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>
                <Coins size={16} style={{ color: '#14b8a6' }} />
                {t('admin.cc.s4Title')}
              </h2>
              <div style={{ ...sectionSub, marginTop: 4 }}>{t('admin.cc.s4Subtitle')}</div>
            </div>
          </div>

          {errors.tokens ? (
            <ErrorBox message={errors.tokens} onRetry={() => loadSection('tokens', () => trpc.admin.tokenEconomy(), setTokenEconomy)} retryLabel={t('admin.cc.retry')} />
          ) : loading.tokens ? (
            <LoadingBox height={300} />
          ) : tokenEconomy ? (
            <>
              {tokenEconomy.marginAlert && (
                <div
                  style={{
                    marginBottom: 14, padding: '12px 16px', borderRadius: 12,
                    background: '#FFFBEB', border: '1px solid #FDE68A',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 13, color: '#92400E',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <AlertOctagon size={16} />
                  {t('admin.cc.marginAlert', {
                    plan: tokenEconomy.marginAlert.plan,
                    pct: Math.round(tokenEconomy.marginAlert.margin_pct),
                  })}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
                <div style={cardSurface}>
                  <div style={{ ...sectionTitle, fontSize: 14, marginBottom: 14 }}>
                    {t('admin.cc.burnByCategoryTitle')}
                  </div>
                  <TokenBurnBar
                    segments={burnSegments}
                    tokensFmt={(n) => t('admin.cc.catTokens', { n: fmtNum(n) })}
                    costFmt={(n) => t('admin.cc.catCost', { n })}
                  />
                  <div style={{
                    marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--wsl-border, #E5E7EB)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--wsl-ink-3, #6B7280)', fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>
                      {t('admin.cc.totalCostUSD')}
                    </span>
                    <span dir="ltr" style={{
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 900, fontSize: 18,
                      color: '#14b8a6', fontVariantNumeric: 'tabular-nums',
                    }}>
                      ${tokenEconomy.totalCostUSD.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div style={cardSurface}>
                  <div style={{ ...sectionTitle, fontSize: 14, marginBottom: 14 }}>
                    {t('admin.cc.topConsumersTitle')}
                  </div>
                  {(tokenEconomy.top10Consumers || []).length === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--wsl-ink-3, #6B7280)', fontSize: 12, fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>
                      {t('admin.cc.empty')}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {tokenEconomy.top10Consumers.map((c: any) => {
                        const marginColor = c.margin_pct === null ? '#9CA3AF'
                          : c.margin_pct > 30 ? '#DC2626'
                          : c.margin_pct > 15 ? '#F59E0B'
                          : '#10B981';
                        return (
                          <div key={c.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px', borderRadius: 8, background: '#F9FAFB',
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                                fontWeight: 800, fontSize: 12, color: 'var(--wsl-ink, #0F172A)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>
                                {c.full_name || c.email}
                                <span dir="ltr" style={{
                                  marginInlineStart: 6, padding: '1px 6px', borderRadius: 4,
                                  background: '#EDE9FE', color: '#7C3AED', fontSize: 9, fontWeight: 900,
                                  textTransform: 'uppercase',
                                }}>{c.plan}</span>
                              </div>
                            </div>
                            <span dir="ltr" style={{
                              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                              fontWeight: 900, fontSize: 11, color: '#14b8a6',
                              fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'end',
                            }}>{fmtNum(c.tokens_consumed)}</span>
                            <span dir="ltr" style={{
                              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                              fontWeight: 700, fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)',
                              fontVariantNumeric: 'tabular-nums', minWidth: 50, textAlign: 'end',
                            }}>${c.cost_usd.toFixed(2)}</span>
                            {c.margin_pct !== null && (
                              <span dir="ltr" style={{
                                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                                fontWeight: 900, fontSize: 10, color: marginColor,
                                fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'end',
                              }}>{Math.round(c.margin_pct)}%</span>
                            )}
                            <button
                              onClick={() => handleGrantTokens(c.id)}
                              style={{
                                padding: '3px 8px', borderRadius: 6,
                                border: '1px solid var(--wsl-border, #E5E7EB)',
                                background: '#fff', color: '#14b8a6', cursor: 'pointer',
                                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                                fontWeight: 900, fontSize: 10,
                              }}
                            >
                              {t('admin.cc.grantTokensBtn')}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* ═══ SECTION 5 — GROWTH SIGNALS ══════════════════════════════ */}
        <div style={sectionWrap}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>
                <TrendingUp size={16} style={{ color: '#14b8a6' }} />
                {t('admin.cc.s5Title')}
              </h2>
              <div style={{ ...sectionSub, marginTop: 4 }}>{t('admin.cc.s5Subtitle')}</div>
            </div>
          </div>

          {errors.growth ? (
            <ErrorBox message={errors.growth} onRetry={() => loadSection('growth', () => trpc.admin.growthSignals(), setGrowth)} retryLabel={t('admin.cc.retry')} />
          ) : loading.growth ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {Array.from({ length: 4 }).map((_, i) => <LoadingBox key={i} height={160} />)}
            </div>
          ) : growth ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                {/* Activation rate */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={cardSurface}
                >
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--wsl-ink-3, #6B7280)', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {t('admin.cc.activationRate')}
                  </div>
                  <div dir="ltr" style={{
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                    fontWeight: 900, fontSize: 32, color: '#14b8a6',
                    fontVariantNumeric: 'tabular-nums', marginTop: 6,
                  }}>
                    {growth.activationRate30d.toFixed(0)}%
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--wsl-ink-3, #6B7280)', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', marginTop: 4 }}>
                    {t('admin.cc.activationRateDesc')}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Sparkline data={growth.activationSpark} width={200} height={28} stroke="#14b8a6" fill="rgba(20, 184, 166, 0.15)" />
                  </div>
                </motion.div>

                {/* TTFV */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  style={cardSurface}
                >
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--wsl-ink-3, #6B7280)', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {t('admin.cc.ttfv')}
                  </div>
                  <div dir="ltr" style={{
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                    fontWeight: 900, fontSize: 32,
                    color: growth.ttfvMinutes !== null && growth.ttfvMinutes <= 10 ? '#10B981' : '#F59E0B',
                    fontVariantNumeric: 'tabular-nums', marginTop: 6,
                  }}>
                    {growth.ttfvMinutes !== null ? t('admin.cc.minutes', { n: Math.round(growth.ttfvMinutes) }) : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--wsl-ink-3, #6B7280)', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', marginTop: 4 }}>
                    {growth.ttfvMinutes !== null ? t('admin.cc.ttfvGoal') : t('admin.cc.ttfvNone')}
                  </div>
                </motion.div>

                {/* KB export rate */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  style={cardSurface}
                >
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--wsl-ink-3, #6B7280)', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {t('admin.cc.kbExportRate')}
                  </div>
                  <div dir="ltr" style={{
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                    fontWeight: 900, fontSize: 32, color: '#8B5CF6',
                    fontVariantNumeric: 'tabular-nums', marginTop: 6,
                  }}>
                    {growth.kbExportRate.toFixed(0)}%
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--wsl-ink-3, #6B7280)', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', marginTop: 4 }}>
                    {t('admin.cc.kbExportRateDesc')}
                  </div>
                </motion.div>

                {/* Locale split */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  style={cardSurface}
                >
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--wsl-ink-3, #6B7280)', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {t('admin.cc.localeSplit')}
                  </div>
                  {(() => {
                    const total = growth.localeSplit.ar + growth.localeSplit.en + growth.localeSplit.other;
                    const arPct = total > 0 ? (growth.localeSplit.ar / total) * 100 : 0;
                    const enPct = total > 0 ? (growth.localeSplit.en / total) * 100 : 0;
                    const otherPct = total > 0 ? (growth.localeSplit.other / total) * 100 : 0;
                    return (
                      <>
                        <div dir="ltr" style={{
                          display: 'flex', width: '100%', height: 12, borderRadius: 6,
                          overflow: 'hidden', marginTop: 14, background: '#F3F4F6',
                        }}>
                          {arPct > 0 && <div style={{ width: `${arPct}%`, background: '#14b8a6' }} />}
                          {enPct > 0 && <div style={{ width: `${enPct}%`, background: '#8B5CF6' }} />}
                          {otherPct > 0 && <div style={{ width: `${otherPct}%`, background: '#9CA3AF' }} />}
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontSize: 11, fontWeight: 800 }}>
                          <span style={{ color: '#14b8a6' }} dir="ltr">● {t('admin.cc.localeAr')} {Math.round(arPct)}%</span>
                          <span style={{ color: '#8B5CF6' }} dir="ltr">● {t('admin.cc.localeEn')} {Math.round(enPct)}%</span>
                          {otherPct > 0 && (
                            <span style={{ color: '#9CA3AF' }} dir="ltr">● {t('admin.cc.localeOther')} {Math.round(otherPct)}%</span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              </div>

              {/* Referral placeholder — hidden until referrals table exists */}
              {/* TODO: when public.referrals exists, show top 5 referrers here */}
            </>
          ) : null}
        </div>

        {/* ═══ SECTION 6 — SYSTEM HEALTH ═══════════════════════════════ */}
        <div style={sectionWrap}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>
                <Server size={16} style={{ color: '#14b8a6' }} />
                {t('admin.cc.s6Title')}
              </h2>
              <div style={{ ...sectionSub, marginTop: 4 }}>{t('admin.cc.s6Subtitle')}</div>
            </div>
          </div>

          <div style={cardSurface}>
            {/* Accordion */}
            {[
              { key: 'system', icon: <Server size={14} />, label: t('admin.cc.sysStatusTitle'), count: recentErrors.length },
              { key: 'tickets', icon: <TicketCheck size={14} />, label: t('admin.cc.ticketsTitle'), count: openTicketsCount },
              { key: 'alerts', icon: <AlertTriangle size={14} />, label: t('admin.cc.alertsTitle'), count: (overview?.fires.breakdown.banned || 0) + (overview?.fires.breakdown.failedPayments || 0) },
              { key: 'agents', icon: <Bot size={14} />, label: t('admin.cc.agentsTitle'), count: 0 },
            ].map((row) => {
              const isOpen = openSections[row.key];
              return (
                <div key={row.key} style={{ borderBottom: '1px solid var(--wsl-border, #E5E7EB)' }}>
                  <button
                    onClick={() => setOpenSections((s) => ({ ...s, [row.key]: !s[row.key] }))}
                    style={{
                      width: '100%', padding: '12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 13,
                      color: 'var(--wsl-ink, #0F172A)', textAlign: 'start',
                    }}
                  >
                    {row.icon}
                    <span style={{ flex: 1 }}>{row.label}</span>
                    {row.count > 0 && (
                      <span dir="ltr" style={{
                        padding: '2px 8px', borderRadius: 999,
                        background: row.key === 'system' && row.count > 0 ? '#FEE2E2' : '#F3F4F6',
                        color: row.key === 'system' && row.count > 0 ? '#DC2626' : 'var(--wsl-ink-2, #374151)',
                        fontSize: 10, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                      }}>{row.count}</span>
                    )}
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {isOpen && (
                    <div style={{ padding: '4px 0 16px' }}>
                      {row.key === 'system' && (
                        loading.system ? <LoadingBox height={80} /> :
                        errors.system ? <ErrorBox message={errors.system} retryLabel={t('admin.cc.retry')} onRetry={() => loadSection('system', () => trpc.admin.systemStatus(), setSystemStatus)} /> :
                        systemStatus ? (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
                              {Object.entries(systemStatus.stats || {}).map(([svc, data]: [string, any]) => {
                                const errRate = data.total > 0 ? (data.errors / data.total) * 100 : 0;
                                const color = errRate > 20 ? '#DC2626' : errRate > 5 ? '#F59E0B' : '#10B981';
                                return (
                                  <div key={svc} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: 10, borderRadius: 10, background: '#F9FAFB',
                                  }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{
                                        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                                        fontWeight: 800, fontSize: 12, color: 'var(--wsl-ink, #0F172A)',
                                        textTransform: 'capitalize',
                                      }}>{svc}</div>
                                      <div dir="ltr" style={{ fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)' }}>
                                        {data.total} calls · {data.errors} errors
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {recentErrors.length === 0 && (
                              <div style={{
                                padding: 10, borderRadius: 8, background: '#ECFDF5',
                                border: '1px solid #A7F3D0',
                                fontSize: 11, fontWeight: 700, color: '#065F46',
                                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                              }}>
                                <CheckCircle2 size={12} /> {t('admin.cc.allClear')}
                              </div>
                            )}
                          </>
                        ) : null
                      )}

                      {row.key === 'tickets' && (
                        loading.tickets ? <LoadingBox height={80} /> :
                        (tickets || []).length === 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--wsl-ink-3, #6B7280)', fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>
                            {t('admin.cc.allClear')}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {tickets.slice(0, 5).map((tk: any) => (
                              <div key={tk.id} style={{
                                padding: 10, borderRadius: 8, background: '#F9FAFB',
                                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                              }}>
                                <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--wsl-ink, #0F172A)' }}>
                                  {tk.subject}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)', marginTop: 2 }}>
                                  {tk.status} · {tk.category}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}

                      {row.key === 'alerts' && overview && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {overview.fires.breakdown.banned > 0 && (
                            <div style={{
                              padding: 10, borderRadius: 8, background: '#FEF2F2',
                              fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontSize: 12, fontWeight: 700, color: '#991B1B',
                              display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                              <Ban size={14} />
                              {t('admin.cc.alertBanned', { n: overview.fires.breakdown.banned })}
                            </div>
                          )}
                          {overview.fires.breakdown.failedPayments > 0 && (
                            <div style={{
                              padding: 10, borderRadius: 8, background: '#FEF2F2',
                              fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontSize: 12, fontWeight: 700, color: '#991B1B',
                              display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                              <Wallet size={14} />
                              {t('admin.cc.alertFailedPayments', { n: overview.fires.breakdown.failedPayments })}
                            </div>
                          )}
                          {overview.fires.breakdown.banned === 0 && overview.fires.breakdown.failedPayments === 0 && (
                            <div style={{ fontSize: 12, color: 'var(--wsl-ink-3, #6B7280)', fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>
                              {t('admin.cc.allClear')}
                            </div>
                          )}
                        </div>
                      )}

                      {row.key === 'agents' && (
                        <div style={{ fontSize: 12, color: 'var(--wsl-ink-3, #6B7280)', fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>
                          {t('admin.cc.empty')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Quick actions row */}
            <div style={{ paddingTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span style={{
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 900, fontSize: 11,
                color: 'var(--wsl-ink-3, #6B7280)', textTransform: 'uppercase', letterSpacing: 0.4,
                alignSelf: 'center', marginInlineEnd: 6,
              }}>
                {t('admin.cc.quickActions')}
              </span>
              {[
                { icon: <RefreshCw size={12} />, label: t('admin.cc.actionRefreshAll'), onClick: loadAll },
                { icon: <Download size={12} />, label: t('admin.cc.actionExportCsv'), onClick: () => toast.push('success', 'TODO') },
                { icon: <Megaphone size={12} />, label: t('admin.cc.actionBroadcast'), onClick: () => toast.push('success', 'TODO') },
                { icon: <Wrench size={12} />, label: t('admin.cc.actionMaintenance'), onClick: () => toast.push('success', 'TODO') },
              ].map((a, i) => (
                <button
                  key={i}
                  onClick={a.onClick}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8,
                    border: '1px solid var(--wsl-border, #E5E7EB)', background: '#fff', cursor: 'pointer',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 11,
                    color: 'var(--wsl-ink-2, #374151)',
                  }}
                >
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grant tokens modal */}
        {grantModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setGrantModal(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                position: 'relative', background: '#fff', borderRadius: 16, padding: 24,
                width: '90%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              }}
            >
              <h3 style={{
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 900, fontSize: 16,
                marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Coins size={16} style={{ color: '#14b8a6' }} />
                {t('admin.cc.cohortGrantTokens')}
              </h3>
              <input
                type="number" value={grantAmount}
                onChange={(e) => setGrantAmount(parseInt(e.target.value) || 0)}
                dir="ltr"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  border: '1.5px solid var(--wsl-border, #E5E7EB)',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontSize: 18, fontWeight: 900, outline: 'none',
                  marginBottom: 14, boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setGrantModal(null)}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    border: '1px solid var(--wsl-border, #E5E7EB)', background: '#fff', cursor: 'pointer',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 13,
                  }}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={confirmGrant}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    border: 'none', background: '#14b8a6', color: '#fff', cursor: 'pointer',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 13,
                  }}
                >
                  {isAr ? 'تأكيد' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </>
  );
}
