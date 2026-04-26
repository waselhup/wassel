import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  /** controlled value */
  checked: boolean;
  /** fired with the next value when the user toggles */
  onChange: (next: boolean) => void;
  /** accessible label for screen readers */
  label?: string;
}

const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { className, checked, onChange, label, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-v2-pill',
        'border transition-colors duration-200 ease-ios cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
        checked ? 'bg-teal-600 border-teal-600' : 'bg-v2-canvas-2 border-v2-line',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          'block h-[18px] w-[18px] rounded-full bg-white shadow-card',
          'transition-transform duration-200 ease-ios',
          checked ? 'translate-x-[1px] rtl:-translate-x-[1px]' : 'translate-x-[17px] rtl:-translate-x-[17px]',
        )}
        style={{
          // anchor to the start edge (logical), then translate
          insetInlineStart: 1,
          position: 'absolute',
        }}
      />
    </button>
  );
});

export default Toggle;
