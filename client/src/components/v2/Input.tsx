import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** visible label rendered above the field */
  label?: ReactNode;
  /** small caption shown under the field */
  hint?: ReactNode;
  /** content rendered inside the field, before the input (e.g. "linkedin.com/in/") */
  leadingSlot?: ReactNode;
  /** content rendered inside the field, after the input (e.g. validation icon) */
  trailingSlot?: ReactNode;
  /** mark error state — switches border + ring color */
  error?: boolean;
  /** stretch field to container width */
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    label,
    hint,
    dir,
    leadingSlot,
    trailingSlot,
    error = false,
    fullWidth = true,
    id,
    type = 'text',
    ...rest
  },
  ref,
) {
  const useEnFont = dir === 'ltr' || type === 'email' || type === 'url' || type === 'tel' || type === 'number';

  const fieldShell = cn(
    'flex items-center gap-2.5 px-3.5 py-3 bg-v2-surface',
    'border rounded-v2-md transition-shadow duration-150 ease-out',
    error
      ? 'border-rose-600 focus-within:ring-2 focus-within:ring-rose-600/30'
      : 'border-v2-line focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/30',
    fullWidth && 'w-full',
  );

  return (
    <label className={cn('block', fullWidth && 'w-full', className)} htmlFor={id}>
      {label && (
        <span className="mb-1.5 block font-ar text-[12px] font-medium text-v2-body">{label}</span>
      )}
      <span className={fieldShell}>
        {leadingSlot && (
          <span className="shrink-0 font-en text-[12px] font-semibold text-teal-700">{leadingSlot}</span>
        )}
        <input
          ref={ref}
          id={id}
          type={type}
          dir={dir}
          className={cn(
            'flex-1 min-w-0 bg-transparent border-none outline-none',
            'text-[14px] text-v2-ink placeholder:text-v2-mute',
            useEnFont ? 'font-en' : 'font-ar',
          )}
          {...rest}
        />
        {trailingSlot && (
          <span className="shrink-0 inline-flex items-center text-v2-dim">{trailingSlot}</span>
        )}
      </span>
      {hint && (
        <span className="mt-1.5 block font-ar text-[12px] text-v2-dim">{hint}</span>
      )}
    </label>
  );
});

export default Input;
