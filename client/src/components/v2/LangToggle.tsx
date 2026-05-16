import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface LangToggleProps {
  className?: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'pill';
}

/**
 * Global AR/EN toggle. Required to appear on every page (Landing, Auth,
 * all /v2/* app pages, mobile). Persists in localStorage via i18next
 * detector, mirrors <html dir>/lang in i18n/index.ts.
 */
export default function LangToggle({ className, size = 'md', variant = 'pill' }: LangToggleProps) {
  const { i18n } = useTranslation();
  const current = (i18n.language || 'ar').startsWith('ar') ? 'ar' : 'en';
  const next = current === 'ar' ? 'en' : 'ar';

  const onClick = () => {
    void i18n.changeLanguage(next);
    try {
      localStorage.setItem('i18nextLng', next);
    } catch {}
  };

  const sizes = size === 'sm' ? 'h-8 px-2.5 text-[12px]' : 'h-9 px-3 text-[13px]';
  const base =
    variant === 'pill'
      ? 'inline-flex items-center gap-1.5 rounded-full border border-v2-line bg-v2-surface text-v2-body hover:text-v2-ink hover:bg-v2-canvas-2'
      : 'inline-flex items-center gap-1.5 rounded-v2-sm text-v2-body hover:text-v2-ink hover:bg-v2-canvas-2';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={current === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      title={current === 'ar' ? 'EN' : 'AR'}
      className={cn(
        base,
        sizes,
        'font-ar font-semibold cursor-pointer transition-colors duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
        className,
      )}
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M2.5 10 H17.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M10 2.5 C 13 6 13 14 10 17.5 C 7 14 7 6 10 2.5 Z" stroke="currentColor" strokeWidth="1.3" />
      </svg>
      <span>{current === 'ar' ? 'EN' : 'العربية'}</span>
    </button>
  );
}
