import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

interface Props {
  stages: FunnelStage[];
  biggestDropIdx: number;
  biggestDropPct: number;
  biggestLeakLabel?: string;
}

export default function SignupFunnel({ stages, biggestDropIdx, biggestDropPct, biggestLeakLabel }: Props) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {stages.map((stage, i) => {
        const widthPct = (stage.count / max) * 100;
        const prev = i > 0 ? stages[i - 1].count : null;
        const pctOfPrev = prev && prev > 0 ? Math.round((stage.count / prev) * 100) : null;
        const isBiggestDrop = i === biggestDropIdx && biggestDropPct > 0;
        const barColor = isBiggestDrop ? '#F59E0B' : '#0EA5E9';
        const barBg = isBiggestDrop ? '#FFFBEB' : 'rgba(14, 165, 233, 0.08)';
        return (
          <div key={stage.key}>
            {i > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0', color: isBiggestDrop ? '#F59E0B' : '#9CA3AF' }}>
                <ArrowDown size={12} />
              </div>
            )}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 16px', borderRadius: 12,
                background: barBg,
                border: `1px solid ${isBiggestDrop ? '#FDE68A' : 'transparent'}`,
              }}
            >
              <div dir="ltr" style={{
                position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0,
                width: `${widthPct}%`,
                background: `linear-gradient(90deg, ${barColor}22, transparent)`,
                borderRadius: 12, pointerEvents: 'none',
              }} />
              <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 800, fontSize: 13, color: 'var(--wsl-ink, #0F172A)',
                }}>{stage.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {pctOfPrev !== null && (
                    <span dir="ltr" style={{
                      fontSize: 11, fontWeight: 800,
                      color: isBiggestDrop ? '#92400E' : 'var(--wsl-ink-3, #6B7280)',
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{pctOfPrev}%</span>
                  )}
                  <span dir="ltr" style={{
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                    fontWeight: 900, fontSize: 18, color: barColor,
                    fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'end',
                  }}>{stage.count.toLocaleString('en-US')}</span>
                </div>
              </div>
            </motion.div>
          </div>
        );
      })}
      {biggestDropPct > 0 && biggestLeakLabel && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 10,
          background: '#FFFBEB', border: '1px solid #FDE68A',
          color: '#92400E', fontSize: 12, fontWeight: 800,
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        }}>{biggestLeakLabel}</div>
      )}
    </div>
  );
}
