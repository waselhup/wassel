import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus, Sparkles, AlertTriangle, Activity, RefreshCw, ChevronRight,
  Server, CalendarClock, ShieldAlert, Mail, Power, Plus,
  CheckCircle2, X as XIcon, ClipboardList,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import LivePulseTile, { type OpsVerdict } from '@/pages/ops/_dashboard/LivePulseTile';
import SignupFunnel from '@/pages/ops/_dashboard/SignupFunnel';
import LiveSignupFeed from '@/pages/ops/_dashboard/LiveSignupFeed';
import SubscriptionTable from '@/pages/ops/_dashboard/SubscriptionTable';
import ServiceHealthCard from '@/pages/ops/_dashboard/ServiceHealthCard';
import WebhookActivity from '@/pages/ops/_dashboard/WebhookActivity';
import CronStatus from '@/pages/ops/_dashboard/CronStatus';
import IncidentTimeline from '@/pages/ops/_dashboard/IncidentTimeline';

type SubStatus = 'active' | 'expiring' | 'past_due' | 'canceled' | 'new_month';
// (no extra alias) — the client wrapper uses `new_month` for "new this month"

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
  fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink, #0F172A)',
  margin: 0, display: 'flex', alignItems: 'center', gap: 8,
};

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 14,
  border: '1px solid var(--border-subtle, #E5E7EB)',
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

