import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import Sparkline from '@/pages/admin/_dashboard/Sparkline';

export type OpsVerdict = 'healthy' | 'watch' | 'critical' | 'neutral';

interface Props {
  label: string;
  value: string;
  today: number;
  baseline: number;
  spark: number[];
  verdict: OpsVerdict;
  verdictLabel: string;
  icon?: React.ReactNode;
  index?: number;
  hint?: string;
  onClick?: () => void;
}

const COLOR: Record<OpsVerdict, string> = {
  healthy: '#10B981',
  watch: '#F59E0B',
  critical: '#DC2626',
  neutral: '#0EA5E9',
};

export default function LivePulseTile({
  label, value, today, baseline, spark, verdict, verdictLabel, icon, index = 0, hint, onClick,
}: Props) {
  const delta = baseline > 0 ? ((today - baseline) / baseline) * 100 : today > 0 ? 100 : 0;
  const deltaAbs = Math.abs(Math.round(delta));
  const isUp = delta > 1;
  const isDown = delta < -1;
  const trendColor = isUp ? '#10B981' : isDown ? '#DC2626' : '#9CA3AF';
  const TrendIcon = isUp ? ArrowUp : isDown ? ArrowDown : Minus;
  const color = COLOR[verdict];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(20,184,166,0.10)' }}
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 14,
        border: '1px solid var(--border-subtle, #E5E7EB)',
        padding: 18, minWidth: 0,
        display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 200ms ease, transform 200ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 11, fontWeight: 800, color: 'var(--wsl-ink-3, #6B7280)',
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          textTransform: 'uppercase', letterSpacing: 0.4,
        }}>{label}</span>
        {icon && (
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: color + '15', color,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{icon}</div>
        )}
      </div>
      <div dir="ltr" style={{
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        fontWeight: 900, fontSize: 28, color: 'var(--wsl-ink, #0F172A)',
        lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div dir="ltr" style={{
          display: 'inline-flex', alignItems: 'center', gap: 3, color: trendColor,
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          fontWeight: 800, fontSize: 11, fontVariantNumeric: 'tabular-nums',
        }}>
          <TrendIcon size={11} />{deltaAbs}%
        </div>
        <Sparkline data={spark} stroke={color} fill={color + '22'} />
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 10, fontWeight: 900, color,
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: color,
          boxShadow: `0 0 0 3px ${color}22`,
        }} />
        {verdictLabel}
      </div>
      {hint && (
        <div style={{
          fontSize: 11, color: 'var(--wsl-ink-3, #6B7280)',
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif', lineHeight: 1.4,
        }}>{hint}</div>
      )}
    </motion.div>
  );
}
