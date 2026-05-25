import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import Sparkline from './Sparkline';

export type Verdict = 'healthy' | 'watch' | 'fire' | 'neutral';

interface StatTileProps {
  label: string;
  value: string;
  today: number;
  yesterday: number;
  spark: number[];
  verdict: Verdict;
  verdictLabel: string;
  icon?: React.ReactNode;
  index?: number;
  hint?: string;
}

const VERDICT_COLOR: Record<Verdict, string> = {
  healthy: '#10B981',
  watch: '#F59E0B',
  fire: '#DC2626',
  neutral: '#9CA3AF',
};

export default function StatTile({
  label,
  value,
  today,
  yesterday,
  spark,
  verdict,
  verdictLabel,
  icon,
  index = 0,
  hint,
}: StatTileProps) {
  const delta = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : today > 0 ? 100 : 0;
  const deltaAbs = Math.abs(Math.round(delta));
  const isUp = delta > 1;
  const isDown = delta < -1;
  const trendColor = isUp ? '#10B981' : isDown ? '#DC2626' : '#9CA3AF';
  const TrendIcon = isUp ? ArrowUp : isDown ? ArrowDown : Minus;
  const verdictColor = VERDICT_COLOR[verdict];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid var(--wsl-border, #E5E7EB)',
        padding: 18,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 200ms ease',
      }}
      whileHover={{ boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--wsl-ink-3, #6B7280)',
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          {label}
        </span>
        {icon && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: verdictColor + '15',
              color: verdictColor,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div
        dir="ltr"
        style={{
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          fontWeight: 900,
          fontSize: 28,
          color: 'var(--wsl-ink, #0F172A)',
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            color: trendColor,
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            fontWeight: 800,
            fontSize: 11,
            fontVariantNumeric: 'tabular-nums',
          }}
          dir="ltr"
        >
          <TrendIcon size={11} />
          {deltaAbs}%
        </div>
        <Sparkline data={spark} stroke={verdictColor} fill={verdictColor + '22'} />
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          fontWeight: 900,
          color: verdictColor,
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: verdictColor,
            boxShadow: `0 0 0 3px ${verdictColor}22`,
          }}
        />
        {verdictLabel}
      </div>

      {hint && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--wsl-ink-3, #6B7280)',
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            lineHeight: 1.4,
          }}
        >
          {hint}
        </div>
      )}
    </motion.div>
  );
}
