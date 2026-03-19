import { useState, useEffect } from 'react';
import { useAuth, supabase } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Download, CheckCircle, Monitor, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'wouter';

export default function OnboardingExtension() {
  const { user, accessToken } = useAuth();
  const { t } = useTranslation();
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');

  // If already installed, go to dashboard
  useEffect(() => {
    if (user?.extensionInstalled) {
      window.location.href = '/app';
    }
  }, [user]);

  // Auto-detect extension via data attribute set by wassel_detect.js
  useEffect(() => {
    const checkExtension = () => {
      const isInstalled = document.documentElement.getAttribute('data-wassel-extension') === 'true';
      if (isInstalled && !extensionDetected) {
        setExtensionDetected(true);
      }
    };

    checkExtension();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'WASSEL_EXTENSION_INSTALLED') {
        setExtensionDetected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    const interval = setInterval(checkExtension, 1500);

    return () => {
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
    };
  }, [extensionDetected]);

  // On button click: mark extension installed in DB then go to /app
  const handleContinue = async () => {
    setMarking(true);
    setError('');

    try {
      // Get the freshest possible token — try session first, fall back to state/localStorage
      let token: string | null = null;

      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token || accessToken || localStorage.getItem('supabase_token');

      // If the magic-link session hasn't established yet, wait up to 4s for onAuthStateChange
      if (!token) {
        token = await new Promise<string | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 4000);
          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
            if (s?.access_token) {
              clearTimeout(timeout);
              subscription.unsubscribe();
              resolve(s.access_token);
            }
          });
        });
      }

      if (!token) {
        setError('لم يتم العثور على جلسة. الرجاء العودة للصفحة الرئيسية وتسجيل الدخول من جديد.');
        setMarking(false);
        return;
      }

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ extension_installed: true }),
      });

      const data = await res.json();
      console.log('[OnboardingExtension] PATCH response:', res.status, data);

      if (!res.ok) {
        setError(`فشل التحديث: ${data.error || 'خطأ غير معروف'} (${res.status})`);
        setMarking(false);
        return;
      }

      // Update local cache so ClientRoute doesn't re-check and redirect back
      try {
        const cached = localStorage.getItem('wassel_user_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.extensionInstalled = true;
          parsed.cachedAt = Date.now();
          localStorage.setItem('wassel_user_cache', JSON.stringify(parsed));
        }
      } catch { /* ignore */ }

      window.location.href = '/app';
    } catch (err: any) {
      console.error('[OnboardingExtension] Error:', err);
      setError('خطأ في الشبكة: ' + err.message);
      setMarking(false);
    }
  };

  const steps = [
    t('onboarding.extensionPage.step1'),
    t('onboarding.extensionPage.step2'),
    t('onboarding.extensionPage.step3'),
    t('onboarding.extensionPage.step4'),
    t('onboarding.extensionPage.step5'),
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

          {/* Progress steps */}
          <div className="flex items-center gap-3 mb-8 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#059669' }}>✓</div>
              <span className="text-sm font-medium" style={{ color: '#059669' }}>ربط LinkedIn</span>
            </div>
            <div className="w-8 h-px" style={{ background: 'var(--border-subtle)' }}></div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: extensionDetected ? '#059669' : 'var(--accent-primary)' }}>
                {extensionDetected ? '✓' : '2'}
              </div>
              <span className="text-sm font-semibold" style={{ color: extensionDetected ? '#059669' : 'var(--accent-primary)' }}>
                {extensionDetected ? 'تم تثبيت الإضافة!' : 'تثبيت الإضافة'}
              </span>
            </div>
            <div className="w-8 h-px" style={{ background: 'var(--border-subtle)' }}></div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#e2e8f0', color: '#94a3b8' }}>3</div>
              <span className="text-sm" style={{ color: '#94a3b8' }}>لوحة التحكم</span>
            </div>
          </div>

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
            </>
          )}

          {/* Main CTA button — always clickable, works with or without extension detection */}
          <button
            onClick={handleContinue}
            disabled={marking}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl text-base font-semibold transition-all hover:scale-[1.01]"
            style={extensionDetected
              ? { background: '#059669', color: 'white', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }
              : { background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669' }
            }
          >
            {marking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري التحديث...
              </>
            ) : extensionDetected ? (
              <>
                <CheckCircle className="w-5 h-5" />
                تم اكتشاف الإضافة — متابعة للوحة التحكم
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                {t('onboarding.extensionPage.installed')}
              </>
            )}
          </button>

          {!extensionDetected && (
            <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
              🔍 جاري البحث عن الإضافة... (يتم الاكتشاف تلقائياً عند التثبيت)
            </p>
          )}
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
