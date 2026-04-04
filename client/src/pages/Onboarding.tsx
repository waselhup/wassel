import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';
import { CheckCircle, Circle, Download } from 'lucide-react';

export default function Onboarding() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if extension is installed
  useEffect(() => {
    let timer: any;
    let checkInterval: any;

    const checkExtension = () => {
      const w = window as any;
      if (w.chrome?.runtime) {
        try {
          w.chrome.runtime.sendMessage('wassel-extension', { type: 'PING' }, (response: any) => {
            if (response) {
              setExtensionDetected(true);
              localStorage.setItem('wassel_onboarding_done', 'true');
              setTimeout(() => navigate('/app'), 1500);
            }
          });
        } catch (e) {
          // Extension not available
        }
      }
    };

    checkExtension();
    checkInterval = setInterval(checkExtension, 3000);
    timer = setTimeout(() => {
      setChecking(false);
      clearInterval(checkInterval);
    }, 30000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timer);
    };
  }, [navigate]);

  const skipOnboarding = () => {
    localStorage.setItem('wassel_onboarding_done', 'true');
    navigate('/app');
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: 'var(--bg-base)' }}>

      {/* LEFT SIDE */}
      <div className="flex-1 lg:w-[60%] flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-12">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--gradient-primary)' }}>W</div>
            <span className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}>assel</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}>
            One last step! 🎉
          </h1>
          <p className="text-base mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Your account is ready. Add Wassel to Chrome to start importing prospects from LinkedIn.
          </p>

          {/* Progress Steps */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#34d399' }} />
              <span className="text-sm font-medium" style={{ color: '#34d399' }}>Account created</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: extensionDetected ? 'rgba(34,197,94,0.08)' : 'rgba(139,92,246,0.08)', border: extensionDetected ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(139,92,246,0.2)' }}>
              {extensionDetected ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#34d399' }} />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin flex-shrink-0"></div>
              )}
              <span className="text-sm font-medium" style={{ color: extensionDetected ? '#34d399' : '#a78bfa' }}>
                {extensionDetected ? 'Extension installed!' : 'Install Chrome Extension'}
              </span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Circle className="w-5 h-5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>Start importing prospects</span>
            </div>
          </div>

          {extensionDetected ? (
            <div className="flex items-center gap-3 px-6 py-4 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-semibold" style={{ color: '#34d399' }}>Extension detected!</p>
                <p className="text-sm" style={{ color: '#34d399' }}>Redirecting to dashboard...</p>
              </div>
            </div>
          ) : (
            <>
              <Link href="/app/extension">
                <button
                  className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-base font-semibold text-white transition-all hover:scale-[1.01] hover:shadow-lg"
                  style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(26,86,219,0.3)' }}
                >
                  <Download className="w-5 h-5" />
                  Add Wassel to Chrome — Free
                </button>
              </Link>

              <p className="text-center text-xs mt-3 mb-6" style={{ color: 'var(--text-muted)' }}>
                Free Chrome extension · 2-minute setup
              </p>

              <button
                onClick={skipOnboarding}
                className="w-full text-center text-sm font-medium transition-all hover:underline"
                style={{ color: 'var(--text-muted)' }}
              >
                Already installed? Skip →
              </button>
            </>
          )}
        </div>
      </div>

      {/* RIGHT SIDE — Dark panel */}
      <div className="hidden lg:flex lg:w-[40%] items-center justify-center p-10 relative overflow-hidden" style={{ background: '#0f172a' }}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)' }}></div>

        <div className="relative z-10 w-full max-w-sm">
          {/* Extension preview mockup */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: 'var(--gradient-primary)' }}>W</div>
              <div>
                <p className="text-white text-sm font-semibold">Wassel Extension</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Chrome Extension</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { icon: '🔍', text: 'Scan LinkedIn search results' },
                { icon: '📥', text: 'Import 500+ prospects at once' },
                { icon: '🚀', text: 'Auto-send invites & messages' },
                { icon: '📊', text: 'Track campaign performance' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
