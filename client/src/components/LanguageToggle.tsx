import { useTranslation } from 'react-i18next';

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const toggle = () => {
    const next = isAr ? 'en' : 'ar';
    i18n.changeLanguage(next);
  };

  return (
    <button
      onClick={toggle}
      className="text-xs px-2.5 py-1 rounded-md transition-all hover:opacity-80"
      style={{
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-muted)',
        fontFamily: isAr ? "'Inter', sans-serif" : "'Cairo', sans-serif",
      }}
      title={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      {isAr ? 'EN' : 'العربية'}
    </button>
  );
}
