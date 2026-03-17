import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Mail, Lock, UserPlus } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useAuth, supabase } from '@/contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const { signIn, user } = useAuth();
  const [, navigate] = useLocation();

  // If already logged in, redirect based on role
  if (user) {
    if (user.role === 'super_admin') {
      window.location.href = '/admin';
    } else {
      window.location.href = '/app';
    }
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: '#f8fafc' }}>

      {/* ═══════════════════════════════════════════════
          LEFT SIDE — Login form (60% on desktop)
          ═══════════════════════════════════════════════ */}
      <div className="flex-1 lg:w-[60%] flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2 mb-10 cursor-pointer">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--gradient-primary)' }}>W</div>
              <span className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}>assel</span>
            </div>
          </Link>

          {/* Heading */}
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)' }}>
            Welcome to Wassel!
          </h1>
          <p className="text-base mb-8" style={{ color: 'var(--text-secondary)' }}>
            Set up your account instantly with Google or email.
          </p>

          {/* Google OAuth — Primary CTA */}
          <button
            onClick={async () => {
              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + '/app' },
              });
              if (error) console.error('Google auth error:', error);
            }}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl text-base font-semibold transition-all hover:shadow-lg"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </button>

          <p className="text-center text-[11px] mt-2 mb-6" style={{ color: 'var(--text-muted)' }}>
            100% secured by Google
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: '#e5e7eb' }}></div>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: '#e5e7eb' }}></div>
          </div>

          {/* Email toggle */}
          {!showEmail ? (
            <button
              onClick={() => setShowEmail(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'transparent', border: '1px solid #e5e7eb', color: 'var(--text-secondary)' }}
            >
              <Mail className="w-4 h-4" />
              Continue with email
            </button>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full pl-10"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full pl-10"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-xs hover:underline" style={{ color: 'var(--accent-primary)' }}>
                  Forgot Password?
                </Link>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                  <p className="text-sm" style={{ color: '#991b1b' }}>{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full text-white py-3"
                style={{ background: 'var(--gradient-primary)' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          )}

          {/* Create account */}
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid #e5e7eb' }}>
            <p className="text-center text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>New to Wassel?</p>
            <Link href="/signup">
              <Button variant="outline" className="w-full" style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}>
                <UserPlus className="w-4 h-4 mr-2" />
                Create Account — Free
              </Button>
            </Link>
          </div>

          <p className="text-center text-[11px] mt-6" style={{ color: 'var(--text-muted)' }}>
            <Link href="/terms" className="hover:underline">Terms</Link>
            {' · '}
            <Link href="/privacy" className="hover:underline">Privacy</Link>
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          RIGHT SIDE — Dashboard mockup (40% on desktop)
          ═══════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[40%] items-center justify-center p-10 relative overflow-hidden" style={{ background: '#0f172a' }}>
        {/* Subtle glow effect */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(26,86,219,0.2) 0%, transparent 70%)' }}></div>

        {/* FREE TRIAL badge */}
        <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
          FREE TRIAL
        </div>

        {/* Dashboard mockup */}
        <div className="relative z-10 w-full max-w-sm">
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
            <p className="text-white text-sm font-semibold mb-4">Dashboard Preview</p>

            {/* Stat cards */}
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

          {/* Floating card */}
          <div className="absolute -bottom-4 -left-4 px-4 py-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', backdropFilter: 'blur(8px)' }}>
            <p className="text-xs font-semibold" style={{ color: '#22c55e' }}>🟢 12 invites sent today</p>
          </div>
        </div>
      </div>
    </div>
  );
}
