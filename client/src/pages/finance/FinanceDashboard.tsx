import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Wallet, TrendingUp, AlertTriangle, RefreshCw, AlertOctagon,
  CheckCircle2, XCircle, Edit3, Download, FileSpreadsheet,
  ReceiptText, RefreshCcw, DollarSign, BarChart3, PieChart,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';
import Sparkline from '@/pages/admin/_dashboard/Sparkline';
import StatTile, { type Verdict } from '@/pages/admin/_dashboard/StatTile';
import Waterfall from './_dashboard/Waterfall';
import PlanDonut from './_dashboard/PlanDonut';
import PaymentTable from './_dashboard/PaymentTable';
import CostBar from './_dashboard/CostBar';

const ADMIN_EMAILS = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];

interface Toast { id: number; type: 'success' | 'error'; message: string }
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
          <motion.div key={t.id}
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}
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

const sectionHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
  flexWrap: 'wrap', gap: 8, marginBottom: 14,
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

function LoadingBox({ height = 120 }: { height?: number }) {
  return (
    <div style={{
      height, borderRadius: 14,
      background: 'linear-gradient(90deg, #F9FAFB, #F3F4F6, #F9FAFB)',
      backgroundSize: '200% 100%', animation: 'wsl-shimmer 1.4s linear infinite',
    }} />
  );
}

