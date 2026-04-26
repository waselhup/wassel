import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardRadius = 'md' | 'lg' | 'xl';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  padding?: CardPadding;
  radius?: CardRadius;
  /** apply card shadow (1px subtle). Off by default — set true for hero/lifted cards. */
  elevated?: boolean;
  /** swap the subtle shadow for the heavier "lift" shadow used on hover-y surfaces */
  lifted?: boolean;
  /** remove the hairline border (useful when card sits on canvas-2 or is divider-only) */
  borderless?: boolean;
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-5',
};

const radiusClasses: Record<CardRadius, string> = {
  md: 'rounded-v2-md',
  lg: 'rounded-v2-lg',
  xl: 'rounded-v2-xl',
};

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    className,
    children,
    padding = 'md',
    radius = 'lg',
    elevated = false,
    lifted = false,
    borderless = false,
    ...rest
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-v2-surface',
        !borderless && 'border border-v2-line',
        radiusClasses[radius],
        paddingClasses[padding],
        elevated && !lifted && 'shadow-card',
        lifted && 'shadow-lift',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

export default Card;