export default function OpsDashboard() {
  const { t } = useTranslation();

  const [pulse, setPulse] = useState<any>(null);
  const [funnel, setFunnel] = useState<any>(null);
  const [feed, setFeed] = useState<any>(null);
  const [subTab, setSubTab] = useState<SubStatus>('active');
  const [subData, setSubData] = useState<any>(null);
  const [servicesHealth, setServicesHealth] = useState<any>(null);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [crons, setCrons] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [resolveModal, setResolveModal] = useState<any | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [newIncidentOpen, setNewIncidentOpen] = useState(false);
  const [newIncident, setNewIncident] = useState({
    severity: 'warning' as 'info' | 'warning' | 'error' | 'critical',
    title: '', description: '', affected_service: '',
  });

  const showToast = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // ----- Initial load -----
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, fn, fd, s, sh, wh, cr, inc] = await Promise.all([
        trpc.ops.pulse(),
        trpc.ops.signupFunnel({ days: 7 }),
        trpc.ops.signupFeed({ limit: 50 }),
        trpc.ops.subscriptions({ status: subTab, limit: 50, offset: 0 }),
        trpc.ops.servicesHealth(),
        trpc.ops.webhooks({ limit: 50 }),
        trpc.ops.crons(),
        trpc.ops.incidents({}),
      ]);
      setPulse(p); setFunnel(fn); setFeed(fd); setSubData(s);
      setServicesHealth(sh); setWebhooks(wh.rows ?? []); setCrons(cr); setIncidents(inc.rows ?? []);
    } catch (e: any) {
      console.error('[ops] load failed', e);
      showToast(e?.message || 'Failed to load', 'err');
    } finally {
      setLoading(false);
    }
  }, [subTab, showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ----- 30s polling for live sections -----
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const [p, fd, sh] = await Promise.all([
          trpc.ops.pulse(),
          trpc.ops.signupFeed({ limit: 50 }),
          trpc.ops.servicesHealth(),
        ]);
        setPulse(p); setFeed(fd); setServicesHealth(sh);
      } catch { /* swallow — neutral state */ }
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  // ----- Sub-tab refresh -----
  useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        const s = await trpc.ops.subscriptions({ status: subTab, limit: 50, offset: 0 });
        setSubData(s);
      } catch (e: any) { showToast(e?.message || 'Failed', 'err'); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  // ----- Tile verdicts -----
  const verdict = useCallback((value: number, watchAt: number, critAt: number, lowerBetter = false): OpsVerdict => {
    if (lowerBetter) {
      if (value >= critAt) return 'critical';
      if (value >= watchAt) return 'watch';
      return 'healthy';
    }
    if (value <= 0) return 'neutral';
    return 'healthy';
  }, []);

  const verdictLabel = (v: OpsVerdict) =>
    v === 'healthy' ? t('admin.cc.verdictHealthy')
    : v === 'watch' ? t('admin.cc.verdictWatch')
    : v === 'critical' ? t('admin.cc.verdictFire')
    : t('admin.cc.verdictNeutral');

  // ----- Actions -----
  const onSubAction = async (row: any, action: 'extend' | 'cancel' | 'mark_paid') => {
    try {
      await trpc.ops.subscriptionAction({ subscriptionId: row.id, action });
      showToast(t('ops.actionApplied'), 'ok');
      const s = await trpc.ops.subscriptions({ status: subTab, limit: 50, offset: 0 });
      setSubData(s);
    } catch (e: any) { showToast(e?.message || 'Failed', 'err'); }
  };

  const onRunHealthCheck = async (service: string) => {
    try {
      await trpc.ops.runHealthCheck({ service });
      const sh = await trpc.ops.servicesHealth();
      setServicesHealth(sh);
      showToast(t('ops.healthChecked'), 'ok');
    } catch (e: any) { showToast(e?.message || 'Failed', 'err'); }
  };

  const onRunAllHealth = async () => {
    try {
      const services = ['supabase_db', 'supabase_auth', 'anthropic', 'apify', 'moyasar', 'vercel', 'telegram'];
      await Promise.all(services.map((s) => trpc.ops.runHealthCheck({ service: s }).catch(() => null)));
      const sh = await trpc.ops.servicesHealth();
      setServicesHealth(sh);
      showToast(t('ops.healthChecked'), 'ok');
    } catch (e: any) { showToast(e?.message || 'Failed', 'err'); }
  };

  const onRetryWebhook = async (id: string) => {
    try {
      await trpc.ops.retryFulfillment({ paymentTransactionId: id });
      showToast(t('ops.retryQueued'), 'ok');
      const wh = await trpc.ops.webhooks({ limit: 50 });
      setWebhooks(wh.rows ?? []);
    } catch (e: any) { showToast(e?.message || 'Failed', 'err'); }
  };

  const onTriggerCron = async (endpoint: string) => {
    try {
      await trpc.ops.triggerCron({ endpoint });
      showToast(t('ops.cronTriggered'), 'ok');
      const cr = await trpc.ops.crons();
      setCrons(cr);
    } catch (e: any) { showToast(e?.message || 'Failed', 'err'); }
  };

  const onAcknowledgeIncident = async (id: string) => {
    try {
      await trpc.ops.updateIncident({ id, status: 'investigating' });
      const inc = await trpc.ops.incidents({});
      setIncidents(inc.rows ?? []);
    } catch (e: any) { showToast(e?.message || 'Failed', 'err'); }
  };

  const onResolveIncident = async () => {
    if (!resolveModal) return;
    try {
      await trpc.ops.updateIncident({ id: resolveModal.id, status: 'resolved', resolution_notes: resolveNotes });
      setResolveModal(null); setResolveNotes('');
      const inc = await trpc.ops.incidents({});
      setIncidents(inc.rows ?? []);
      showToast(t('ops.incidentResolved'), 'ok');
    } catch (e: any) { showToast(e?.message || 'Failed', 'err'); }
  };

  const onDismissIncident = async (id: string) => {
    try {
      await trpc.ops.updateIncident({ id, status: 'dismissed' });
      const inc = await trpc.ops.incidents({});
      setIncidents(inc.rows ?? []);
    } catch (e: any) { showToast(e?.message || 'Failed', 'err'); }
  };

  const onCreateIncident = async () => {
    if (!newIncident.title.trim()) { showToast(t('ops.incidentTitleRequired'), 'err'); return; }
    try {
      await trpc.ops.createIncident({
        severity: newIncident.severity,
        title: newIncident.title.trim(),
        description: newIncident.description.trim() || undefined,
        affected_service: newIncident.affected_service.trim() || undefined,
      });
      setNewIncidentOpen(false);
      setNewIncident({ severity: 'warning', title: '', description: '', affected_service: '' });
      const inc = await trpc.ops.incidents({});
      setIncidents(inc.rows ?? []);
      showToast(t('ops.incidentCreated'), 'ok');
    } catch (e: any) { showToast(e?.message || 'Failed', 'err'); }
  };

  const onToggleMaintenance = async () => {
    const isOn = pulse?.maintenance_mode === true;
    if (!window.confirm(isOn ? t('ops.confirmMaintOff') : t('ops.confirmMaintOn'))) return;
    try {
      await trpc.ops.toggleMaintenanceMode({ enabled: !isOn });
      showToast(isOn ? t('ops.maintOff') : t('ops.maintOn'), 'ok');
      const p = await trpc.ops.pulse();
      setPulse(p);
    } catch (e: any) { showToast(e?.message || 'Failed', 'err'); }
  };

  // ----- Sticky banner when service red -----
  const redService = useMemo(() => {
    const services = servicesHealth?.services || [];
    return services.find((s: any) => s.status === 'critical');
  }, [servicesHealth]);

  const subTabs: { key: SubStatus; labelKey: string; count: number }[] = useMemo(() => {
    const counts = pulse?.subscription_counts || {};
    return [
      { key: 'active',          labelKey: 'ops.subTabActive',     count: counts.active ?? 0 },
      { key: 'expiring',        labelKey: 'ops.subTabExpiring',   count: counts.expiring ?? 0 },
      { key: 'past_due',        labelKey: 'ops.subTabPastDue',    count: counts.past_due ?? 0 },
      { key: 'canceled',        labelKey: 'ops.subTabCanceled',   count: counts.canceled ?? 0 },
      { key: 'new_month',  labelKey: 'ops.subTabNew',        count: counts.new_this_month ?? 0 },
    ];
  }, [pulse]);

  // ----- Pulse tile defs -----
  const pulseTiles = useMemo(() => {
    if (!pulse) return [];
    return [
      {
        label: t('ops.tileSignups'),
        value: (pulse.signups?.today ?? 0).toLocaleString('en-US'),
        today: pulse.signups?.today ?? 0,
        baseline: pulse.signups?.yesterday ?? 0,
        spark: pulse.signups?.spark ?? [],
        verdict: 'neutral' as OpsVerdict,
        icon: <UserPlus size={14} />,
      },
      {
        label: t('ops.tileActiveSubs'),
        value: (pulse.active_subscriptions ?? 0).toLocaleString('en-US'),
        today: pulse.active_subscriptions ?? 0,
        baseline: pulse.active_subscriptions_last_week ?? 0,
        spark: pulse.active_subscriptions_spark ?? [],
        verdict: (pulse.active_subscriptions ?? 0) > 0 ? 'healthy' : 'neutral' as OpsVerdict,
        icon: <Sparkles size={14} />,
      },
      {
        label: t('ops.tileExpiring'),
        value: (pulse.expiring_7d ?? 0).toLocaleString('en-US'),
        today: pulse.expiring_7d ?? 0,
        baseline: 0,
        spark: pulse.expiring_spark ?? [],
        verdict: ((pulse.expiring_7d ?? 0) > 5 ? 'critical' : (pulse.expiring_7d ?? 0) > 0 ? 'watch' : 'neutral') as OpsVerdict,
        icon: <CalendarClock size={14} />,
      },
      {
        label: t('ops.tileFailedWebhooks'),
        value: (pulse.failed_webhooks_24h ?? 0).toLocaleString('en-US'),
        today: pulse.failed_webhooks_24h ?? 0,
        baseline: 0,
        spark: pulse.webhook_spark ?? [],
        verdict: ((pulse.failed_webhooks_24h ?? 0) > 0 ? 'critical' : 'healthy') as OpsVerdict,
        icon: <AlertTriangle size={14} />,
      },
      {
        label: t('ops.tileApiErrors'),
        value: (pulse.api_errors_1h ?? 0).toLocaleString('en-US'),
        today: pulse.api_errors_1h ?? 0,
        baseline: 0,
        spark: pulse.api_errors_spark ?? [],
        verdict: verdict(pulse.api_errors_1h ?? 0, 1, 10, true),
        icon: <Server size={14} />,
      },
      {
        label: t('ops.tileOpenIncidents'),
        value: (pulse.open_incidents ?? 0).toLocaleString('en-US'),
        today: pulse.open_incidents ?? 0,
        baseline: 0,
        spark: pulse.incidents_spark ?? [],
        verdict: ((pulse.open_incidents_critical ?? 0) > 0 ? 'critical' : (pulse.open_incidents ?? 0) > 0 ? 'watch' : 'healthy') as OpsVerdict,
        icon: <ShieldAlert size={14} />,
      },
    ];
  }, [pulse, t, verdict]);

  const funnelStages = useMemo(() => {
    const stages = funnel?.stages ?? [];
    return stages.map((s: any) => ({
      key: s.key,
      label: t(`ops.funnel.${s.key}`),
      count: s.count,
    }));
  }, [funnel, t]);

  const biggestLeak = useMemo(() => {
    if (!funnel || funnel.biggestDropPct <= 0) return undefined;
    const prev = funnelStages[funnel.biggestDropIdx - 1];
    const curr = funnelStages[funnel.biggestDropIdx];
    if (!prev || !curr) return undefined;
    return t('ops.biggestLeak', { from: prev.label, to: curr.label, pct: funnel.biggestDropPct });
  }, [funnel, funnelStages, t]);

  if (loading && !pulse) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--wsl-ink-3, #6B7280)' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#0EA5E9' }} />
        <div style={{ marginTop: 12, fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800 }}>
          {t('ops.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-portal-page" style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            fontSize: 13, color: 'var(--wsl-ink-3, #6B7280)', fontWeight: 700,
          }}>{t('ops.subtitle')}</div>
        </div>
        <button
          onClick={loadAll}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            border: '1px solid var(--border-subtle, #E5E7EB)',
            background: '#fff', cursor: 'pointer',
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            fontWeight: 800, fontSize: 12, color: 'var(--wsl-ink-2, #374151)',
          }}
        >
          <RefreshCw size={13} /> {t('ops.refresh')}
        </button>
      </div>

      {/* Red service banner */}
      {redService && (
        <div style={{
          padding: '12px 16px', borderRadius: 12,
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#991B1B', fontWeight: 800, fontSize: 13,
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={16} />
          {t('ops.serviceDownBanner', { service: redService.key })}
        </div>
      )}

      {/* OPS-1 LIVE PULSE */}
      <section>
        <h2 style={{ ...SECTION_TITLE, marginBottom: 16 }}>
          <Activity size={18} style={{ color: '#0EA5E9' }} /> {t('ops.section1')}
          <span style={{
            marginInlineStart: 8, padding: '2px 8px', borderRadius: 999,
            background: '#ECFDF5', color: '#065F46',
            fontSize: 10, fontWeight: 900, fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          }}>LIVE · 30s</span>
        </h2>
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}>
          {pulseTiles.map((tile, i) => (
            <LivePulseTile
              key={tile.label}
              label={tile.label}
              value={tile.value}
              today={tile.today}
              baseline={tile.baseline}
              spark={tile.spark}
              verdict={tile.verdict}
              verdictLabel={verdictLabel(tile.verdict)}
              icon={tile.icon}
              index={i}
            />
          ))}
        </div>
      </section>

      {/* OPS-2 SIGNUP FUNNEL + LIVE FEED */}
      <section>
        <h2 style={{ ...SECTION_TITLE, marginBottom: 16 }}>
          <UserPlus size={18} style={{ color: '#0EA5E9' }} /> {t('ops.section2')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
          <div style={CARD}>
            <h3 style={{
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontWeight: 900, fontSize: 14, color: 'var(--wsl-ink, #0F172A)',
              margin: '0 0 14px',
            }}>{t('ops.funnelTitle')}</h3>
            {funnel ? (
              <SignupFunnel
                stages={funnelStages}
                biggestDropIdx={funnel.biggestDropIdx}
                biggestDropPct={funnel.biggestDropPct}
                biggestLeakLabel={biggestLeak}
              />
            ) : <div style={{ color: '#9CA3AF' }}>—</div>}
          </div>
          <div style={CARD}>
            <h3 style={{
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontWeight: 900, fontSize: 14, color: 'var(--wsl-ink, #0F172A)',
              margin: '0 0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              {t('ops.feedTitle')}
              <span style={{
                padding: '2px 8px', borderRadius: 999,
                background: '#E0F2FE', color: '#075985',
                fontSize: 10, fontWeight: 900,
              }}>LIVE</span>
            </h3>
            <LiveSignupFeed
              events={feed?.events ?? []}
              emptyLabel={t('ops.feedEmpty')}
              abandonedLastHour={feed?.abandoned_last_hour ?? 0}
            />
          </div>
        </div>
      </section>

      {/* OPS-3 SUBSCRIPTION COMMAND */}
      <section>
        <h2 style={{ ...SECTION_TITLE, marginBottom: 16 }}>
          <Sparkles size={18} style={{ color: '#0EA5E9' }} /> {t('ops.section3')}
        </h2>
        <div style={CARD}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {subTabs.map((tab) => {
              const active = subTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSubTab(tab.key)}
                  style={{
                    padding: '6px 12px', borderRadius: 8,
                    border: active ? '1.5px solid #0EA5E9' : '1.5px solid var(--border-subtle, #E5E7EB)',
                    background: active ? 'rgba(14,165,233,0.08)' : '#fff',
                    color: active ? '#0EA5E9' : 'var(--wsl-ink-2, #374151)',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                    fontWeight: 800, fontSize: 12, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  {t(tab.labelKey)}
                  <span dir="ltr" style={{
                    padding: '1px 6px', borderRadius: 999,
                    background: active ? '#0EA5E9' : '#F3F4F6',
                    color: active ? '#fff' : '#6B7280',
                    fontSize: 9, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                  }}>{tab.count.toLocaleString('en-US')}</span>
                </button>
              );
            })}
          </div>
          <SubscriptionTable
            rows={subData?.rows ?? []}
            emptyLabel={t('ops.subEmpty')}
            onAction={onSubAction}
          />
        </div>
      </section>

      {/* OPS-4 EXTERNAL SERVICES HEALTH */}
      <section>
        <h2 style={{ ...SECTION_TITLE, marginBottom: 16 }}>
          <Server size={18} style={{ color: '#0EA5E9' }} /> {t('ops.section4')}
          <button onClick={onRunAllHealth} style={{
            marginInlineStart: 'auto',
            padding: '6px 12px', borderRadius: 8,
            border: '1px solid var(--border-subtle, #E5E7EB)',
            background: '#fff', color: '#0EA5E9', cursor: 'pointer',
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            fontWeight: 800, fontSize: 11,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <RefreshCw size={12} /> {t('ops.runAllChecks')}
          </button>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {(servicesHealth?.services ?? []).map((s: any, i: number) => (
            <ServiceHealthCard
              key={s.key}
              serviceKey={s.key}
              status={s.status}
              metric={s.metric ?? {}}
              lastChecked={s.last_checked}
              index={i}
              onRunCheck={() => onRunHealthCheck(s.key)}
            />
          ))}
        </div>
      </section>

      {/* OPS-5 WEBHOOK + CRON */}
      <section>
        <h2 style={{ ...SECTION_TITLE, marginBottom: 16 }}>
          <ChevronRight size={18} style={{ color: '#0EA5E9' }} /> {t('ops.section5')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
          <div style={CARD}>
            <h3 style={{
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontWeight: 900, fontSize: 14, color: 'var(--wsl-ink, #0F172A)',
              margin: '0 0 14px',
            }}>{t('ops.webhookTitle')}</h3>
            <WebhookActivity
              rows={webhooks}
              emptyLabel={t('ops.webhookEmpty')}
              onRetry={onRetryWebhook}
            />
          </div>
          <div style={CARD}>
            <h3 style={{
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontWeight: 900, fontSize: 14, color: 'var(--wsl-ink, #0F172A)',
              margin: '0 0 14px',
            }}>{t('ops.cronTitle')}</h3>
            <CronStatus crons={crons?.crons ?? []} onTrigger={onTriggerCron} />
            {(crons?.suggested ?? []).length > 0 && (
              <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: '#F0F9FF', border: '1px dashed #BAE6FD' }}>
                <div style={{
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 900, fontSize: 11, color: '#075985', marginBottom: 6,
                }}>{t('ops.suggestedCrons')}</div>
                {crons.suggested.map((c: any) => (
                  <div key={c.path} dir="ltr" style={{
                    fontSize: 10, color: '#0c4a6e', fontFamily: 'monospace',
                  }}>{c.schedule} → {c.path}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* OPS-6 INCIDENTS + ACTIONS */}
      <section>
        <h2 style={{ ...SECTION_TITLE, marginBottom: 16 }}>
          <ShieldAlert size={18} style={{ color: '#0EA5E9' }} /> {t('ops.section6')}
        </h2>
        <div style={CARD}>
          <IncidentTimeline
            incidents={incidents}
            emptyLabel={t('ops.incidentsEmpty')}
            onAcknowledge={onAcknowledgeIncident}
            onResolve={(inc) => { setResolveModal(inc); setResolveNotes(''); }}
            onDismiss={onDismissIncident}
          />

          {/* Quick actions toolbar */}
          <div style={{
            marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border-subtle, #E5E7EB)',
            display: 'flex', gap: 8, flexWrap: 'wrap',
          }}>
            <button onClick={() => setNewIncidentOpen(true)} style={{
              padding: '8px 14px', borderRadius: 10,
              border: '1px solid var(--border-subtle, #E5E7EB)',
              background: '#fff', color: '#0EA5E9', cursor: 'pointer',
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontWeight: 800, fontSize: 12,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Plus size={13} /> {t('ops.logIncident')}
            </button>
            <button disabled title={t('ops.notImplemented') as string} style={{
              padding: '8px 14px', borderRadius: 10,
              border: '1px solid var(--border-subtle, #E5E7EB)',
              background: '#fff', color: '#6B7280', cursor: 'not-allowed',
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontWeight: 800, fontSize: 12, opacity: 0.6,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Mail size={13} /> {t('ops.broadcastEmail')}
            </button>
            <button onClick={onToggleMaintenance} style={{
              padding: '8px 14px', borderRadius: 10,
              border: '1px solid #FECACA',
              background: pulse?.maintenance_mode ? '#FEF2F2' : '#fff',
              color: '#DC2626', cursor: 'pointer',
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontWeight: 800, fontSize: 12,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Power size={13} /> {pulse?.maintenance_mode ? t('ops.maintenanceOff') : t('ops.maintenanceOn')}
            </button>
            <button onClick={onRunAllHealth} style={{
              padding: '8px 14px', borderRadius: 10,
              border: '1px solid var(--border-subtle, #E5E7EB)',
              background: '#fff', color: '#0EA5E9', cursor: 'pointer',
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontWeight: 800, fontSize: 12,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <ClipboardList size={13} /> {t('ops.runFullCheck')}
            </button>
          </div>
        </div>
      </section>

      {/* Resolve modal */}
      <AnimatePresence>
        {resolveModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setResolveModal(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: 22, width: '100%', maxWidth: 420 }}
            >
              <h3 style={{ fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 900, fontSize: 16, margin: '0 0 12px' }}>{t('ops.resolveModalTitle')}</h3>
              <p style={{ fontSize: 13, color: 'var(--wsl-ink-3, #6B7280)', margin: '0 0 14px', fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>{resolveModal.title}</p>
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                rows={4}
                placeholder={t('ops.resolveNotesPh') as string}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  border: '1.5px solid var(--border-subtle, #E5E7EB)',
                  fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                <button onClick={() => setResolveModal(null)} style={{
                  padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-subtle, #E5E7EB)',
                  background: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 12,
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                }}>{t('ops.cancel')}</button>
                <button onClick={onResolveIncident} style={{
                  padding: '8px 14px', borderRadius: 8, border: 'none',
                  background: '#10B981', color: '#fff', cursor: 'pointer',
                  fontWeight: 800, fontSize: 12,
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <CheckCircle2 size={12} /> {t('ops.confirmResolve')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New incident modal */}
      <AnimatePresence>
        {newIncidentOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setNewIncidentOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: 22, width: '100%', maxWidth: 460 }}
            >
              <h3 style={{ fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 900, fontSize: 16, margin: '0 0 14px' }}>{t('ops.incidentModalTitle')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>{t('ops.incidentSeverity')}</label>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    {(['info', 'warning', 'error', 'critical'] as const).map((s) => (
                      <button key={s} onClick={() => setNewIncident((p) => ({ ...p, severity: s }))} style={{
                        padding: '6px 10px', borderRadius: 8,
                        border: newIncident.severity === s ? '1.5px solid #0EA5E9' : '1.5px solid var(--border-subtle, #E5E7EB)',
                        background: newIncident.severity === s ? 'rgba(14,165,233,0.08)' : '#fff',
                        color: newIncident.severity === s ? '#0EA5E9' : '#6B7280',
                        fontWeight: 800, fontSize: 11, cursor: 'pointer', textTransform: 'capitalize',
                        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                      }}>{s}</button>
                    ))}
                  </div>
                </div>
                <input
                  value={newIncident.title}
                  onChange={(e) => setNewIncident((p) => ({ ...p, title: e.target.value }))}
                  placeholder={t('ops.incidentTitlePh') as string}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    border: '1.5px solid var(--border-subtle, #E5E7EB)',
                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  }}
                />
                <textarea
                  value={newIncident.description}
                  onChange={(e) => setNewIncident((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder={t('ops.incidentDescPh') as string}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    border: '1.5px solid var(--border-subtle, #E5E7EB)',
                    fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  }}
                />
                <input
                  value={newIncident.affected_service}
                  onChange={(e) => setNewIncident((p) => ({ ...p, affected_service: e.target.value }))}
                  placeholder={t('ops.incidentServicePh') as string}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    border: '1.5px solid var(--border-subtle, #E5E7EB)',
                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                <button onClick={() => setNewIncidentOpen(false)} style={{
                  padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-subtle, #E5E7EB)',
                  background: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 12,
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                }}>{t('ops.cancel')}</button>
                <button onClick={onCreateIncident} style={{
                  padding: '8px 14px', borderRadius: 8, border: 'none',
                  background: '#0EA5E9', color: '#fff', cursor: 'pointer',
                  fontWeight: 800, fontSize: 12,
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                }}>{t('ops.confirmCreateIncident')}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 20, insetInlineEnd: 20, zIndex: 9999,
              padding: '12px 18px', borderRadius: 12,
              background: toast.kind === 'ok' ? '#ECFDF5' : '#FEF2F2',
              color: toast.kind === 'ok' ? '#065F46' : '#991B1B',
              border: `1px solid ${toast.kind === 'ok' ? '#A7F3D0' : '#FECACA'}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontWeight: 800, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {toast.kind === 'ok' ? <CheckCircle2 size={16} /> : <XIcon size={16} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
