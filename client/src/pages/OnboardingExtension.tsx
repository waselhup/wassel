import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth, supabase } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Download, CheckCircle, Monitor, ArrowRight } from 'lucide-react';

export default function OnboardingExtension() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [marking, setMarking] = useState(false);

  const handleInstalled = async () => {
    if (!user) return;
    setMarking(true);
    try {
      await supabase.from('profiles').update({ extension_installed: true }).eq('id', user.id);
      // Update local cache
      const cached = localStorage.getItem('wassel_user_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.extensionInstalled = true;
        parsed.cachedAt = Date.now();
        localStorage.setItem('wassel_user_cache', JSON.stringify(parsed));
      }
      navigate('/app');
      window.location.reload(); // Force refresh to pick up new state
    } catch (err) {
      console.error('Failed to update extension status:', err);
    } finally {
      setMarking(false);
    }
  };

  const steps = [
    { num: '1', text: t('onboarding.extensionPage.step1') },
    { num: '2', text: t('onboarding.extensionPage.step2') },
    { num: '3', text: t('onboarding.extensionPage.step3') },
    { num: '4', text: t('onboarding.extensionPage.step4') },
    { num: '5', text: t('onboarding.extensionPage.step5') },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: '#f8fafc' }}>
      {/* LEFT SIDE */}
      <div className="flex-1 lg:w-[60%] flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--gradient-primary)' }}>W</div>
            <span className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}>assel</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}>
            {t('onboarding.extensionPage.title')}
          </h1>
          <p className="text-base mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('onboarding.extensionPage.subtitle')}
          </p>

          {/* Download Button */}
          <Link href="/extension-download">
            <button
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-base font-semibold text-white transition-all hover:scale-[1.01] hover:shadow-lg mb-4"
              style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(26,86,219,0.3)' }}
            >
              <Download className="w-5 h-5" />
              {t('onboarding.extensionPage.downloadBtn')}
            </button>
          </Link>

          {/* How to install */}
          <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>{t('onboarding.extensionPage.howTo')}</p>
            <div className="space-y-2">
              {steps.map((s) => (
                <div key={s.num} className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent-primary)' }}>{s.num}</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* I've installed it */}
          <button
            onClick={handleInstalled}
            disabled={marking}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-base font-semibold transition-all hover:scale-[1.01]"
            style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669' }}
          >
            <CheckCircle className="w-5 h-5" />
            {marking ? '...' : t('onboarding.extensionPage.installed')}
          </button>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="hidden lg:flex lg:w-[40%] items-center justify-center p-10 relative overflow-hidden" style={{ background: '#0f172a' }}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(26,86,219,0.2) 0%, transparent 70%)' }}></div>
        <div className="relative z-10 w-full max-w-sm">
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
            <div className="flex items-center gap-3 mb-5">
              <Monitor className="w-8 h-8 text-white" />
              <div>
                <p className="text-white text-sm font-semibold">Wassel Extension</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Chrome Extension</p>
              </div>
            </div>
            <div className="space-y-3">
              {Object.values(t('onboarding.features', { returnObjects: true }) as Record<string, string>).map((text, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
