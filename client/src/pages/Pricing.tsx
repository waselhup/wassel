import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Check, X, ChevronDown } from 'lucide-react';
import { WasselLogo } from '../components/WasselLogo';
import { useState } from 'react';

const plans = [
  {
    id: 'free', name: '\u0645\u062c\u0627\u0646\u064a', price: '0', period: '',
    features: ['100 \u062a\u0648\u0643\u0646', '\u062a\u062d\u0644\u064a\u0644 LinkedIn', '\u0633\u064a\u0631\u0629 \u0630\u0627\u062a\u064a\u0629 \u0648\u0627\u062d\u062f\u0629'],
    cta: '\u0627\u0628\u062f\u0623 \u0645\u062c\u0627\u0646\u0627\u064b', href: '/signup', popular: false, gold: false,
  },
  {
    id: 'starter', name: '\u0645\u0628\u062a\u062f\u0626', price: '99', period: '/\u0634\u0647\u0631',
    features: ['500 \u062a\u0648\u0643\u0646', '3 \u062d\u0645\u0644\u0627\u062a', '\u0631\u0633\u0627\u0626\u0644 AI', '\u062f\u0639\u0645 \u0628\u0631\u064a\u062f'],
    cta: '\u0627\u0634\u062a\u0631\u0643 \u0627\u0644\u0622\u0646', href: '/signup', popular: false, gold: false,
  },
  {
    id: 'pro', name: '\u0627\u062d\u062a\u0631\u0627\u0641\u064a', price: '249', period: '/\u0634\u0647\u0631',
    features: ['2000 \u062a\u0648\u0643\u0646', '\u062d\u0645\u0644\u0627\u062a \u063a\u064a\u0631 \u0645\u062d\u062f\u0648\u062f\u0629', '\u062a\u062d\u0644\u064a\u0644 \u0645\u062a\u0642\u062f\u0645', '\u0623\u0648\u0644\u0648\u064a\u0629 \u0627\u0644\u062f\u0639\u0645'],
    cta: '\u0627\u0634\u062a\u0631\u0643 \u0627\u0644\u0622\u0646', href: '/signup', popular: true, gold: false,
  },
  {
    id: 'agency', name: '\u0648\u0643\u0627\u0644\u0629', price: '599', period: '/\u0634\u0647\u0631',
    features: ['\u062a\u0648\u0643\u0646 \u063a\u064a\u0631 \u0645\u062d\u062f\u0648\u062f', '\u062d\u0633\u0627\u0628\u0627\u062a \u0645\u062a\u0639\u062f\u062f\u0629', 'API access', '\u0645\u062f\u064a\u0631 \u062d\u0633\u0627\u0628'],
    cta: '\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627', href: 'mailto:waselhup@gmail.com', popular: false, gold: true,
  },
];

const compare: (string | boolean)[][] = [
  ['\u0627\u0644\u0645\u064a\u0632\u0629', '\u0645\u062c\u0627\u0646\u064a', '\u0645\u0628\u062a\u062f\u0626', '\u0627\u062d\u062a\u0631\u0627\u0641\u064a', '\u0648\u0643\u0627\u0644\u0629'],
  ['\u062a\u062d\u0644\u064a\u0644 LinkedIn', true, true, true, true],
  ['\u0631\u0633\u0627\u0626\u0644 AI', false, true, true, true],
  ['\u062d\u0645\u0644\u0627\u062a \u0628\u0631\u064a\u062f', false, true, true, true],
  ['\u062a\u062d\u0644\u064a\u0644 \u0645\u062a\u0642\u062f\u0645', false, false, true, true],
  ['\u062d\u0633\u0627\u0628\u0627\u062a \u0645\u062a\u0639\u062f\u062f\u0629', false, false, false, true],
  ['API access', false, false, false, true],
  ['\u0645\u062f\u064a\u0631 \u062d\u0633\u0627\u0628', false, false, false, true],
  ['\u0623\u0648\u0644\u0648\u064a\u0629 \u0627\u0644\u062f\u0639\u0645', false, false, true, true],
];

