import { useEffect, useState } from 'react';

interface ScoreRingProps {
  score: number;
  size?: number;
  label?: string;
}

function colorFor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

export default function ScoreRing({ score, size = 112, label }: ScoreRingProps) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 600;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(Math.round(score * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - animated / 100);
  const color = colorFor(score);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id={`ring-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={`url(#ring-grad-${size})`} strokeWidth={stroke}
            strokeDasharray={circumference} strokeDashoffset={dashOffset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 120ms linear' }} />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, Cairo, sans-serif',
        }}>
          <div style={{ fontSize: size * 0.28, fontWeight: 900, color, lineHeight: 1 }}>{animated}</div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>/ 100</div>
        </div>
      </div>
      {label && (
        <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textAlign: 'center' }}>{label}</div>
      )}
    </div>
  );
}
