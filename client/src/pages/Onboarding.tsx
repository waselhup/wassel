import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';

export default function Onboarding() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if extension is installed
  useEffect(() => {
    let timer: any;
    const checkExtension = () => {
      // Try to detect extension via chrome.runtime
      const w = window as any;
      if (w.chrome?.runtime) {
        try {
          w.chrome.runtime.sendMessage('wassel-extension', { type: 'PING' }, (response: any) => {
            if (response) {
              setExtensionDetected(true);
              setTimeout(() => navigate('/app'), 1500);
            }
          });
        } catch (e) {
          // Extension not available
        }
      }
    };

    // Check every 3 seconds for 30 seconds
    checkExtension();
    timer = setInterval(checkExtension, 3000);
    setTimeout(() => {
      setChecking(false);
      clearInterval(timer);
    }, 30000);

    return () => clearInterval(timer);
  }, [navigate]);

  const skipOnboarding = () => {
    localStorage.setItem('wassel_onboarding_done', 'true');
    navigate('/app');
  };

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
            One last step to go! 🎉
          </h1>
          <p className="text-base mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Your account is ready. Now install the Wassel extension to start importing prospects from LinkedIn.
          </p>

          {extensionDetected ? (
            <div className="flex items-center gap-3 px-6 py-4 rounded-xl" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-semibold" style={{ color: '#065f46' }}>Extension detected!</p>
                <p className="text-sm" style={{ color: '#059669' }}>Redirecting to dashboard...</p>
              </div>
            </div>
          ) : (
            <>
              <Link href="/app/extension">
                <button
                  className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-base font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-lg"
                  style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px rgba(26,86,219,0.3)' }}
                >
                  ⚡ Add Wassel to Chrome
                </button>
              </Link>

              <p className="text-center text-xs mt-3 mb-8" style={{ color: 'var(--text-muted)' }}>
                Free Chrome extension · 2-minute setup
              </p>

              {!checking && (
                <button
                  onClick={skipOnboarding}
                  className="w-full text-center text-sm font-medium transition-all hover:underline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  I'll do this later →
                </button>
              )}

              {checking && (
                <button
                  onClick={skipOnboarding}
                  className="w-full text-center text-sm font-medium transition-all hover:underline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Skip for now →
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* RIGHT SIDE — Dark mockup */}
      <div className="hidden lg:flex lg:w-[40%] items-center justify-center p-10 relative overflow-hidden" style={{ background: '#0f172a' }}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(26,86,219,0.2) 0%, transparent 70%)' }}></div>

        <div className="relative z-10 w-full max-w-sm">
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
            <p className="text-white text-sm font-semibold mb-4">What you'll be able to do:</p>
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
