export interface CostSegment {
  key: string;
  label: string;
  cost_usd: number;
  cost_sar: number;
  color: string;
}

interface CostBarProps {
  segments: CostSegment[];
  totalUsd: number;
  totalSar: number;
  fmtUsd: (n: number) => string;
  fmtSar: (n: number) => string;
}

export default function CostBar({ segments, totalUsd, totalSar, fmtUsd, fmtSar }: CostBarProps) {
  const total = segments.reduce((s, x) => s + x.cost_sar, 0);
  if (total === 0) {
    return (
      <div style={{
        padding: 20, color: 'var(--wsl-ink-3, #6B7280)',
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontSize: 12,
      }}>—</div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div dir="ltr" style={{
        width: '100%', height: 26, borderRadius: 13,
        overflow: 'hidden', display: 'flex', background: '#F3F4F6',
      }}>
        {segments.map((s) => {
          const pct = (s.cost_sar / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={s.key}
              title={`${s.label}: ${fmtSar(s.cost_sar)}`}
              style={{
                width: `${pct}%`,
                background: s.color,
                transition: 'width 400ms ease',
              }}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((s) => {
          const pct = total > 0 ? (s.cost_sar / total) * 100 : 0;
          return (
            <div key={s.key} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8, background: '#F9FAFB',
            }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
              <span style={{
                flex: 1, fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                fontWeight: 700, fontSize: 12, color: 'var(--wsl-ink, #0F172A)',
              }}>{s.label}</span>
              <span dir="ltr" style={{
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                fontWeight: 800, fontSize: 11, color: 'var(--wsl-ink-2, #374151)',
                fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'end',
              }}>{fmtUsd(s.cost_usd)}</span>
              <span dir="ltr" style={{
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                fontWeight: 900, fontSize: 11, color: s.color,
                fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'end',
              }}>{fmtSar(s.cost_sar)}</span>
              <span dir="ltr" style={{
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                fontWeight: 700, fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)',
                fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'end',
              }}>{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>

      <div style={{
        paddingTop: 10, borderTop: '1px dashed var(--wsl-border, #E5E7EB)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 800, color: 'var(--wsl-ink-3, #6B7280)',
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          textTransform: 'uppercase', letterSpacing: 0.4,
        }}>Total</span>
        <span dir="ltr" style={{
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          fontWeight: 900, fontSize: 16, color: '#D4AF37',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {fmtUsd(totalUsd)} · {fmtSar(totalSar)}
        </span>
      </div>
    </div>
  );
}
