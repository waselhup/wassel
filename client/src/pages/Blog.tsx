import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { WasselLogo } from '../components/WasselLogo';

export default function Blog() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen py-12 px-6" style={{ background: '#fff', fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>
      <div className="max-w-3xl mx-auto text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <WasselLogo size={28} />
          <span className="text-lg font-extrabold" style={{ color: 'var(--wsl-teal)' }}>{'\u0648\u0635\u0644'}</span>
        </Link>
        <h1 className="text-3xl font-extrabold mb-6" style={{ color: 'var(--wsl-teal-dark)' }}>{'\u0627\u0644\u0645\u062f\u0648\u0646\u0629'}</h1>
        <p className="text-lg leading-8 mb-8" style={{ color: 'var(--wsl-ink-3)' }}>
          {'\u0642\u0631\u064a\u0628\u0627\u064b \u2014 \u0633\u0646\u0634\u0627\u0631\u0643 \u0645\u0642\u0627\u0644\u0627\u062a \u0648\u0646\u0635\u0627\u0626\u062d \u062d\u0648\u0644 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0627\u0644\u0645\u0647\u0646\u064a \u0648\u0627\u0644\u0628\u062d\u062b \u0639\u0646 \u0648\u0638\u0627\u0626\u0641 \u0641\u064a \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0633\u0639\u0648\u062f\u064a.'}
        </p>
        <Link href="/" className="inline-flex px-6 py-3 rounded-xl text-white font-bold" style={{ background: 'var(--wsl-teal)' }}>
          {'\u0627\u0644\u0631\u062c\u0648\u0639 \u0644\u0644\u0631\u0626\u064a\u0633\u064a\u0629'}
        </Link>
      </div>
    </div>
  );
}
