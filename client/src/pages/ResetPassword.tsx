import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Lock, CheckCircle, ShieldCheck } from 'lucide-react';
import { Link } from 'wouter';
import { supabase } from '@/contexts/AuthContext';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [sessionReady, setSessionReady] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        // Supabase automatically picks up the recovery token from the URL hash
        // when the user clicks the reset link. We need to wait for the session.
        const handleRecovery = async () => {
            // Check if there's a hash with access_token (Supabase recovery flow)
            const hash = window.location.hash;
            if (hash && hash.includes('access_token')) {
                // Supabase JS client will auto-parse this and establish a session
                // Wait a moment for it to process
                await new Promise(r => setTimeout(r, 1000));
            }

            // Listen for auth state change (RECOVERY event)
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
                if (event === 'PASSWORD_RECOVERY') {
                    setSessionReady(true);
                    setChecking(false);
                } else if (event === 'SIGNED_IN') {
                    setSessionReady(true);
                    setChecking(false);
                }
            });

            // Also check current session
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setSessionReady(true);
            }
            setChecking(false);

            return () => subscription.unsubscribe();
        };

        handleRecovery();
    }, []);

    const handleReset = async (e: React.FormEvent) => {
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
            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                setError(error.message);
            } else {
                setSuccess(true);
            }
        } catch {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (checking) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
                    <p className="text-gray-600">Verifying your reset link...</p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <Card className="p-8 shadow-lg text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Password Updated!</h2>
                        <p className="text-gray-600 mb-6">
                            Your password has been successfully reset. You can now sign in with your new password.
                        </p>
                        <Link href="/login">
                            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                Sign In with New Password
                            </Button>
                        </Link>
                    </Card>
                </div>
            </div>
        );
    }

    if (!sessionReady) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <Card className="p-8 shadow-lg text-center">
                        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-8 h-8 text-yellow-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid or Expired Link</h2>
                        <p className="text-gray-600 mb-6">
                            This password reset link is invalid or has expired. Please request a new one.
                        </p>
                        <Link href="/forgot-password">
                            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                Request New Reset Link
                            </Button>
                        </Link>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-blue-600 mb-2">Wassel</h1>
                    <p className="text-gray-600">Set your new password</p>
                </div>

                <Card className="p-8 shadow-lg">
                    <form onSubmit={handleReset} className="space-y-5">
                        <div className="text-center mb-2">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <ShieldCheck className="w-6 h-6 text-blue-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-1">Reset Password</h2>
                            <p className="text-sm text-gray-500">Choose a strong password for your account</p>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                                New Password
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
                            disabled={loading || !password || !confirmPassword}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Updating password...
                                </>
                            ) : (
                                'Update Password'
                            )}
                        </Button>
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
