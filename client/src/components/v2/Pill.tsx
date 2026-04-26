import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PillTone = 'neutral' | 'teal' | 'amber' | 'rose' | 'indigo';
export type PillSize = 'sm' | 'md';

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  tone?: PillTone;
  size?: PillSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  /** render as a non-interactive span (no button semantics) */
  as?: 'button' | 'span';
}

const sizeClasses: Record<PillSize, string> = {
  sm: 'h-7 px-2.5 text-[12px] gap-1',
  md: 'h-8 px-3.5 text-[13px] gap-1.5',
};

const toneSelected: Record<PillTone, string> = {
  neutral: 'bg-v2-ink text-white border-v2-ink',
  teal:    'bg-teal-600 text-white border-teal-600',
  amber:   'bg-v2-amber text-white border-v2-amber',
  rose:    'bg-v2-rose text-white border-v2-rose',
  indigo:  'bg-v2-indigo text-white border-v2-indigo',
};

const toneSoft: Record<PillTone, string> = {
  neutral: 'bg-v2-surface text-v2-ink-2 border-v2-line hover:bg-v2-canvas-2',
  teal:    'bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-100',
  amber:   'bg-v2-amber-50 text-v2-amber border-v2-amber/30 hover:bg-v2-amber-50/80',
  rose:    'bg-v2-rose-50 text-v2-rose border-v2-rose/30 hover:bg-v2-rose-50/80',
  indigo:  'bg-v2-indigo-50 text-v2-indigo border-v2-indigo/30 hover:bg-v2-indigo-50/80',
};

const Pill = forwardRef<HTMLButtonElement, PillProps>(function Pill(
  {
    className,
    selected = false,
    tone = 'neutral',
    size = 'md',
    leadingIcon,
    trailingIcon,
    as = 'button',
    type = 'button',
    children,
    ...rest
  },
  ref,
) {
  const classes = cn(
    'inline-flex items-center justify-center font-ar font-medium select-none',
    'rounded-v2-pill border transition-colors duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
    selected ? toneSelected[tone] : toneSoft[tone],
    sizeClasses[size],
    as === 'button' ? 'cursor-pointer' : '',
    className,
  );

  if (as === 'span') {
    const { onClick: _onClick, disabled: _disabled, ...spanRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <span className={classes} {...(spanRest as object)}>
        {leadingIcon}
        {children}
        {trailingIcon}
      </span>
    );
  }

  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
});

export default Pill;
