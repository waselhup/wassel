import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

function Eyebrow({ className, children, ...rest }: EyebrowProps) {
  return (
    <span
      className={cn(
        'font-en text-[10.5px] font-medium uppercase tracking-[0.1em] text-v2-dim',
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export default Eyebrow;
