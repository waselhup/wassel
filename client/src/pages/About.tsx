import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { WasselLogo } from '../components/WasselLogo';

export default function About() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen py-12 px-6" style={{ background: '#fff', fontFamily: 'Cairo, sans-serif' }}>
      <div className="max-w-3xl mx-auto text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <WasselLogo size={28} />
          <span className="text-lg font-extrabold" style={{ color: 'var(--wsl-teal)' }}>{'\u0648\u0635\u0651\u0644'}</span>
        </Link>
        <h1 className="text-3xl font-extrabold mb-6" style={{ color: 'var(--wsl-teal-dark)' }}>{'\u0645\u0646 \u0646\u062d\u0646'}</h1>
        <p className="text-lg leading-8 mb-6" style={{ color: 'var(--wsl-ink-2)' }}>
          {'\u0648\u0635\u0651\u0644 \u0645\u0646\u0635\u0629 \u0633\u0639\u0648\u062f\u064a\u0629 \u0645\u0628\u062a\u0643\u0631\u0629 \u0645\u062f\u0639\u0648\u0645\u0629 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a\u060c \u0645\u0635\u0645\u0645\u0629 \u0644\u062a\u0633\u0631\u064a\u0639 \u0645\u0633\u064a\u0631\u062a\u0643 \u0627\u0644\u0645\u0647\u0646\u064a\u0629 \u0641\u064a \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0633\u0639\u0648\u062f\u064a \u0648\u0627\u0644\u062e\u0644\u064a\u062c\u064a. \u0646\u0624\u0645\u0646 \u0628\u0623\u0646 \u0643\u0644 \u0645\u062d\u062a\u0631\u0641 \u0633\u0639\u0648\u062f\u064a \u064a\u0633\u062a\u062d\u0642 \u0623\u062f\u0648\u0627\u062a \u0630\u0643\u064a\u0629 \u062a\u0633\u0627\u0639\u062f\u0647 \u0639\u0644\u0649 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0628\u0641\u0639\u0627\u0644\u064a\u0629 \u0645\u0639 \u0635\u0646\u0627\u0639 \u0627\u0644\u0642\u0631\u0627\u0631.'}
        </p>
        <p className="text-base leading-8 mb-8" style={{ color: 'var(--wsl-ink-3)' }}>
          {'\u062a\u0623\u0633\u0633\u062a \u0648\u0635\u0651\u0644 \u0641\u064a \u0627\u0644\u0623\u062d\u0633\u0627\u0621\u060c \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064a\u0629\u060c \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629.'}
        </p>
        <Link href="/" className="inline-flex px-6 py-3 rounded-xl text-white font-bold" style={{ background: 'var(--wsl-teal)' }}>
          {'\u0627\u0644\u0631\u062c\u0648\u0639 \u0644\u0644\u0631\u0626\u064a\u0633\u064a\u0629'}
        </Link>
      </div>
    </div>
  );
}