const faqs = [
  { q: '\u0645\u0627 \u0647\u064a \u0627\u0644\u062a\u0648\u0643\u0646\u0627\u062a\u061f', a: '\u0627\u0644\u062a\u0648\u0643\u0646\u0627\u062a \u0647\u064a \u0648\u062d\u062f\u0629 \u0627\u0644\u0627\u0633\u062a\u0647\u0644\u0627\u0643 \u0641\u064a \u0648\u0635\u0644. \u0643\u0644 \u0639\u0645\u0644\u064a\u0629 \u0645\u062b\u0644 \u062a\u062d\u0644\u064a\u0644 \u0645\u0644\u0641 LinkedIn \u0623\u0648 \u0625\u0631\u0633\u0627\u0644 \u0631\u0633\u0627\u0644\u0629 AI \u062a\u0633\u062a\u0647\u0644\u0643 \u0639\u062f\u062f\u0627\u064b \u0645\u0639\u064a\u0646\u0627\u064b \u0645\u0646 \u0627\u0644\u062a\u0648\u0643\u0646\u0627\u062a.' },
  { q: '\u0647\u0644 \u064a\u0645\u0643\u0646\u0646\u064a \u0625\u0644\u063a\u0627\u0621 \u0627\u0634\u062a\u0631\u0627\u0643\u064a\u061f', a: '\u0646\u0639\u0645\u060c \u064a\u0645\u0643\u0646\u0643 \u0625\u0644\u063a\u0627\u0621 \u0627\u0634\u062a\u0631\u0627\u0643\u0643 \u0641\u064a \u0623\u064a \u0648\u0642\u062a. \u0633\u062a\u0633\u062a\u0645\u0631 \u0641\u064a \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0645\u064a\u0632\u0627\u062a \u062e\u0637\u062a\u0643 \u062d\u062a\u0649 \u0646\u0647\u0627\u064a\u0629 \u0641\u062a\u0631\u0629 \u0627\u0644\u0641\u0648\u062a\u0631\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629.' },
  { q: '\u0647\u0644 \u0627\u0644\u062a\u0648\u0643\u0646\u0627\u062a \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f\u061f', a: '\u0627\u0644\u062a\u0648\u0643\u0646\u0627\u062a \u063a\u064a\u0631 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f \u0628\u0639\u062f \u0627\u0633\u062a\u0647\u0644\u0627\u0643\u0647\u0627. \u0627\u0644\u062a\u0648\u0643\u0646\u0627\u062a \u063a\u064a\u0631 \u0627\u0644\u0645\u0633\u062a\u0647\u0644\u0643\u0629 \u062a\u062a\u062c\u062f\u062f \u0634\u0647\u0631\u064a\u0627\u064b \u0645\u0639 \u0627\u0634\u062a\u0631\u0627\u0643\u0643.' },
  { q: '\u0645\u0627 \u0637\u0631\u0642 \u0627\u0644\u062f\u0641\u0639 \u0627\u0644\u0645\u062a\u0627\u062d\u0629\u061f', a: '\u0646\u062f\u0639\u0645 \u0627\u0644\u062f\u0641\u0639 \u0639\u0628\u0631 \u0645\u062f\u0649\u060c Visa\u060c Mastercard\u060c \u0648Apple Pay. \u062c\u0645\u064a\u0639 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0628\u0627\u0644\u0631\u064a\u0627\u0644 \u0627\u0644\u0633\u0639\u0648\u062f\u064a.' },
  { q: '\u0647\u0644 \u064a\u0645\u0643\u0646\u0646\u064a \u062a\u0631\u0642\u064a\u0629 \u062e\u0637\u062a\u064a\u061f', a: '\u0646\u0639\u0645\u060c \u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u062a\u0631\u0642\u064a\u0629 \u0623\u0648 \u0627\u0644\u062a\u062e\u0641\u064a\u0636 \u0641\u064a \u0623\u064a \u0648\u0642\u062a \u0645\u0646 \u0635\u0641\u062d\u0629 \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u062d\u0633\u0627\u0628. \u0633\u064a\u062a\u0645 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b.' },
];

