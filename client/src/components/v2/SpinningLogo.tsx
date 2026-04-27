import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type SpinningLogoSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinningLogoSpeed = 'slow' | 'normal' | 'fast';

export interface SpinningLogoProps {
  size?: SpinningLogoSize;
  speed?: SpinningLogoSpeed;
  className?: string;
  /** accessible label — read by screen readers, otherwise treated as decorative */
  label?: string;
}

const SIZE_PX: Record<SpinningLogoSize, number> = {
  sm: 28,
  md: 48,
  lg: 72,
  xl: 112,
};

const SPEED_S: Record<SpinningLogoSpeed, number> = {
  slow: 4,
  normal: 2.4,
  fast: 1.2,
};

/**
 * Wassel brand spinner — a teal gradient ring with a counter-rotating
 * accent dot and a center mark. Lives in v2 because it only ever appears
 * inside the v2 surface; the legacy WasselLogo has different shape/animation.
 *
 * Sizes scale together via SIZE_PX; only the SVG dimensions change so layout
 * is predictable regardless of font scale.
 */
export default function SpinningLogo({
  size = 'lg',
  speed = 'normal',
  className,
  label,
}: SpinningLogoProps) {
  const px = SIZE_PX[size];
  const duration = SPEED_S[speed];

  return (
    <span
      className={cn('inline-flex items-center justify-center', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: px, height: px }}
    >
      <motion.svg
        width={px}
        height={px}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={{ rotate: 360 }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: 'center', display: 'block' }}
      >
        <defs>
          <linearGradient id={`sl-grad-${size}`} x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0d9488" />
            <stop offset="1" stopColor="#14b8a6" />
          </linearGradient>
        </defs>

        {/* Outer track — soft teal ring */}
        <circle cx="40" cy="40" r="32" stroke="#99f6e4" strokeWidth="3" opacity="0.45" />

        {/* Animated arc — quarter of the ring, rotates with the SVG */}
        <circle
          cx="40"
          cy="40"
          r="32"
          stroke={`url(#sl-grad-${size})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="48 200"
        />

        {/* Center brand mark — a still core inside the spinning ring */}
        <circle cx="40" cy="40" r="14" fill={`url(#sl-grad-${size})`} />

        {/* Tiny accent — orbits opposite direction via inner rotate */}
        <motion.circle
          cx="40"
          cy="8"
          r="3"
          fill="#C9922A"
          animate={{ rotate: -360 }}
          transition={{ duration: duration * 1.6, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '40px 40px' }}
        />
      </motion.svg>
    </span>
  );
}
