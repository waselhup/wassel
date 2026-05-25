import { motion } from 'framer-motion';

export interface WaterfallProps {
  startingMrr: number;
  newMrr: number;
  expansionMrr: number;
  churnedMrr: number;
  endingMrr: number;
  labels: {
    starting: string;
    newMrr: string;
    expansion: string;
    churned: string;
    ending: string;
  };
  fmtSar: (n: number) => string;
}

export default function Waterfall({
  startingMrr, newMrr, expansionMrr, churnedMrr, endingMrr,
  labels, fmtSar,
}: WaterfallProps) {
  // Determine max absolute value for bar scaling
  const max = Math.max(startingMrr, endingMrr, newMrr + expansionMrr, churnedMrr, 1);

  const rows = [
    { key: 'starting', label: labels.starting, value: startingMrr, color: '#9CA3AF', sign: 0 },
    { key: 'new', label: labels.newMrr, value: newMrr, color: '#10B981', sign: 1 },
    { key: 'expansion', label: labels.expansion, value: expansionMrr, color: '#14b8a6', sign: 1 },
    { key: 'churned', label: labels.churned, value: churnedMrr, color: '#DC2626', sign: -1 },
    { key: 'ending', label: labels.ending, value: endingMrr, color: '#D4AF37', sign: 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r, i) => {
        const widthPct = (r.value / max) * 100;
        const isDelta = r.sign !== 0;
        const sign = r.sign > 0 ? '+' : r.sign < 0 ? '−' : '';
        return (
          <motion.div
            key={r.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 16px',
              borderRadius: 12,
              background: '#F9FAFB',
              border: '1px solid var(--wsl-border, #E5E7EB)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Visual width bar */}
            <div
              dir="ltr"
              style={{
                position: 'absolute',
                insetInlineStart: 0,
                top: 0,
                bottom: 0,
                width: `${widthPct}%`,
                background: `linear-gradient(90deg, ${r.color}22, transparent)`,
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 800, fontSize: 13, color: 'var(--wsl-ink, #0F172A)' }}>
                {r.label}
              </span>
              <span dir="ltr" style={{
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                fontWeight: 900, fontSize: 16,
                color: r.color,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {isDelta ? sign : ''} {fmtSar(r.value)}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
