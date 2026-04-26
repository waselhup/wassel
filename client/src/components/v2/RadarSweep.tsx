import { useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface RadarAxis {
  /** label rendered around the dial */
  label: string;
  /** angle in degrees, 0 = east, going clockwise (matches phase2v4/p4-loading.jsx) */
  deg: number;
}

export interface RadarSweepProps extends HTMLAttributes<HTMLDivElement> {
  /** total sweep duration in seconds. Default: 7.5s (the signature). */
  duration?: number;
  /** how many of the axis dots have been "lit" so far (0..axes.length). */
  litCount?: number;
  /** axes (defaults to the 6 from phase2v4/p4-loading). */
  axes?: RadarAxis[];
  /** dial size in px (square). Default: 280. */
  size?: number;
  /** keep the sweep wedge rotating forever (true) or stop at duration (false). Default: true. */
  loop?: boolean;
  /** fired once when the sweep finishes (only when loop=false). */
  onComplete?: () => void;
}

const DEFAULT_AXES: RadarAxis[] = [
  { label: 'المقدمة',   deg: -60 },
  { label: 'الخبرة',    deg:   0 },
  { label: 'المهارات',  deg:  60 },
  { label: 'النشاط',    deg: 120 },
  { label: 'الشبكة',    deg: 180 },
  { label: 'التوصيات',  deg: 240 },
];

/**
 * useTicker — re-implements the rAF-driven progress clock from p4-loading.jsx,
 * but stops cleanly on unmount and exposes the progress 0..1 + raw seconds.
 */
function useTicker(durationS: number, running: boolean) {
  const [t, setT] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) { startRef.current = null; return; }
    let raf = 0;
    const loop = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;
      if (elapsed >= durationS) { setT(durationS); return; }
      setT(elapsed);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [durationS, running]);

  return t;
}

function RadarSweep({
  className,
  duration = 7.5,
  litCount,
  axes = DEFAULT_AXES,
  size = 280,
  loop = true,
  onComplete,
  ...rest
}: RadarSweepProps) {
  const t = useTicker(duration, !loop); // only run the timer when we need to fire onComplete
  const completedRef = useRef(false);

  useEffect(() => {
    if (loop) return;
    if (!completedRef.current && t >= duration) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [t, duration, loop, onComplete]);

  // Sweep wedge rotates over `duration` (matches the reference: 7.5s linear).
  const sweepDuration = `${duration}s`;
  // For axis lighting: caller may control `litCount` directly (preferred) or we infer
  // from progress when uncontrolled (so RadarSweep works on its own without findings state).
  const inferredLit = Math.min(axes.length, Math.floor((t / duration) * axes.length));
  const lit = litCount ?? inferredLit;

  const half = size / 2;
  const ringRadii = [size * 0.143, size * 0.286, size * 0.429]; // 40/80/120 at size=280

  return (
    <div
      className={cn('relative', className)}
      style={{ width: size, height: size }}
      {...rest}
    >
      <style>{`
        @keyframes v2-radar-sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes v2-radar-pulse { 0%, 100% { transform: scale(1); opacity: .7; } 50% { transform: scale(1.4); opacity: 0; } }
        @keyframes v2-axis-blink { 0%, 100% { opacity: .85; } 50% { opacity: 1; } }
      `}</style>

      {/* axis labels positioned outside the rings */}
      {axes.map((a, i) => {
        const r = size * 0.543; // 152 at size=280
        const x = Math.cos((a.deg * Math.PI) / 180) * r;
        const y = Math.sin((a.deg * Math.PI) / 180) * r;
        return (
          <span
            key={i}
            className="absolute whitespace-nowrap font-ar text-[11px] font-medium text-v2-dim"
            style={{
              top:  '50%',
              left: '50%',
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
            }}
          >
            {a.label}
          </span>
        );
      })}

      {/* SVG dial */}
      <svg
        className="absolute inset-0"
        width={size}
        height={size}
        viewBox={`-${half} -${half} ${size} ${size}`}
        aria-hidden="true"
      >
        {/* concentric rings */}
        {ringRadii.map((r, i) => (
          <circle key={i} cx={0} cy={0} r={r} fill="none" stroke="var(--line)" strokeWidth={1} />
        ))}
        {/* axis cross-hairs */}
        {axes.map((a, i) => {
          const x = Math.cos((a.deg * Math.PI) / 180) * ringRadii[ringRadii.length - 1]!;
          const y = Math.sin((a.deg * Math.PI) / 180) * ringRadii[ringRadii.length - 1]!;
          return (
            <line key={i} x1={0} y1={0} x2={x} y2={y} stroke="var(--line-2)" strokeWidth={0.8} opacity={0.5} />
          );
        })}
        {/* axis dots — lit progressively */}
        {axes.map((a, i) => {
          const isLit = i < lit;
          const r = (size * 0.286) + (i % 2 === 0 ? size * 0.114 : 0);
          const x = Math.cos((a.deg * Math.PI) / 180) * r;
          const y = Math.sin((a.deg * Math.PI) / 180) * r;
          const haloFill = isLit
            ? (i % 3 === 0 ? 'var(--teal-100)' : i % 3 === 1 ? 'var(--amber-50)' : 'var(--teal-50)')
            : 'transparent';
          const dotFill = isLit
            ? (i % 3 === 0 ? 'var(--teal-600)' : i % 3 === 1 ? 'var(--amber)' : 'var(--teal-500)')
            : 'var(--mute)';
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={isLit ? 7 : 4} fill={haloFill}
                style={{ transition: 'all 400ms var(--ease-out)' }} />
              <circle cx={x} cy={y} r={isLit ? 4 : 2.5} fill={dotFill}
                style={{
                  transition: 'all 400ms var(--ease-out)',
                  animation: isLit ? 'v2-axis-blink 1.6s ease-in-out infinite' : 'none',
                }} />
            </g>
          );
        })}
        {/* center anchor */}
        <circle cx={0} cy={0} r={11} fill="var(--surface)" stroke="var(--line)" strokeWidth={1} />
        <circle cx={0} cy={0} r={4}  fill="var(--ink)" />
        <circle cx={0} cy={0} r={11} fill="none" stroke="var(--teal-500)" strokeWidth={1.5} opacity={0.5}
          style={{ transformOrigin: 'center', animation: 'v2-radar-pulse 2s ease-out infinite' }} />
      </svg>

      {/* sweep wedge — the signature element. Rotates over `duration` linearly. */}
      <div
        className="pointer-events-none absolute"
        style={{
          inset: size * 0.071, // 20 at size=280
          animation: `v2-radar-sweep ${sweepDuration} linear ${loop ? 'infinite' : '1 forwards'}`,
        }}
      >
        <svg
          width={size * 0.857}
          height={size * 0.857}
          viewBox={`-${half * 0.857} -${half * 0.857} ${size * 0.857} ${size * 0.857}`}
        >
          <defs>
            <linearGradient id="v2-sweep-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="var(--teal-500)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--teal-500)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path
            d={`M 0 0 L ${half * 0.857} 0 A ${half * 0.857} ${half * 0.857} 0 0 0 ${half * 0.857 * 0.5} -${half * 0.857 * 0.866} Z`}
            fill="url(#v2-sweep-grad)"
          />
        </svg>
      </div>
    </div>
  );
}

export default RadarSweep;
