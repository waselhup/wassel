import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Mail, Lock, User, CheckCircle } from 'lucide-react';
import { Link } from 'wouter';
import { useAuth, supabase } from '@/contexts/AuthContext';

export default function Signup() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const { signUp, user } = useAuth();

    // If already logged in, redirect
    if (user) {
        window.location.href = '/app';
        return null;
    }

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);

        try {
            const result = await signUp(email, password, fullName);
            if (result.error) {
                // Check if it's the "confirm email" message (not a real error)
                if (result.error.includes('check your email')) {
                    setSuccess(true);
                } else {
                    setError(result.error);
                }
            } else {
                // Direct login success
                window.location.href = '/app';
            }
        } catch {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 auth-glow" style={{ background: 'var(--bg-base)' }}>
                <div className="w-full max-w-md">
                    <Card className="p-8 shadow-lg text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Check Your Email</h2>
                        <p className="text-gray-600 mb-6">
                            We've sent a confirmation link to <strong>{email}</strong>.
                            Click the link to activate your account.
                        </p>
                        <Link href="/login">
                            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                Back to Sign In
                            </Button>
                        </Link>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 auth-glow" style={{ background: 'var(--bg-base)' }}>
            <div className="w-full max-w-md relative z-10">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-extrabold mb-2" style={{ fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #7c3aed, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Wassel</h1>
                    <p className="text-gray-600">Create your account</p>
                </div>

                <Card className="p-8 shadow-lg">
                    <form onSubmit={handleSignup} className="space-y-5">
                        <div className="text-center mb-2">
                            <h2 className="text-xl font-semibold text-gray-900 mb-1">Sign Up</h2>
                            <p className="text-sm text-gray-500">Start managing your LinkedIn campaigns</p>
                        </div>

                        <div>
                            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Full Name
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    id="fullName"
                                    type="text"
                                    placeholder="Ali Ahmed"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    disabled={loading}
                                    className="w-full pl-10"
                                />
                            </div>
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
                                    placeholder="At least 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    required
                                    minLength={6}
                                    className="w-full pl-10"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="Repeat password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={loading}
                                    required
                                    minLength={6}
                                    className="w-full pl-10"
                                />
                            </div>
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
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                'Create Account'
                            )}
                        </Button>

                        {/* Google OAuth */}
                        <div>
                            <div className="flex items-center gap-3 my-3">
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
                                Sign up with Google
                            </button>
                        </div>

                        <div className="text-center">
                            <p className="text-sm text-gray-600">
                                Already have an account?{' '}
                                <Link href="/login" className="text-blue-600 hover:underline font-medium">
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </form>
                </Card>

                <p className="text-center text-xs text-gray-400 mt-6">
                    <Link href="/terms" className="hover:underline">Terms</Link>
                    {' · '}
                    <Link href="/privacy" className="hover:underline">Privacy</Link>
                </p>
            </div>
        </div>
    );
}
