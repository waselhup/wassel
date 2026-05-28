import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles, Users, MessageSquare, TrendingUp, Copy, Check,
  ChevronDown, ChevronUp, Plus, Loader2, X
} from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import { trpcQuery, trpcMutation } from '@/lib/trpc';

// ─── Types ────────────────────────────────────────────────────────────
interface Metrics {
  total_redemptions: number;
  total_feedback: number;
  avg_nps: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps_score: number;
}

interface PromoCode {
  id: string;
  code: string;
  cohort: string;
  granted_plan: string;
  granted_tokens: number;
  granted_months: number;
  max_redemptions: number;
  redemptions: number;
  actual_redemptions: number;
  notes: string | null;
  expires_at: string;
  created_at: string;
}

interface Feedback {
  id: string;
  user_id: string;
  user_email: string | null;
  pillar: string;
  nps: number;
  what_worked: string | null;
  what_didnt: string | null;
  created_at: string;
}

// ─── Metric Card ──────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-v2-line bg-v2-surface p-4">
      <p className="text-xs text-v2-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: color ?? 'inherit' }}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-v2-muted">{sub}</p>}
    </div>
  );
}

// ─── Create Code Modal ────────────────────────────────────────────────
function CreateCodeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    code: '',
    granted_plan: 'starter' as 'starter' | 'growth',
    granted_tokens: 500,
    granted_months: 3,
    max_redemptions: 1,
    notes: '',
    expires_in_days: 60,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: unknown) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleCreate() {
    if (!form.code.trim()) { setError(t('beta.createCode.errors.codeRequired')); return; }
    setLoading(true);
    setError('');
    try {
      await trpcMutation('beta.createCode', {
        ...form,
        code: form.code.trim().toUpperCase(),
        cohort: 'beta',
      });
      onCreated();
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message ?? t('beta.createCode.errors.failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-v2-canvas p-6 shadow-2xl mx-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-v2-text">{t('beta.createCode.title')}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-v2-surface"><X className="h-4 w-4 text-v2-muted" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-v2-muted">{t('beta.createCode.fields.code')}</label>
            <input
              value={form.code}
              onChange={e => set('code', e.target.value.toUpperCase())}
              placeholder="WASSEL-BETA-AHMED-01"
              className="w-full rounded-lg border border-v2-line bg-v2-surface px-3 py-2 text-sm font-mono text-v2-text focus:border-v2-accent focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-v2-muted">{t('beta.createCode.fields.plan')}</label>
              <select
                value={form.granted_plan}
                onChange={e => set('granted_plan', e.target.value)}
                className="w-full rounded-lg border border-v2-line bg-v2-surface px-3 py-2 text-sm text-v2-text focus:border-v2-accent focus:outline-none"
              >
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-v2-muted">{t('beta.createCode.fields.tokens')}</label>
              <input
                type="number"
                value={form.granted_tokens}
                onChange={e => set('granted_tokens', Number(e.target.value))}
                min={0}
                className="w-full rounded-lg border border-v2-line bg-v2-surface px-3 py-2 text-sm text-v2-text focus:border-v2-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-v2-muted">{t('beta.createCode.fields.months')}</label>
              <input
                type="number"
                value={form.granted_months}
                onChange={e => set('granted_months', Number(e.target.value))}
                min={1} max={12}
                className="w-full rounded-lg border border-v2-line bg-v2-surface px-3 py-2 text-sm text-v2-text focus:border-v2-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-v2-muted">{t('beta.createCode.fields.maxRedemptions')}</label>
              <input
                type="number"
                value={form.max_redemptions}
                onChange={e => set('max_redemptions', Number(e.target.value))}
                min={1} max={100}
                className="w-full rounded-lg border border-v2-line bg-v2-surface px-3 py-2 text-sm text-v2-text focus:border-v2-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-v2-muted">{t('beta.createCode.fields.expiresDays')}</label>
              <input
                type="number"
                value={form.expires_in_days}
                onChange={e => set('expires_in_days', Number(e.target.value))}
                min={1} max={365}
                className="w-full rounded-lg border border-v2-line bg-v2-surface px-3 py-2 text-sm text-v2-text focus:border-v2-accent focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-v2-muted">{t('beta.createCode.fields.notes')}</label>
            <input
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder={t('beta.createCode.fields.notesPlaceholder')}
              className="w-full rounded-lg border border-v2-line bg-v2-surface px-3 py-2 text-sm text-v2-text focus:border-v2-accent focus:outline-none"
            />
          </div>
        </div>

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-v2-accent py-2.5 text-sm font-medium text-white hover:bg-v2-accent/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t('beta.createCode.create')}
        </button>
      </div>
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button onClick={copy} className="rounded p-1 hover:bg-v2-line transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-v2-muted" />}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────
export default function Beta() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pillarFilter, setPillarFilter] = useState('');

  async function loadAll() {
    setLoadingMetrics(true);
    setLoadingCodes(true);
    setLoadingFeedback(true);
    await Promise.all([
      trpcQuery('beta.getMetrics').then(d => { setMetrics(d as Metrics); setLoadingMetrics(false); }).catch(() => setLoadingMetrics(false)),
      trpcQuery('beta.listCodes').then(d => { setCodes((d ?? []) as PromoCode[]); setLoadingCodes(false); }).catch(() => setLoadingCodes(false)),
      trpcQuery<Feedback[]>('beta.listFeedback', { limit: 100 }).then(d => { setFeedback(d ?? []); setLoadingFeedback(false); }).catch(() => setLoadingFeedback(false)),
    ]);
  }

  useEffect(() => { loadAll(); }, []);

  const filteredFeedback = pillarFilter
    ? feedback.filter(f => f.pillar === pillarFilter)
    : feedback;

  const npsColor = (score: number) =>
    score >= 50 ? '#10B981' : score >= 0 ? '#F59E0B' : '#EF4444';

  const pillars = ['general', 'radar', 'resume', 'content', 'dashboard'];

  return (
    <PortalLayout
      persona="admin"
      title={t('beta.dashboard.title')}
      accentColor="#A855F7"
      Icon={Sparkles}
    >
      {/* Section 1: Metrics */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-v2-muted uppercase tracking-wide">
          {t('beta.dashboard.metricsTitle')}
        </h2>
        {loadingMetrics ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-v2-surface animate-pulse" />
            ))}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label={t('beta.dashboard.totalUsers')} value={metrics.total_redemptions} />
            <MetricCard label={t('beta.dashboard.totalFeedback')} value={metrics.total_feedback} />
            <MetricCard label={t('beta.dashboard.avgNps')} value={metrics.avg_nps.toFixed(1)} />
            <MetricCard
              label={t('beta.dashboard.npsScore')}
              value={metrics.nps_score > 0 ? `+${metrics.nps_score}` : metrics.nps_score}
              sub={`P:${metrics.promoters} Pa:${metrics.passives} D:${metrics.detractors}`}
              color={npsColor(metrics.nps_score)}
            />
          </div>
        ) : (
          <p className="text-sm text-v2-muted">{t('beta.dashboard.noData')}</p>
        )}
      </section>

      {/* Section 2: Promo Codes */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-v2-muted uppercase tracking-wide">
            {t('beta.dashboard.codesTitle')}
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-v2-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-v2-accent/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('beta.dashboard.createCode')}
          </button>
        </div>

        {loadingCodes ? (
          <div className="h-32 rounded-xl bg-v2-surface animate-pulse" />
        ) : codes.length === 0 ? (
          <p className="text-sm text-v2-muted">{t('beta.dashboard.noCodes')}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-v2-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-v2-line bg-v2-surface text-left text-xs text-v2-muted">
                  <th className="px-4 py-2.5">{t('beta.table.code')}</th>
                  <th className="px-4 py-2.5">{t('beta.table.plan')}</th>
                  <th className="px-4 py-2.5">{t('beta.table.tokens')}</th>
                  <th className="px-4 py-2.5">{t('beta.table.redemptions')}</th>
                  <th className="px-4 py-2.5">{t('beta.table.expires')}</th>
                  <th className="px-4 py-2.5">{t('beta.table.notes')}</th>
                </tr>
              </thead>
              <tbody>
                {codes.map(c => (
                  <tr key={c.id} className="border-b border-v2-line last:border-0 hover:bg-v2-surface/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-v2-text">{c.code}</span>
                        <CopyButton text={c.code} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-v2-muted capitalize">{c.granted_plan}</td>
                    <td className="px-4 py-2.5 text-v2-muted">{c.granted_tokens}</td>
                    <td className="px-4 py-2.5">
                      <span className={`font-medium ${c.actual_redemptions >= c.max_redemptions ? 'text-v2-muted line-through' : 'text-v2-text'}`}>
                        {c.actual_redemptions}/{c.max_redemptions}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-v2-muted">
                      {new Date(c.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-v2-muted max-w-[160px] truncate">{c.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 3: Feedback */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-v2-muted uppercase tracking-wide me-auto">
            {t('beta.dashboard.feedbackTitle')}
          </h2>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setPillarFilter('')}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                pillarFilter === '' ? 'bg-v2-accent text-white' : 'bg-v2-surface text-v2-muted hover:text-v2-text'
              }`}
            >
              {t('beta.dashboard.allPillars')}
            </button>
            {pillars.map(p => (
              <button
                key={p}
                onClick={() => setPillarFilter(p)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  pillarFilter === p ? 'bg-v2-accent text-white' : 'bg-v2-surface text-v2-muted hover:text-v2-text'
                }`}
              >
                {t(`beta.feedback.pillars.${p}`)}
              </button>
            ))}
          </div>
        </div>

        {loadingFeedback ? (
          <div className="h-40 rounded-xl bg-v2-surface animate-pulse" />
        ) : filteredFeedback.length === 0 ? (
          <p className="text-sm text-v2-muted">{t('beta.dashboard.noFeedback')}</p>
        ) : (
          <div className="space-y-2">
            {filteredFeedback.map(f => {
              const expanded = expandedFeedback === f.id;
              const hasDetails = f.what_worked || f.what_didnt;
              return (
                <div key={f.id} className="rounded-xl border border-v2-line bg-v2-surface">
                  <div
                    className="flex cursor-pointer items-center gap-3 px-4 py-3"
                    onClick={() => hasDetails && setExpandedFeedback(expanded ? null : f.id)}
                  >
                    <span className="text-xl">{['😡','😣','😕','😐','😐','🙂','🙂','😊','😄','😁','🤩'][f.nps]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${
                          f.nps >= 9 ? 'text-emerald-500' : f.nps >= 7 ? 'text-amber-500' : 'text-red-500'
                        }`}>{f.nps}/10</span>
                        <span className="rounded-full bg-v2-line px-2 py-0.5 text-xs text-v2-muted capitalize">{f.pillar}</span>
                        <span className="text-xs text-v2-muted truncate">{f.user_email ?? f.user_id.slice(0, 8)}</span>
                      </div>
                      <p className="text-xs text-v2-muted">{new Date(f.created_at).toLocaleString()}</p>
                    </div>
                    {hasDetails && (
                      expanded ? <ChevronUp className="h-4 w-4 text-v2-muted shrink-0" /> : <ChevronDown className="h-4 w-4 text-v2-muted shrink-0" />
                    )}
                  </div>
                  {expanded && hasDetails && (
                    <div className="border-t border-v2-line px-4 py-3 space-y-2">
                      {f.what_worked && (
                        <div>
                          <p className="text-xs font-medium text-emerald-600 mb-0.5">{t('beta.feedback.whatWorked')}</p>
                          <p className="text-sm text-v2-text">{f.what_worked}</p>
                        </div>
                      )}
                      {f.what_didnt && (
                        <div>
                          <p className="text-xs font-medium text-red-500 mb-0.5">{t('beta.feedback.whatDidnt')}</p>
                          <p className="text-sm text-v2-text">{f.what_didnt}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showCreateModal && (
        <CreateCodeModal
          onClose={() => setShowCreateModal(false)}
          onCreated={loadAll}
        />
      )}
    </PortalLayout>
  );
}
