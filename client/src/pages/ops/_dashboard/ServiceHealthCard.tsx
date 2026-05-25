import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Server, Shield, Cpu, Search, CreditCard, Cloud, Send, RefreshCw } from 'lucide-react';
import { timeAgo } from './timeAgo';

interface Props {
  serviceKey: string;
  status: 'healthy' | 'watch' | 'critical' | string;
  metric: { label: string; value: any; unit?: string; latency_ms?: number; calls_1h?: number; calls_24h?: number };
  lastChecked: string;
  index?: number;
  onRunCheck?: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  healthy: '#10B981',
  watch: '#F59E0B',
  critical: '#DC2626',
};

const SERVICE_ICON: Record<string, any> = {
  supabase_db: Server,
  supabase_auth: Shield,
  anthropic: Cpu,
  apify: Search,
  moyasar: CreditCard,
  vercel: Cloud,
  telegram: Send,
};

const SERVICE_LABEL_KEY: Record<string, string> = {
  supabase_db: 'ops.serviceSupabaseDb',
  supabase_auth: 'ops.serviceSupabaseAuth',
  anthropic: 'ops.serviceAnthropic',
  apify: 'ops.serviceApify',
  moyasar: 'ops.serviceMoyasar',
  vercel: 'ops.serviceVercel',
  telegram: 'ops.serviceTelegram',
};

export default function ServiceHealthCard({ serviceKey, status, metric, lastChecked, index = 0, onRunCheck }: Props) {
  const { t } = useTranslation();
  const color = STATUS_COLOR[status] || '#9CA3AF';
  const Icon = SERVICE_ICON[serviceKey] || Server;
  const labelKey = SERVICE_LABEL_KEY[serviceKey] || serviceKey;

  const statusLabel = status === 'healthy' ? t('ops.healthHealthy')
    : status === 'watch' ? t('ops.healthWatch')
    : status === 'critical' ? t('ops.healthCritical')
    : t('ops.healthUnknown');

  // Compose primary metric line
  let primaryLine = '';
  if (serviceKey === 'supabase_db' && typeof metric.value === 'number') {
    primaryLine = t('ops.latencyMs', { n: metric.value });
  } else if (serviceKey === 'anthropic') {
    primaryLine = `${t('ops.successRate', { n: metric.value })} · ${t('ops.latencyMs', { n: metric.latency_ms || 0 })}`;
  } else if (serviceKey === 'apify') {
    primaryLine = t('ops.successRate', { n: metric.value });
  } else if (serviceKey === 'moyasar') {
    primaryLine = metric.value ? t('ops.lastSeen', { ago: timeAgo(metric.value, t) }) : '—';
  } else if (serviceKey === 'vercel') {
    primaryLine = metric.value || '—';
  } else if (serviceKey === 'telegram') {
    primaryLine = metric.value === 'yes' ? t('ops.healthHealthy') : t('ops.healthUnknown');
  } else if (serviceKey === 'supabase_auth') {
    primaryLine = `${metric.value} signups (24h)`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{
        background: '#fff', borderRadius: 14,
        border: '1px solid var(--border-subtle, #E5E7EB)',
        padding: 16,
        display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: color + '15', color,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={14} />
          </div>
          <div style={{
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            fontWeight: 800, fontSize: 12, color: 'var(--wsl-ink, #0F172A)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{t(labelKey)}</div>
        </div>
        <span style={{
          width: 10, height: 10, borderRadius: '50%', background: color,
          boxShadow: `0 0 0 3px ${color}33`, flexShrink: 0,
        }} />
      </div>

      <div dir="ltr" style={{
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        fontWeight: 900, fontSize: 14, color: 'var(--wsl-ink-2, #374151)',
        fontVariantNumeric: 'tabular-nums',
      }}>{primaryLine}</div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        marginTop: 'auto',
      }}>
        <span style={{
          fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)',
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        }}>{t('ops.lastChecked', { ago: timeAgo(lastChecked, t) })}</span>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontWeight: 900, color, textTransform: 'uppercase',
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif', letterSpacing: 0.4,
        }}>{statusLabel}</div>
      </div>

      {onRunCheck && (
        <button onClick={onRunCheck} style={{
          padding: '6px 10px', borderRadius: 8,
          border: '1px solid var(--border-subtle, #E5E7EB)',
          background: '#fff', color: '#0EA5E9', cursor: 'pointer',
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          fontWeight: 800, fontSize: 11,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <RefreshCw size={11} /> {t('ops.runCheckNow')}
        </button>
      )}
    </motion.div>
  );
}
