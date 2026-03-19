import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Linkedin, Shield } from 'lucide-react';

export default function OnboardingLinkedIn() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) { window.location.href = '/'; return; }
    if (user.linkedinConnected) { window.location.href = '/onboarding/extension'; return; }
  }, [loading, user]);

  const handleConnect = () => {
    window.location.href = '/api/linkedin/connect';
  };

  // Show spinner while auth loads or while redirecting
  if (loading || !user || user.linkedinConnected) {
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
            <span className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}>اssel</span>
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-3 mb-8 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--accent-primary)' }}>1</div>
              <span className="text-sm font-semibold" style={{ color: 'var(--accent-primary)' }}>ربط LinkedIn</span>
            </div>
            <div className="w-8 h-px" style={{ background: 'var(--border-subtle)' }}></div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#e2e8f0', color: '#94a3b8' }}>2</div>
              <span className="text-sm" style={{ color: '#94a3b8' }}>تثبيت الإضافة</span>
            </div>
            <div className="w-8 h-px" style={{ background: 'var(--border-subtle)' }}></div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#e2e8f0', color: '#94a3b8' }}>3</div>
              <span className="text-sm" style={{ color: '#94a3b8' }}>لوحة التحكم</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}>
            اربط حسابك على LinkedIn
          </h1>
          <p className="text-base mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            نحتاج الوصول إلى حسابك على LinkedIn لإرسال الدعوات والرسائل تلقائياً. بياناتك مؤمنة 100%.
          </p>

          <button
            onClick={handleConnect}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-base font-semibold text-white transition-all hover:scale-[1.01] hover:shadow-lg mb-4"
            style={{ background: '#0077b5', boxShadow: '0 4px 20px rgba(0,119,181,0.3)' }}
          >
            <Linkedin className="w-5 h-5" />
            ربط حساب LinkedIn
          </button>

          <p className="text-center text-[11px] mb-6" style={{ color: 'var(--text-muted)' }}>
            🔒 مؤمن 100% عبر LinkedIn OAuth — لا نحفظ كلمة المرور
          </p>

          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>لماذا نحتاج ربط LinkedIn؟</p>
            <div className="space-y-2.5">
              {[
                'إرسال دعوات اتصال تلقائياً',
                'إرسال رسائل متابعة مخصصة',
                'تتبع قبول الدعوات في الوقت الحقيقي',
                'استيراد العملاء المحتملين من بحث LinkedIn',
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Shield className="w-4 h-4 flex-shrink-0" style={{ color: '#059669' }} />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 p-3 rounded-lg text-center" style={{ background: '#fefce8', border: '1px solid #fef08a' }}>
            <p className="text-xs" style={{ color: '#92400e' }}>
              ⚠️ يجب ربط LinkedIn أولاً لاستخدام المنصة
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="hidden lg:flex lg:w-[40%] items-center justify-center p-10 relative overflow-hidden" style={{ background: '#0f172a' }}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,119,181,0.2) 0%, transparent 70%)' }}></div>
        <div className="relative z-10 w-full max-w-sm text-center">
          <Linkedin className="w-20 h-20 mx-auto mb-6" style={{ color: '#0077b5' }} />
          <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>
            خطوة واحدة فقط
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            اربط حسابك على LinkedIn وابدأ في أتمتة تواصلك خلال دقيقتين.
          </p>
          <div className="mt-8 space-y-3">
            {['✓ إعداد في دقيقتين', '✓ بدون حفظ كلمة المرور', '✓ تجربة مجانية 7 أيام'].map((t, i) => (
              <div key={i} className="px-4 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
