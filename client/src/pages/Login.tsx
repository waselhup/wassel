import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Mail, Lock, Linkedin } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';

const errorMessages: Record<string, string> = {
  linkedin_denied: 'LinkedIn access was denied. Please try again.',
  token_failed: 'Could not connect to LinkedIn. Please try again.',
  callback_failed: 'Something went wrong. Please try again.',
  no_code: 'LinkedIn authorization failed. Please try again.',
};

const successMessages: Record<string, string> = {
  linkedin_connected: 'LinkedIn connected! Completing sign in...',
};

export default function Login() {
  const [showAdmin, setShowAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  // Check for OAuth error/success params in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get('error');
    const urlSuccess = params.get('linkedin');
    if (urlError && errorMessages[urlError]) {
      setError(errorMessages[urlError]);
      window.history.replaceState({}, '', '/login');
    }
    if (urlSuccess && successMessages[urlSuccess]) {
      setSuccessMsg(successMessages[urlSuccess]);
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  // If already logged in, redirect based on role and onboarding status
  // Wait for auth to finish loading before redirecting to avoid stale-cache misdirects
  if (!authLoading && user) {
    if (user.role === 'super_admin') {
      window.location.href = '/admin';
    } else if (!user.linkedinConnected) {
      window.location.href = '/onboarding/linkedin';
    } else if (!user.extensionInstalled) {
      window.location.href = '/onboarding/extension';
    } else {
      window.location.href = '/app';
    }
    return null;
  }

  // Use relative URL so it works on any domain (wassel-alpha.vercel.app, wassel.io, localhost)
  const handleLinkedInLogin = () => {
    window.location.href = '/api/linkedin/connect';
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signIn(email, password);
      if (result.error) setError(result.error);
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: '#f8fafc' }}>

      {/* ═══════════════════════════════════════════════
          LEFT SIDE — LinkedIn login (60%)
          ═══════════════════════════════════════════════ */}
      <div className="flex-1 lg:w-[60%] flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2 mb-12 cursor-pointer">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--gradient-primary)' }}>W</div>
              <span className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}>assel</span>
            </div>
          </Link>

          {/* Heading */}
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}>
            Welcome to Wassel!
          </h1>
          <p className="text-base mb-10 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            The transparent LinkedIn automation platform. Set up your account instantly with LinkedIn.
          </p>

          {/* OAuth error message */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl mb-4" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
              <p className="text-sm" style={{ color: '#991b1b' }}>{error}</p>
            </div>
          )}

          {/* OAuth success message (e.g. LinkedIn connected, magic link fallback) */}
          {successMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl mb-4" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <p className="text-sm" style={{ color: '#065f46' }}>✅ {successMsg}</p>
            </div>
          )}

          {/* LinkedIn Button — PRIMARY CTA */}
          <button
            onClick={handleLinkedInLogin}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-base font-semibold text-white transition-all hover:shadow-lg hover:scale-[1.01]"
            style={{ background: '#0077b5', boxShadow: '0 4px 14px rgba(0,119,181,0.3)' }}
          >
            <Linkedin className="w-5 h-5" />
            Continue with LinkedIn
          </button>

          <p className="text-center text-[11px] mt-3 mb-8" style={{ color: 'var(--text-muted)' }}>
            🔒 100% secured by LinkedIn
          </p>

          {/* Already have account */}
          <p className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <button onClick={handleLinkedInLogin} className="font-semibold hover:underline" style={{ color: '#0077b5' }}>
              Sign in →
            </button>
          </p>

          {/* Footer */}
          <p className="text-center text-[11px] mt-10" style={{ color: 'var(--text-muted)' }}>
            <Link href="/terms" className="hover:underline">Terms</Link>
            {' · '}
            <Link href="/privacy" className="hover:underline">Privacy</Link>
          </p>

          {/* Hidden admin access */}
          <div className="mt-8 text-center">
            <button
              onClick={() => setShowAdmin(!showAdmin)}
              className="text-[10px] transition-all"
              style={{ color: 'rgba(0,0,0,0.15)' }}
            >
              Admin access
            </button>

            {showAdmin && (
              <form onSubmit={handleAdminLogin} className="mt-4 space-y-3 text-left">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <Input
                    type="email"
                    placeholder="admin@wassel.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full pl-10"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full pl-10"
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                    <p className="text-xs" style={{ color: '#991b1b' }}>{error}</p>
                  </div>
                )}
                <Button type="submit" disabled={loading || !email || !password} className="w-full text-white text-xs" style={{ background: '#374151' }}>
                  {loading ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Signing in...</> : 'Admin Sign In'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          RIGHT SIDE — Dashboard mockup (40%)
          ═══════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[40%] items-center justify-center p-10 relative overflow-hidden" style={{ background: '#0f172a' }}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,119,181,0.2) 0%, transparent 70%)' }}></div>

        {/* Badge */}
        <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
          FREE TRIAL — No credit card needed
        </div>

        {/* Dashboard mockup */}
        <div className="relative z-10 w-full max-w-sm">
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
            <p className="text-white text-sm font-semibold mb-4">Dashboard Preview</p>
            <div className="space-y-3">
              {[
                { label: 'Accepted invitations', value: '47', icon: '🤝' },
                { label: 'Acceptance rate', value: '39%', icon: '📊' },
                { label: 'Active campaigns', value: '1', icon: '🚀' },
                { label: 'Queued actions', value: '219', icon: '⚡' },
              ].map((stat, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{stat.icon}</span>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{stat.label}</span>
                  </div>
                  <span className="text-lg font-bold text-white">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-4 -left-4 px-4 py-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', backdropFilter: 'blur(8px)' }}>
            <p className="text-xs font-semibold" style={{ color: '#22c55e' }}>🟢 12 invites sent today</p>
          </div>
        </div>
      </div>
    </div>
  );
}
