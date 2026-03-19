import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Download, CheckCircle, Monitor, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import OnboardingNav from '@/components/OnboardingNav';

export default function OnboardingExtension() {
  const { user, loading, accessToken } = useAuth();
  const { t } = useTranslation();
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');

  // Guard: redirect to correct step based on auth state
  useEffect(() => {
    if (loading) return;
    if (!user) { window.location.href = '/'; return; }
    if (!user.linkedinConnected) { window.location.href = '/onboarding/linkedin'; return; }
    if (user.extensionInstalled) { window.location.href = '/app'; return; }
  }, [loading, user]);

  // Auto-detect extension every 2 seconds
  useEffect(() => {
    const checkExtension = () => {
      const isInstalled = document.documentElement.getAttribute('data-wassel-extension') === 'true';
      if (isInstalled && !extensionDetected) {
        setExtensionDetected(true);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'WASSEL_EXTENSION_INSTALLED') {
        setExtensionDetected(true);
      }
    };

    checkExtension();
    window.addEventListener('message', handleMessage);
    const interval = setInterval(checkExtension, 2000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
    };
  }, [extensionDetected]);

  // On button click: mark installed in DB then navigate to /app immediately
  const handleContinue = async () => {
    setMarking(true);
    setError('');

    // Read token without calling supabase.auth (avoids lock conflict)
    const token: string | null = accessToken
      || localStorage.getItem('supabase_token')
      || (() => {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i) || '';
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
              const val = JSON.parse(localStorage.getItem(key) || '');
              return val?.access_token || null;
            }
          }
        } catch { /* ignore */ }
        return null;
      })();

    // Update cache immediately so ClientRoute passes on /app
    try {
      const raw = localStorage.getItem('wassel_user_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.extensionInstalled = true;
        parsed.cachedAt = Date.now();
        localStorage.setItem('wassel_user_cache', JSON.stringify(parsed));
      }
    } catch { /* ignore */ }

    // Fire PATCH fire-and-forget
    if (token) {
      fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ extension_installed: true }),
      }).catch(() => {});
    }

    window.location.href = '/app';
  };

  const steps = [
    t('onboarding.extensionPage.step1'),
    t('onboarding.extensionPage.step2'),
    t('onboarding.extensionPage.step3'),
    t('onboarding.extensionPage.step4'),
    t('onboarding.extensionPage.step5'),
  ];

  // Show spinner while auth loads or while auto-redirecting
  if (loading || !user || !user.linkedinConnected || user.extensionInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

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

          {/* Progress steps + navigation */}
          <OnboardingNav />
          <div className="mb-8" />

          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}>
            {t('onboarding.extensionPage.title')}
          </h1>
          <p className="text-base mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('onboarding.extensionPage.subtitle')}
          </p>

          {/* Extension detected banner */}
          {extensionDetected && (
            <div className="flex items-center gap-3 p-4 rounded-xl mb-6" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#059669' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#059669' }}>تم تثبيت إضافة Wassel بنجاح ✅</p>
                <p className="text-xs mt-0.5" style={{ color: '#047857' }}>Wassel Chrome Extension v1.1.0</p>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="p-3 rounded-xl mb-4" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <p className="text-sm" style={{ color: '#991b1b' }}>❌ {error}</p>
            </div>
          )}

          {/* Download instructions — only show if extension not yet detected */}
          {!extensionDetected && (
            <>
              <Link href="/extension-download">
                <button
                  className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-base font-semibold text-white transition-all hover:scale-[1.01] hover:shadow-lg mb-4"
                  style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(26,86,219,0.3)' }}
                >
                  <Download className="w-5 h-5" />
                  {t('onboarding.extensionPage.downloadBtn')}
                </button>
              </Link>

              <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <p className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>{t('onboarding.extensionPage.howTo')}</p>
                <div className="space-y-2">
                  {steps.map((text, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent-primary)' }}>{i + 1}</span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-center text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                🔍 جاري البحث عن الإضافة تلقائياً كل ثانيتين...
              </p>
            </>
          )}

          {/* Green CTA — only shown and clickable after extension is detected */}
          {extensionDetected && (
            <button
              onClick={handleContinue}
              disabled={marking}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl text-base font-semibold transition-all hover:scale-[1.01]"
              style={{ background: '#059669', color: 'white', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}
            >
              {marking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري التحديث...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  تم اكتشاف الإضافة — متابعة للوحة التحكم
                </>
              )}
            </button>
          )}

          {/* Bottom navigation */}
          <OnboardingNav />
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
              {[
                t('onboarding.features.scan'),
                t('onboarding.features.import'),
                t('onboarding.features.autoSend'),
                t('onboarding.features.track'),
              ].map((text, i) => (
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
