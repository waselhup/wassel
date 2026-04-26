import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** stretch to container width */
  fullWidth?: boolean;
  /** content placed before children (already mirrors via flex-row in RTL) */
  leadingIcon?: ReactNode;
  /** content placed after children */
  trailingIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-teal-600 text-white border border-teal-600 shadow-card hover:bg-teal-700 active:bg-teal-700 disabled:bg-v2-mute disabled:border-v2-mute',
  secondary:
    'bg-v2-surface text-v2-ink border border-v2-line hover:bg-v2-canvas-2 active:bg-v2-canvas-2 disabled:text-v2-mute',
  ghost:
    'bg-transparent text-v2-ink border border-transparent hover:bg-v2-canvas-2 active:bg-v2-canvas-2 disabled:text-v2-mute',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-v2-sm',
  md: 'h-11 px-4 text-[14px] gap-2 rounded-v2-md',
  lg: 'h-[52px] px-5 text-[15px] gap-2.5 rounded-v2-md',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    leadingIcon,
    trailingIcon,
    type = 'button',
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-ar font-semibold cursor-pointer select-none',
        'transition-colors duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
});

export default Button;
