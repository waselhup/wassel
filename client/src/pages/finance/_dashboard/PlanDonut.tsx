interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface PlanDonutProps {
  slices: Slice[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}

/**
 * Pure CSS donut chart using a conic-gradient. No chart library needed.
 */
export default function PlanDonut({
  slices, size = 180, centerLabel, centerValue,
}: PlanDonutProps) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', background: '#F3F4F6',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#9CA3AF', fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        fontSize: 12, fontWeight: 700,
      }}>—</div>
    );
  }

  // Build conic-gradient string
  let acc = 0;
  const segs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const start = (acc / total) * 360;
      acc += s.value;
      const end = (acc / total) * 360;
      return `${s.color} ${start}deg ${end}deg`;
    })
    .join(', ');

  return (
    <div
      dir="ltr"
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        background: `conic-gradient(${segs})`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Inner ring (donut hole) */}
      <div
        style={{
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: '50%',
          background: '#fff',
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        {centerValue && (
          <div style={{
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink, #0F172A)',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>
            {centerValue}
          </div>
        )}
        {centerLabel && (
          <div style={{
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            fontSize: 10, fontWeight: 700, color: 'var(--wsl-ink-3, #6B7280)',
            textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4,
          }}>
            {centerLabel}
          </div>
        )}
      </div>
    </div>
  );
}
