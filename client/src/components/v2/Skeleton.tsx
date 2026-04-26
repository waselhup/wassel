import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type SkeletonVariant = 'text' | 'card' | 'avatar' | 'button';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  /** explicit width override (CSS value) */
  width?: string | number;
  /** explicit height override (CSS value) */
  height?: string | number;
  /** how many lines for variant="text" */
  lines?: number;
}

const baseShimmer = 'v2-skeleton';

const variantClasses: Record<SkeletonVariant, string> = {
  text:   'h-3 rounded-full',
  card:   'h-20 rounded-v2-md',
  avatar: 'h-12 w-12 rounded-full',
  button: 'h-11 rounded-v2-md',
};

function Skeleton({ variant = 'text', className, width, height, lines = 1 }: SkeletonProps) {
  // Inline the shimmer keyframes once — tokens.css is verbatim per Phase A rules.
  const keyframes = (
    <style>{`
      .v2-skeleton {
        position: relative;
        overflow: hidden;
        background: linear-gradient(90deg, var(--line) 0%, var(--canvas-2) 50%, var(--line) 100%);
        background-size: 200% 100%;
        animation: v2-skeleton-shimmer 1.4s linear infinite;
      }
      @keyframes v2-skeleton-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  );

  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
        {keyframes}
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(baseShimmer, variantClasses.text)}
            style={{
              width: i === lines - 1 ? '60%' : '100%',
              ...(height !== undefined ? { height } : {}),
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      {keyframes}
      <div
        aria-hidden="true"
        className={cn(baseShimmer, variantClasses[variant], className)}
        style={{
          ...(width !== undefined ? { width } : {}),
          ...(height !== undefined ? { height } : {}),
        }}
      />
    </>
  );
}

/**
 * useInitialLoading — returns `true` for `delayMs`, then `false`. Lets pages
 * show skeletons on first mount before swapping to real content.
 */
export function useInitialLoading(delayMs = 800): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);
  return loading;
}

export default Skeleton;
