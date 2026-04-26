import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface NumDisplayProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  /** force LTR + unicode-bidi isolate (use when number sits inside RTL prose) */
  isolated?: boolean;
  /** use mono stack instead of Inter tabular */
  mono?: boolean;
}

function NumDisplay({ className, children, isolated = false, mono = false, ...rest }: NumDisplayProps) {
  return (
    <span
      className={cn(
        mono ? 'font-mono' : 'font-en',
        'tabular-nums',
        !mono && '-tracking-[0.02em]',
        isolated && 'inline-block',
        className,
      )}
      style={isolated ? { direction: 'ltr', unicodeBidi: 'isolate' } : undefined}
      {...rest}
    >
      {children}
    </span>
  );
}

export default NumDisplay;
