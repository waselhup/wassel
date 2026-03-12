import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Link } from 'wouter';
import { supabase } from '@/contexts/AuthContext';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'https://wassel-alpha.vercel.app/reset-password',
            });

            if (error) {
                setError(error.message);
            } else {
                setSent(true);
            }
        } catch {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 auth-glow" style={{ background: 'var(--bg-base)' }}>
                <div className="w-full max-w-md">
                    <Card className="p-8 shadow-lg text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Check Your Email</h2>
                        <p className="text-gray-600 mb-2">
                            We've sent a password reset link to:
                        </p>
                        <p className="font-medium text-gray-900 mb-6">{email}</p>
                        <p className="text-sm text-gray-500 mb-6">
                            Click the link in the email to set a new password. The link expires in 1 hour.
                        </p>
                        <Link href="/login">
                            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                <ArrowLeft className="w-4 h-4 mr-2" />
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
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-extrabold mb-2" style={{ fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #7c3aed, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Wassel</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Reset your password</p>
                </div>

                <Card className="p-8 shadow-lg">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="text-center mb-2">
                            <h2 className="text-xl font-semibold text-gray-900 mb-1">Forgot Password?</h2>
                            <p className="text-sm text-gray-500">
                                Enter your email and we'll send you a reset link
                            </p>
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

                        {error && (
                            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading || !email}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                'Send Reset Link'
                            )}
                        </Button>

                        <div className="text-center">
                            <Link href="/login" className="text-sm text-blue-600 hover:underline font-medium inline-flex items-center gap-1">
                                <ArrowLeft className="w-3 h-3" />
                                Back to Sign In
                            </Link>
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
