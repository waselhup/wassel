import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, CheckCircle, Monitor, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import OnboardingNav from '@/components/OnboardingNav';

const EXTENSION_URL = '/extension-download';

export default function OnboardingExtension() {
  const { t } = useTranslation();
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [showContinue, setShowContinue] = useState(false);

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

  const handleInstall = () => {
    window.open(EXTENSION_URL, '_blank');
    setShowContinue(true);
  };

  const handleSkip = () => {
    window.location.href = '/app';
  };

  const handleContinue = () => {
    window.location.href = '/app';
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: 'var(--bg-base)' }}>
      {/* LEFT SIDE */}
      <div className="flex-1 lg:w-[60%] flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2 mb-10 cursor-pointer">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--gradient-primary)' }}>W</div>
              <span className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}>assel</span>
            </div>
          </Link>

          {/* Progress steps */}
          <OnboardingNav />
          <div className="mb-8" />

          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}>
            ثبّت إضافة Wassel
          </h1>
          <p className="text-base mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            الإضافة تعمل مباشرة من متصفحك لأتمتة تواصلك على LinkedIn. يمكنك تثبيتها لاحقاً من لوحة التحكم.
          </p>

          {/* Extension detected banner */}
          {extensionDetected && (
            <div className="flex items-center gap-3 p-4 rounded-xl mb-6" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#34d399' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#34d399' }}>تم تثبيت إضافة Wassel بنجاح ✅</p>
                <p className="text-xs mt-0.5" style={{ color: '#34d399' }}>Wassel Chrome Extension v1.1.0</p>
              </div>
            </div>
          )}

          {/* Main actions */}
          {!extensionDetected && !showContinue && (
            <>
              {/* Install Extension Button */}
              <button
                onClick={handleInstall}
                className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-base font-semibold text-white transition-all hover:scale-[1.01] hover:shadow-lg mb-4"
                style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(26,86,219,0.3)' }}
              >
                <Download className="w-5 h-5" />
                تحميل الإضافة
              </button>

              {/* Skip Button */}
              <button
                onClick={handleSkip}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-medium transition-all hover:bg-gray-50 mb-6"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                تخطي الآن
                <ArrowLeft className="w-4 h-4" />
              </button>
            </>
          )}

          {/* After clicking Install — show "Continue to Dashboard" */}
          {(showContinue && !extensionDetected) && (
            <>
              <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <p className="text-sm" style={{ color: 'rgba(245,158,11,0.8)' }}>
                  🔍 جاري البحث عن الإضافة تلقائياً... إذا ثبّتها، ستظهر هنا.
                </p>
              </div>
              <button
                onClick={handleContinue}
                className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl text-base font-semibold text-white transition-all hover:scale-[1.01]"
                style={{ background: '#34d399', boxShadow: '0 4px 14px rgba(52,211,153,0.3)' }}
              >
                <ArrowLeft className="w-5 h-5" />
                متابعة للوحة التحكم
              </button>
            </>
          )}

          {/* Extension detected — go to dashboard */}
          {extensionDetected && (
            <button
              onClick={handleContinue}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl text-base font-semibold text-white transition-all hover:scale-[1.01]"
              style={{ background: '#34d399', boxShadow: '0 4px 14px rgba(52,211,153,0.3)' }}
            >
              <CheckCircle className="w-5 h-5" />
              تم اكتشاف الإضافة — متابعة للوحة التحكم
            </button>
          )}

          {/* How to install — only if not detected yet */}
          {!extensionDetected && (
            <div className="rounded-xl p-5 mt-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <p className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>كيف تثبّت الإضافة؟</p>
              <div className="space-y-2">
                {[
                  'افتح صفحة تحميل الإضافة',
                  'اضغط "إضافة إلى Chrome"',
                  'وافق على الأذونات المطلوبة',
                  'ارجع لهذه الصفحة — سيتم الاكتشاف تلقائياً',
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent-primary)' }}>{i + 1}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Back link */}
          <Link href="/onboarding/linkedin">
            <button className="w-full text-center text-xs mt-6 hover:underline" style={{ color: 'var(--text-muted)' }}>
              → العودة لربط LinkedIn
            </button>
          </Link>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="hidden lg:flex lg:w-[40%] items-center justify-center p-10 relative overflow-hidden" style={{ background: '#0f172a' }}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)' }}></div>
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
                '⚡ تنفيذ حملات التواصل تلقائياً',
                '🤝 إرسال دعوات ورسائل بالنيابة عنك',
                '📝 نشر منشورات LinkedIn مباشرة',
                '🔄 مزامنة آمنة مع لوحة التحكم',
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