export default function Pricing() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen" style={{ background: 'var(--wsl-bg)', fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
      {/* Header */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <WasselLogo size={32} />
            <span className="text-xl font-extrabold" style={{ color: 'var(--wsl-teal)' }}>{t('brand.name', '\u0648\u0635\u0644')}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold" style={{ color: 'var(--wsl-teal-dark)' }}>{t('nav.login', '\u062f\u062e\u0648\u0644')}</Link>
            <Link href="/signup" className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-md" style={{ background: 'var(--wsl-teal)' }}>{t('nav.signup', '\u0627\u0628\u062f\u0623 \u0645\u062c\u0627\u0646\u0627\u064b')}</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center py-16 px-6">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ color: 'var(--wsl-ink)' }}>
          {t('pricing.title', '\u0627\u062e\u062a\u0631 \u0627\u0644\u062e\u0637\u0629 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629 \u0644\u0643')}
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--wsl-ink-3)' }}>
          {t('pricing.subtitle', '\u0627\u0628\u062f\u0623 \u0645\u062c\u0627\u0646\u0627\u064b \u0648\u0642\u0645 \u0628\u0627\u0644\u062a\u0631\u0642\u064a\u0629 \u062d\u0633\u0628 \u0627\u062d\u062a\u064a\u0627\u062c\u0627\u062a\u0643. \u062c\u0645\u064a\u0639 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0628\u0627\u0644\u0631\u064a\u0627\u0644 \u0627\u0644\u0633\u0639\u0648\u062f\u064a.')}
        </p>
      </section>

      {/* Cards */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => (
            <div key={p.id} className="relative rounded-2xl bg-white p-6 shadow-md flex flex-col" style={{
              border: p.popular ? '2px solid var(--wsl-teal)' : p.gold ? '2px solid var(--wsl-gold)' : '1px solid var(--wsl-border)',
            }}>
              {p.popular && (
                <div className="absolute -top-3 start-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white" style={{ background: 'var(--wsl-teal)' }}>
                  {t('pricing.popular', '\u0627\u0644\u0623\u0643\u062b\u0631 \u0634\u0639\u0628\u064a\u0629')}
                </div>
              )}
              <h3 className="text-xl font-extrabold mb-2" style={{ color: 'var(--wsl-ink)' }}>{p.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-extrabold" style={{ color: 'var(--wsl-teal)', fontFamily: 'Inter, sans-serif' }}>{p.price}</span>
                <span className="text-sm" style={{ color: 'var(--wsl-ink-3)' }}>{t('pricing.sar', '\u0631\u064a\u0627\u0644')}{p.period}</span>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--wsl-ink-2)' }}>
                    <Check size={16} style={{ color: 'var(--wsl-teal)', flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={p.href} className="block text-center py-3 rounded-lg font-bold text-sm transition-all" style={{
                background: p.popular ? 'var(--wsl-teal)' : 'transparent',
                color: p.popular ? '#fff' : 'var(--wsl-teal)',
                border: p.popular ? 'none' : '1.5px solid var(--wsl-teal)',
              }}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-extrabold text-center mb-8" style={{ color: 'var(--wsl-ink)' }}>
          {t('pricing.compare', '\u0645\u0642\u0627\u0631\u0646\u0629 \u0627\u0644\u062e\u0637\u0637')}
        </h2>
        <div className="overflow-x-auto rounded-2xl bg-white shadow-md border" style={{ borderColor: 'var(--wsl-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--wsl-surf-2)' }}>
                {(compare[0] as string[]).map((h, i) => (
                  <th key={i} className="py-3 px-4 font-extrabold text-center" style={{ color: 'var(--wsl-ink)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compare.slice(1).map((row, ri) => (
                <tr key={ri} className="border-t" style={{ borderColor: 'var(--wsl-border)' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-3 px-4 text-center" style={{ color: 'var(--wsl-ink-2)' }}>
                      {typeof cell === 'boolean' ? (
                        cell ? <Check size={16} className="mx-auto" style={{ color: 'var(--wsl-teal)' }} /> : <X size={16} className="mx-auto" style={{ color: '#ccc' }} />
                      ) : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-extrabold text-center mb-8" style={{ color: 'var(--wsl-ink)' }}>
          {t('pricing.faq', '\u0623\u0633\u0626\u0644\u0629 \u0634\u0627\u0626\u0639\u0629')}
        </h2>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-xl bg-white border" style={{ borderColor: 'var(--wsl-border)' }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 text-start font-bold" style={{ color: 'var(--wsl-ink)' }}>
                {f.q}
                <ChevronDown size={18} className={'transition-transform ' + (openFaq === i ? 'rotate-180' : '')} style={{ color: 'var(--wsl-ink-3)' }} />
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 text-sm leading-relaxed" style={{ color: 'var(--wsl-ink-3)' }}>{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
