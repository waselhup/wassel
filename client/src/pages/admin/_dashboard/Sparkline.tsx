interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
}

/**
 * Hand-rolled SVG polyline. Always renders LTR (charts read time → right
 * regardless of UI direction) so we wrap with dir="ltr" to neutralise RTL.
 */
export default function Sparkline({
  data,
  width = 64,
  height = 22,
  stroke = '#14b8a6',
  fill = 'rgba(20, 184, 166, 0.15)',
}: SparklineProps) {
  if (!data || data.length === 0) {
    return <div style={{ width, height }} />;
  }
  const max = Math.max(1, ...data);
  const min = 0;
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const fillPath = `M0,${height} L${points
    .split(' ')
    .map((p) => p)
    .join(' L')} L${width},${height} Z`;

  return (
    <div dir="ltr" style={{ width, height, display: 'inline-block' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        <path d={fillPath} fill={fill} stroke="none" />
        <polyline
          points={points}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