function ErrorBox({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry?: () => void }) {
  return (
    <div style={{
      padding: 16, borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <AlertTriangle size={16} style={{ color: '#DC2626', flexShrink: 0 }} />
      <div style={{
        flex: 1, fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        fontSize: 12, color: '#991B1B', fontWeight: 700,
      }}>{message}</div>
      {onRetry && (
        <button onClick={onRetry} style={{
          padding: '6px 12px', borderRadius: 8, background: '#DC2626', color: '#fff',
          border: 'none', cursor: 'pointer',
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 11,
        }}>{retryLabel}</button>
      )}
    </div>
  );
}

const PLAN_COLOR: Record<string, string> = {
  free: '#9CA3AF',
  starter: '#3B82F6',
  pro: '#14b8a6',
  elite: '#8B5CF6',
};

export default function FinanceDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isAr = i18n.language === 'ar';
  const toast = useToast();
  const isAdmin = ADMIN_EMAILS.includes(user?.email || '');

  const [pulse, setPulse] = useState<any>(null);
  const [waterfall, setWaterfall] = useState<any>(null);
  const [planBreakdown, setPlanBreakdown] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);
  const [costControl, setCostControl] = useState<any>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({
    pulse: true, waterfall: true, plans: true, payments: true, costs: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Setting-edit modal
  const [settingModal, setSettingModal] = useState<null | {
    key: 'cash_on_hand_sar' | 'usd_sar_rate' | 'apify_monthly_cost_usd' | 'infra_monthly_cost_usd';
    label: string;
    current: number;
  }>(null);
  const [settingValue, setSettingValue] = useState(0);

  // Invoice modal
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ userId: '', amountSar: 199, description: '' });
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  // Refund modal
  const [refundModal, setRefundModal] = useState(false);
  const [refundForm, setRefundForm] = useState({ moyasarPaymentId: '', reason: '' });

  async function load<T>(key: string, fn: () => Promise<T>, setter: (v: T) => void) {
    setLoading((s) => ({ ...s, [key]: true }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
    try { setter(await fn()); }
    catch (e: any) { setErrors((er) => ({ ...er, [key]: e?.message || 'Failed' })); }
    finally { setLoading((s) => ({ ...s, [key]: false })); }
  }

  function loadAll() {
    load('pulse', () => trpc.finance.pulse(), setPulse);
    load('waterfall', () => trpc.finance.waterfall(), setWaterfall);
    load('plans', () => trpc.finance.planBreakdown(), setPlanBreakdown);
    load('payments', () => trpc.finance.payments({ limit: 10 }), setPayments);
    load('costs', () => trpc.finance.costControl(), setCostControl);
  }

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin]);

  async function commitSetting() {
    if (!settingModal) return;
    try {
      await trpc.finance.updateSetting({ key: settingModal.key, value: settingValue });
      toast.push('success', isAr ? 'تم التحديث' : 'Updated');
      setSettingModal(null);
      loadAll();
    } catch (e: any) { toast.push('error', e?.message || 'Failed'); }
  }

  async function submitInvoice() {
    try {
      const res = await trpc.finance.generateInvoice(invoiceForm);
      setInvoiceUrl(res.invoiceUrl);
      toast.push('success', isAr ? 'تم إنشاء الفاتورة' : 'Invoice created');
    } catch (e: any) { toast.push('error', e?.message || 'Failed'); }
  }

  async function submitRefund() {
    try {
      const res = await trpc.finance.refundPayment(refundForm);
      toast.push('success', `${isAr ? 'تم تسجيل الاسترجاع' : 'Refund recorded'}: ${res.note}`);
      setRefundModal(false);
      setRefundForm({ moyasarPaymentId: '', reason: '' });
    } catch (e: any) { toast.push('error', e?.message || 'Failed'); }
  }

  async function exportThisMonth() {
    try {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const res = await trpc.finance.exportCsv({ month: ym });
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = res.filename; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.push('success', `${isAr ? 'تم التصدير' : 'Exported'} (${res.totalRows})`);
    } catch (e: any) { toast.push('error', e?.message || 'Failed'); }
  }

  // ─── Derived ───
  function verdictRevenue(today: number, last: number): Verdict {
    const d = last > 0 ? ((today - last) / last) * 100 : 0;
    if (d < -20) return 'fire';
    if (d < 0) return 'watch';
    return 'healthy';
  }
  function verdictMargin(m: number): Verdict {
    if (m < 30) return 'fire';
    if (m < 50) return 'watch';
    return 'healthy';
  }
  function verdictChurn(n: number): Verdict {
    if (n === 0) return 'healthy';
    if (n >= 5) return 'fire';
    return 'watch';
  }
  const verdictLabel = (v: Verdict) =>
    t(`admin.cc.verdict${v.charAt(0).toUpperCase() + v.slice(1)}`);

  const fmtNum = (n: number) => (n || 0).toLocaleString('en-US');
  const fmtSar = (n: number) => `${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${t('finance.sarSuffix')}`;
  const fmtUsd = (n: number) => `$${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`;
  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch { return '—'; }
  };

  const planSlices = useMemo(() => {
    if (!planBreakdown?.breakdown) return [];
    return (planBreakdown.breakdown as any[])
      .filter((r) => r.mrr > 0)
      .map((r) => ({
        key: r.plan,
        label: r.plan,
        value: r.mrr,
        color: PLAN_COLOR[r.plan] || '#9CA3AF',
      }));
  }, [planBreakdown]);

  const costSegments = useMemo(() => {
    if (!costControl?.apiBreakdown) return [];
    const colorByKey: Record<string, string> = {
      sonnet: '#8B5CF6',
      haiku: '#14b8a6',
      apify: '#F59E0B',
      infra: '#9CA3AF',
    };
    const labelByKey: Record<string, string> = {
      sonnet: t('finance.costSonnet'),
      haiku: t('finance.costHaiku'),
      apify: t('finance.costApify'),
      infra: t('finance.costInfra'),
    };
    return costControl.apiBreakdown.map((s: any) => ({
      ...s,
      color: colorByKey[s.key] || '#9CA3AF',
      label: labelByKey[s.key] || s.key,
    }));
  }, [costControl, t]);

  if (!isAdmin) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Wallet size={48} style={{ color: '#DC2626', margin: '0 auto 16px' }} />
        <div style={{ fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 900, fontSize: 20, color: '#DC2626' }}>
          {isAr ? 'غير مصرّح' : 'Unauthorized'}
        </div>
      </div>
    );
  }

  return (
    <>
      <toast.View />
      <style>{`@keyframes wsl-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div style={{ margin: '0 auto', padding: '0 4px' }}>
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}
        >
          <div style={{ fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 500, fontSize: 13, color: 'var(--wsl-ink-3, #6B7280)' }}>
            {t('finance.subtitle')}
          </div>
          <button onClick={loadAll} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            borderRadius: 10, border: '1px solid var(--wsl-border, #E5E7EB)',
            background: '#fff', cursor: 'pointer',
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 12,
            color: 'var(--wsl-ink-2, #374151)',
          }}>
            <RefreshCw size={13} /> {t('admin.cc.refresh')}
          </button>
        </motion.div>

        {/* ═══ F1 — Financial Pulse ═══ */}
        <div style={sectionWrap}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>
              <DollarSign size={16} style={{ color: '#D4AF37' }} />
              {t('finance.s1Title')}
            </h2>
          </div>
          {errors.pulse ? (
            <ErrorBox message={errors.pulse} retryLabel={t('admin.cc.retry')} onRetry={() => load('pulse', () => trpc.finance.pulse(), setPulse)} />
          ) : loading.pulse ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              {Array.from({ length: 6 }).map((_, i) => <LoadingBox key={i} height={150} />)}
            </div>
          ) : pulse ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <StatTile index={0} icon={<Wallet size={14} />}
                label={t('finance.tileMrr')} value={fmtSar(pulse.mrr.today)}
                today={pulse.mrr.today} yesterday={pulse.mrr.lastMonth}
                spark={pulse.mrr.spark}
                verdict="healthy" verdictLabel={verdictLabel('healthy')}
              />
              <StatTile index={1} icon={<TrendingUp size={14} />}
                label={t('finance.tileArr')} value={fmtSar(pulse.arr.today)}
                today={pulse.arr.today} yesterday={pulse.arr.lastMonth}
                spark={pulse.arr.spark}
                verdict="healthy" verdictLabel={verdictLabel('healthy')}
              />
              <StatTile index={2} icon={<BarChart3 size={14} />}
                label={t('finance.tileNewRev')} value={fmtSar(pulse.newRevenue.today)}
                today={pulse.newRevenue.today} yesterday={pulse.newRevenue.lastMonth}
                spark={pulse.newRevenue.spark}
                verdict={verdictRevenue(pulse.newRevenue.today, pulse.newRevenue.lastMonth)}
                verdictLabel={verdictLabel(verdictRevenue(pulse.newRevenue.today, pulse.newRevenue.lastMonth))}
              />
              <StatTile index={3} icon={<AlertOctagon size={14} />}
                label={t('finance.tileChurn')} value={`${pulse.churn.today} · ${fmtSar(pulse.churn.lostMrr)}`}
                today={pulse.churn.today} yesterday={pulse.churn.lastMonth}
                spark={pulse.churn.spark}
                verdict={verdictChurn(pulse.churn.today)}
                verdictLabel={verdictLabel(verdictChurn(pulse.churn.today))}
              />
              <StatTile index={4} icon={<PieChart size={14} />}
                label={t('finance.tileMargin')} value={`${pulse.netMargin.today}%`}
                today={pulse.netMargin.today} yesterday={pulse.netMargin.lastMonth}
                spark={pulse.netMargin.spark}
                verdict={verdictMargin(pulse.netMargin.today)}
                verdictLabel={verdictLabel(verdictMargin(pulse.netMargin.today))}
              />
              <div style={{
                ...cardSurface,
                position: 'relative',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: 'var(--wsl-ink-3, #6B7280)',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                    textTransform: 'uppercase', letterSpacing: 0.4,
                  }}>
                    {t('finance.tileCash')}
                  </span>
                  <button
                    onClick={() => {
                      setSettingModal({ key: 'cash_on_hand_sar', label: t('finance.tileCash'), current: pulse.cashOnHand.today });
                      setSettingValue(pulse.cashOnHand.today);
                    }}
                    aria-label="edit-cash"
                    style={{
                      width: 26, height: 26, borderRadius: 6,
                      background: '#F9FAFB', color: '#D4AF37',
                      border: '1px solid var(--wsl-border, #E5E7EB)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  ><Edit3 size={12} /></button>
                </div>
                <div dir="ltr" style={{
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 900, fontSize: 28, color: 'var(--wsl-ink, #0F172A)',
                  fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
                }}>
                  {fmtSar(pulse.cashOnHand.today)}
                </div>
                <Sparkline data={pulse.cashOnHand.spark} stroke="#D4AF37" fill="rgba(212, 175, 55, 0.15)" width={140} height={24} />
                <div style={{
                  fontSize: 10, fontWeight: 900, color: '#D4AF37',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {t('finance.cashManual')}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* ═══ F2 — Revenue Waterfall ═══ */}
        <div style={sectionWrap}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>
                <TrendingUp size={16} style={{ color: '#D4AF37' }} />
                {t('finance.s2Title')}
              </h2>
              <div style={{ ...sectionSub, marginTop: 4 }}>{t('finance.s2Subtitle')}</div>
            </div>
          </div>
          <div style={cardSurface}>
            {errors.waterfall ? (
              <ErrorBox message={errors.waterfall} retryLabel={t('admin.cc.retry')} onRetry={() => load('waterfall', () => trpc.finance.waterfall(), setWaterfall)} />
            ) : loading.waterfall ? (
              <LoadingBox height={280} />
            ) : waterfall ? (
              <Waterfall {...waterfall}
                labels={{
                  starting: t('finance.wfStarting'),
                  newMrr: t('finance.wfNew'),
                  expansion: t('finance.wfExpansion'),
                  churned: t('finance.wfChurned'),
                  ending: t('finance.wfEnding'),
                }}
                fmtSar={fmtSar}
              />
            ) : null}
          </div>
        </div>

        {/* ═══ F3 — Plan Breakdown ═══ */}
        <div style={sectionWrap}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>
              <PieChart size={16} style={{ color: '#D4AF37' }} />
              {t('finance.s3Title')}
            </h2>
          </div>
          {errors.plans ? (
            <ErrorBox message={errors.plans} retryLabel={t('admin.cc.retry')} onRetry={() => load('plans', () => trpc.finance.planBreakdown(), setPlanBreakdown)} />
          ) : loading.plans ? (
            <LoadingBox height={280} />
          ) : planBreakdown ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 14 }}>
              <div style={{ ...cardSurface, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <PlanDonut
                  slices={planSlices}
                  centerLabel={t('finance.tileMrr')}
                  centerValue={fmtSar(planBreakdown.totalMrr)}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {planSlices.map((s) => (
                    <span key={s.key} dir="ltr" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px',
                      borderRadius: 999, background: s.color + '15', color: s.color,
                      fontSize: 10, fontWeight: 900,
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                      textTransform: 'capitalize',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>

              <div style={cardSurface}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--wsl-border, #E5E7EB)' }}>
                      {[t('finance.plan'), t('finance.users'), t('finance.mrr'), '% MRR', t('finance.avgTokens'), t('finance.costPerUser'), t('finance.margin')].map((h) => (
                        <th key={h} style={{
                          padding: '8px 8px', textAlign: 'start',
                          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                          fontWeight: 900, fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)',
                          textTransform: 'uppercase', letterSpacing: 0.4,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {planBreakdown.breakdown.map((r: any) => {
                      const marginColor = r.marginPercent === null ? '#9CA3AF'
                        : r.marginPercent < 30 ? '#DC2626'
                        : r.marginPercent < 60 ? '#F59E0B'
                        : '#10B981';
                      return (
                        <tr key={r.plan} style={{ borderBottom: '1px solid var(--wsl-border, #E5E7EB)' }}>
                          <td style={{ padding: '10px 8px' }}>
                            <span dir="ltr" style={{
                              padding: '2px 8px', borderRadius: 999,
                              background: (PLAN_COLOR[r.plan] || '#9CA3AF') + '15',
                              color: PLAN_COLOR[r.plan] || '#9CA3AF',
                              fontSize: 10, fontWeight: 900, textTransform: 'capitalize',
                              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                            }}>{r.plan}</span>
                          </td>
                          <td dir="ltr" style={{ padding: '10px 8px', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.users)}</td>
                          <td dir="ltr" style={{ padding: '10px 8px', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 12, color: '#D4AF37', fontVariantNumeric: 'tabular-nums' }}>{fmtSar(r.mrr)}</td>
                          <td dir="ltr" style={{ padding: '10px 8px', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 700, fontSize: 11, color: 'var(--wsl-ink-3, #6B7280)', fontVariantNumeric: 'tabular-nums' }}>{fmtPct(r.percentOfMrr)}</td>
                          <td dir="ltr" style={{ padding: '10px 8px', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 700, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.avgTokensPerMonth)}</td>
                          <td dir="ltr" style={{ padding: '10px 8px', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 700, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{fmtSar(r.costPerUserSar)}</td>
                          <td dir="ltr" style={{ padding: '10px 8px', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 900, fontSize: 11, color: marginColor, fontVariantNumeric: 'tabular-nums' }}>
                            {r.marginPercent !== null ? `${r.marginPercent.toFixed(0)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        {/* ═══ F4 — Payment Activity ═══ */}
        <div style={sectionWrap}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>
              <ReceiptText size={16} style={{ color: '#D4AF37' }} />
              {t('finance.s4Title')}
            </h2>
          </div>
          {errors.payments ? (
            <ErrorBox message={errors.payments} retryLabel={t('admin.cc.retry')} onRetry={() => load('payments', () => trpc.finance.payments({ limit: 10 }), setPayments)} />
          ) : loading.payments ? (
            <LoadingBox height={260} />
          ) : payments ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
              <div style={cardSurface}>
                <div style={{ ...sectionTitle, fontSize: 14, marginBottom: 12 }}>
                  ✅ {t('finance.cardSuccessful')}
                </div>
                <PaymentTable rows={payments.successful} variant="success" emptyLabel={t('finance.noSuccess')} fmtSar={fmtSar} fmtDate={fmtDate} isAr={isAr} />
              </div>
              <div style={cardSurface}>
                <div style={{ ...sectionTitle, fontSize: 14, marginBottom: 12 }}>
                  ⚠️ {t('finance.cardFailed')}
                </div>
                <PaymentTable rows={payments.failed} variant="failed" emptyLabel={t('finance.noFailed')} fmtSar={fmtSar} fmtDate={fmtDate} isAr={isAr} />
              </div>
              <div style={cardSurface}>
                <div style={{ ...sectionTitle, fontSize: 14, marginBottom: 12 }}>
                  💸 {t('finance.cardRefunds')}
                </div>
                <PaymentTable rows={payments.refunds} variant="refund" emptyLabel={t('finance.noRefunds')} fmtSar={fmtSar} fmtDate={fmtDate} isAr={isAr} />
              </div>
            </div>
          ) : null}
        </div>

        {/* ═══ F5 — Cost Control ═══ */}
        <div style={sectionWrap}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>
              <BarChart3 size={16} style={{ color: '#D4AF37' }} />
              {t('finance.s5Title')}
            </h2>
          </div>
          {errors.costs ? (
            <ErrorBox message={errors.costs} retryLabel={t('admin.cc.retry')} onRetry={() => load('costs', () => trpc.finance.costControl(), setCostControl)} />
          ) : loading.costs ? (
            <LoadingBox height={280} />
          ) : costControl ? (
            <>
              {costControl.negativeMarginAlert && (
                <div style={{
                  marginBottom: 14, padding: '12px 16px', borderRadius: 12,
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  color: '#991B1B', fontWeight: 800, fontSize: 13,
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <AlertOctagon size={16} />
                  {t('finance.negativeMarginAlert', {
                    plan: costControl.negativeMarginAlert.plan,
                    email: costControl.negativeMarginAlert.email || '—',
                    overSar: Math.abs(Math.round(costControl.negativeMarginAlert.net_margin_sar)),
                  })}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
                <div style={cardSurface}>
                  <div style={{ ...sectionTitle, fontSize: 14, marginBottom: 12 }}>
                    {t('finance.costBreakdownTitle')}
                  </div>
                  <CostBar
                    segments={costSegments}
                    totalUsd={costControl.totalCostUsd}
                    totalSar={costControl.totalCostSar}
                    fmtUsd={fmtUsd}
                    fmtSar={fmtSar}
                  />
                </div>

                <div style={cardSurface}>
                  <div style={{ ...sectionTitle, fontSize: 14, marginBottom: 12 }}>
                    {t('finance.topDriversTitle')}
                  </div>
                  {costControl.topDrivers.length === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--wsl-ink-3, #6B7280)', fontSize: 12 }}>—</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {costControl.topDrivers.map((d: any) => (
                        <div key={d.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 8, background: '#F9FAFB',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                              fontWeight: 800, fontSize: 12, color: 'var(--wsl-ink, #0F172A)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {d.full_name || d.email}
                              <span dir="ltr" style={{
                                marginInlineStart: 6, padding: '1px 6px', borderRadius: 4,
                                background: (PLAN_COLOR[d.plan] || '#9CA3AF') + '15',
                                color: PLAN_COLOR[d.plan] || '#9CA3AF',
                                fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                              }}>{d.plan}</span>
                            </div>
                          </div>
                          <span dir="ltr" style={{
                            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                            fontWeight: 700, fontSize: 11, color: '#DC2626',
                            fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'end',
                          }}>−{fmtSar(d.cost_sar)}</span>
                          <span dir="ltr" style={{
                            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                            fontWeight: 700, fontSize: 11, color: '#10B981',
                            fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'end',
                          }}>+{fmtSar(d.revenue_sar)}</span>
                          <span dir="ltr" style={{
                            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                            fontWeight: 900, fontSize: 11,
                            color: d.net_margin_sar >= 0 ? '#10B981' : '#DC2626',
                            fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'end',
                          }}>{d.net_margin_sar >= 0 ? '+' : ''}{fmtSar(d.net_margin_sar)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* ═══ F6 — Actions & Exports ═══ */}
        <div style={sectionWrap}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>
              <FileSpreadsheet size={16} style={{ color: '#D4AF37' }} />
              {t('finance.s6Title')}
            </h2>
          </div>
          <div style={cardSurface}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { icon: <Download size={12} />, label: t('finance.actionExport'), onClick: exportThisMonth },
                { icon: <FileSpreadsheet size={12} />, label: t('finance.actionVat'), onClick: exportThisMonth },
                { icon: <ReceiptText size={12} />, label: t('finance.actionInvoice'), onClick: () => setInvoiceModal(true) },
                { icon: <RefreshCcw size={12} />, label: t('finance.actionRefund'), onClick: () => setRefundModal(true) },
                {
                  icon: <Edit3 size={12} />,
                  label: t('finance.actionEditCash'),
                  onClick: () => {
                    setSettingModal({ key: 'cash_on_hand_sar', label: t('finance.tileCash'), current: pulse?.cashOnHand.today || 0 });
                    setSettingValue(pulse?.cashOnHand.today || 0);
                  },
                },
                {
                  icon: <Edit3 size={12} />,
                  label: t('finance.actionEditRate'),
                  onClick: () => {
                    setSettingModal({ key: 'usd_sar_rate', label: t('finance.usdRate'), current: 3.75 });
                    setSettingValue(3.75);
                  },
                },
              ].map((a, i) => (
                <button key={i} onClick={a.onClick} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8,
                  border: '1px solid var(--wsl-border, #E5E7EB)', background: '#fff', cursor: 'pointer',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 11,
                  color: 'var(--wsl-ink-2, #374151)',
                }}>{a.icon} {a.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Setting modal */}
        {settingModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setSettingModal(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{
                position: 'relative', background: '#fff', borderRadius: 16, padding: 24,
                width: '90%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              }}>
              <h3 style={{ fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 900, fontSize: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={16} style={{ color: '#D4AF37' }} /> {settingModal.label}
              </h3>
              <input type="number" value={settingValue} onChange={(e) => setSettingValue(parseFloat(e.target.value) || 0)} step="0.01" dir="ltr"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  border: '1.5px solid var(--wsl-border, #E5E7EB)',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontSize: 18, fontWeight: 900, outline: 'none',
                  marginBottom: 14, boxSizing: 'border-box',
                }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setSettingModal(null)} style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: '1px solid var(--wsl-border, #E5E7EB)', background: '#fff', cursor: 'pointer',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 13,
                }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button onClick={commitSetting} style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: 'none', background: '#D4AF37', color: '#fff', cursor: 'pointer',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 13,
                }}>{isAr ? 'حفظ' : 'Save'}</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Invoice modal */}
        {invoiceModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => { setInvoiceModal(false); setInvoiceUrl(null); }} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h3 style={{ fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 900, fontSize: 16, marginBottom: 14 }}>
                {t('finance.invoiceTitle')}
              </h3>
              {invoiceUrl ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--wsl-ink-3, #6B7280)', marginBottom: 8, fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>
                    {t('finance.invoiceReady')}
                  </div>
                  <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" dir="ltr" style={{
                    display: 'block', padding: '10px 12px', borderRadius: 10,
                    background: '#F9FAFB', border: '1px solid var(--wsl-border, #E5E7EB)',
                    fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', color: '#D4AF37', textDecoration: 'none', marginBottom: 14,
                  }}>{invoiceUrl}</a>
                  <button onClick={() => { setInvoiceModal(false); setInvoiceUrl(null); }} style={{
                    width: '100%', padding: '10px', borderRadius: 8,
                    border: 'none', background: '#D4AF37', color: '#fff', cursor: 'pointer',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 13,
                  }}>{isAr ? 'تم' : 'Done'}</button>
                </>
              ) : (
                <>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--wsl-ink-3, #6B7280)', marginBottom: 4, fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>{t('finance.invoiceUserId')}</label>
                  <input value={invoiceForm.userId} onChange={(e) => setInvoiceForm((f) => ({ ...f, userId: e.target.value }))} placeholder="uuid"
                    dir="ltr" style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8,
                      border: '1.5px solid var(--wsl-border, #E5E7EB)',
                      fontFamily: 'monospace', fontSize: 11, outline: 'none',
                      marginBottom: 10, boxSizing: 'border-box',
                    }} />
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--wsl-ink-3, #6B7280)', marginBottom: 4, fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>{t('finance.invoiceAmount')}</label>
                  <input type="number" value={invoiceForm.amountSar} onChange={(e) => setInvoiceForm((f) => ({ ...f, amountSar: parseFloat(e.target.value) || 0 }))}
                    dir="ltr" style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8,
                      border: '1.5px solid var(--wsl-border, #E5E7EB)',
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                      fontSize: 14, fontWeight: 800, outline: 'none',
                      marginBottom: 10, boxSizing: 'border-box',
                    }} />
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--wsl-ink-3, #6B7280)', marginBottom: 4, fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>{t('finance.invoiceDesc')}</label>
                  <input value={invoiceForm.description} onChange={(e) => setInvoiceForm((f) => ({ ...f, description: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8,
                      border: '1.5px solid var(--wsl-border, #E5E7EB)',
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                      fontSize: 13, outline: 'none',
                      marginBottom: 14, boxSizing: 'border-box',
                    }} />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setInvoiceModal(false)} style={{
                      padding: '8px 16px', borderRadius: 8,
                      border: '1px solid var(--wsl-border, #E5E7EB)', background: '#fff', cursor: 'pointer',
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 13,
                    }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                    <button onClick={submitInvoice} style={{
                      padding: '8px 16px', borderRadius: 8,
                      border: 'none', background: '#D4AF37', color: '#fff', cursor: 'pointer',
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 13,
                    }}>{isAr ? 'إنشاء' : 'Generate'}</button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}

        {/* Refund modal */}
        {refundModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setRefundModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h3 style={{ fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 900, fontSize: 16, marginBottom: 14 }}>
                {t('finance.refundTitle')}
              </h3>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--wsl-ink-3, #6B7280)', marginBottom: 4, fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>{t('finance.refundPaymentId')}</label>
              <input value={refundForm.moyasarPaymentId} onChange={(e) => setRefundForm((f) => ({ ...f, moyasarPaymentId: e.target.value }))} placeholder="pay_..."
                dir="ltr" style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1.5px solid var(--wsl-border, #E5E7EB)',
                  fontFamily: 'monospace', fontSize: 11, outline: 'none',
                  marginBottom: 10, boxSizing: 'border-box',
                }} />
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--wsl-ink-3, #6B7280)', marginBottom: 4, fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>{t('finance.refundReason')}</label>
              <textarea value={refundForm.reason} onChange={(e) => setRefundForm((f) => ({ ...f, reason: e.target.value }))} rows={3}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1.5px solid var(--wsl-border, #E5E7EB)',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontSize: 13, outline: 'none', resize: 'none',
                  marginBottom: 14, boxSizing: 'border-box',
                }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setRefundModal(false)} style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: '1px solid var(--wsl-border, #E5E7EB)', background: '#fff', cursor: 'pointer',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 13,
                }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button onClick={submitRefund} style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: 'none', background: '#DC2626', color: '#fff', cursor: 'pointer',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 13,
                }}>{isAr ? 'تأكيد الاسترجاع' : 'Confirm refund'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </>
  );
}
