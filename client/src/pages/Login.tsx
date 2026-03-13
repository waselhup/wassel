import { useState } from 'react';
import { Card } from '@/components/ui/card';
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
    <div className="min-h-screen flex items-center justify-center p-4 auth-glow" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold mb-2" style={{ fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #7c3aed, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Wassel</h1>
          <p style={{ color: 'var(--text-secondary)' }}>LinkedIn Campaign Management</p>
        </div>

        {/* Sign In Card */}
        <Card className="p-8 shadow-lg">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Sign In</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Access your Wassel dashboard</p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                Forgot Password?
              </Link>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full text-white"
              style={{ background: 'var(--gradient-primary)', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}
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

          {/* Google OAuth */}
          <div className="mt-4 mb-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }}></div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }}></div>
            </div>
            <button
              onClick={async () => {
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: { redirectTo: window.location.origin + '/app' },
                });
                if (error) console.error('Google auth error:', error);
              }}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)' }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
          </div>

          {/* Prominent signup CTA */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600 mb-3">New to Wassel?</p>
            <Link href="/signup">
              <Button variant="outline" className="w-full border-blue-300 text-blue-600 hover:bg-blue-50">
                <UserPlus className="w-4 h-4 mr-2" />
                Create Account
              </Button>
            </Link>
          </div>
        </Card>

        {/* Secondary: invite link note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Received an invite link? <Link href="/invite" className="hover:underline text-blue-400">Click here</Link>
          {' · '}
          <Link href="/terms" className="hover:underline">Terms</Link>
          {' · '}
          <Link href="/privacy" className="hover:underline">Privacy</Link>
        </p>
      </div>
    </div>
  );
}
