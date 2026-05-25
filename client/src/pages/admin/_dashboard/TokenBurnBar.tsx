export interface BurnSegment {
  key: string;
  label: string;
  tokens: number;
  cost_usd: number;
  color: string;
}

interface TokenBurnBarProps {
  segments: BurnSegment[];
  tokensFmt: (n: number) => string;
  costFmt: (n: number) => string;
}

export default function TokenBurnBar({ segments, tokensFmt, costFmt }: TokenBurnBarProps) {
  const total = segments.reduce((s, x) => s + x.tokens, 0);
  if (total === 0) {
    return (
      <div
        style={{
          padding: '24px 0',
          color: 'var(--wsl-ink-3, #6B7280)',
          fontSize: 12,
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        }}
      >
        —
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Stacked bar */}
      <div
        dir="ltr"
        style={{
          width: '100%',
          height: 24,
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          background: '#F3F4F6',
        }}
      >
        {segments.map((seg) => {
          const pct = (seg.tokens / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={seg.key}
              title={`${seg.label}: ${seg.tokens.toLocaleString('en-US')} tokens`}
              style={{
                width: `${pct}%`,
                background: seg.color,
                transition: 'width 400ms ease',
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((seg) => {
          const pct = total > 0 ? (seg.tokens / total) * 100 : 0;
          return (
            <div
              key={seg.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                background: '#F9FAFB',
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: seg.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 700,
                  fontSize: 12,
                  color: 'var(--wsl-ink, #0F172A)',
                }}
              >
                {seg.label}
              </span>
              <span
                dir="ltr"
                style={{
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 800,
                  fontSize: 11,
                  color: 'var(--wsl-ink-2, #374151)',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 80,
                  textAlign: 'end',
                }}
              >
                {tokensFmt(seg.tokens)}
              </span>
              <span
                dir="ltr"
                style={{
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 800,
                  fontSize: 11,
                  color: seg.color,
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 60,
                  textAlign: 'end',
                }}
              >
                {costFmt(Math.round(seg.cost_usd * 100) / 100)}
              </span>
              <span
                dir="ltr"
                style={{
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 700,
                  fontSize: 10,
                  color: 'var(--wsl-ink-3, #6B7280)',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 36,
                  textAlign: 'end',
                }}
              >
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
