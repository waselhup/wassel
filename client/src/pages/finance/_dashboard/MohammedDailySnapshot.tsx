import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, TrendingUp, PieChart, Calendar } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface SnapshotRow {
  snapshot_date: string;
  mrr_sar: number | null;
  cash_on_hand_sar: number | null;
  net_margin_percent: number | null;
  runway_days: number | null;
}

function fmtSar(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function MohammedDailySnapshot() {
  const { t } = useTranslation();
  const [snap, setSnap] = useState<SnapshotRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await trpc.mohammed.financeKpis({ days: 1 });
        if (!cancelled) setSnap((data as SnapshotRow[])?.[0] ?? null);
      } catch {
        if (!cancelled) setSnap(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div style={{ padding: 24, color: '#9CA3AF', fontSize: 13 }}>{t('finance.mohammedSnapshotLoading')}</div>;
  }

  if (!snap) {
    return <div style={{ padding: 24, color: '#9CA3AF', fontSize: 13, textAlign: 'center' }}>{t('finance.mohammedSnapshotEmpty')}</div>;
  }

  const tiles = [
    { icon: <Wallet size={14} />, label: t('finance.mohammedMrr'), value: fmtSar(snap.mrr_sar) + ' ﷼' },
    { icon: <Calendar size={14} />, label: t('finance.mohammedRunway'), value: snap.runway_days != null ? `${snap.runway_days} ${t('finance.daysLabel')}` : '—' },
    { icon: <PieChart size={14} />, label: t('finance.mohammedMargin'), value: snap.net_margin_percent != null ? `${snap.net_margin_percent}%` : '—' },
    { icon: <TrendingUp size={14} />, label: t('finance.mohammedCash'), value: fmtSar(snap.cash_on_hand_sar) + ' ﷼' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
      {tiles.map((tile, i) => (
        <div key={i} style={{
          padding: '14px 16px', borderRadius: 12,
          background: '#FFFBEB', border: '1px solid #FCD34D',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 800, color: '#92400E',
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            textTransform: 'uppercase', letterSpacing: 0.4,
          }}>
            <span style={{ color: '#D4AF37' }}>{tile.icon}</span>
            {tile.label}
          </div>
          <div style={{
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            fontWeight: 900, fontSize: 22, color: '#0F172A',
          }}>
            {tile.value}
          </div>
        </div>
      ))}
      <div style={{
        gridColumn: '1 / -1',
        fontSize: 11, color: '#92400E', textAlign: 'center',
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        opacity: 0.7, marginTop: 4,
      }}>
        {t('finance.mohammedSnapshotAsOf', { date: snap.snapshot_date })}
      </div>
    </div>
  );
}
