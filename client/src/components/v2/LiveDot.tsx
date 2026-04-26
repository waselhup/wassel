import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface LiveDotProps extends HTMLAttributes<HTMLSpanElement> {}

function LiveDot({ className, ...rest }: LiveDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('v2-live-dot inline-block h-1.5 w-1.5 rounded-full bg-teal-500', className)}
      {...rest}
    />
  );
}

export default LiveDot;
