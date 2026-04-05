import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Link } from 'wouter';
import { Linkedin, Loader2, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';

export default function Invite() {
    const [, params] = useRoute('/invite/:token');
    const token = params?.token || '';

    const [loading, setLoading] = useState(true);
    const [valid, setValid] = useState(false);
    const [error, setError] = useState('');
    const [clientInfo, setClientInfo] = useState<{ email?: string; name?: string } | null>(null);
    const [used, setUsed] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('No invite token provided');
            setLoading(false);
            return;
        }

        fetch(`/api/invites/validate/${token}`)
            .then(async (res) => {
                const data = await res.json();
                if (res.ok && data.valid) {
                    setValid(true);
                    setClientInfo(data.client);
                } else {
                    setError(data.error || 'Invalid invite');
                    if (data.used) setUsed(true);
                }
            })
            .catch(() => setError('Failed to validate invite'))
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Validating your invite...</p>
                </div>
            </div>
        );
    }

    if (!valid) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center">
                    <div className="bg-white rounded-2xl shadow-lg p-8">
                        {used ? (
                            <>
                                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Already Connected</h2>
                                <p className="text-gray-600">This invite has already been used. Your LinkedIn is connected.</p>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite</h2>
                                <p className="text-gray-600">{error}</p>
                            </>
                        )}
                        <Link href="/">
                            <button className="mt-6 text-blue-600 hover:text-blue-700 flex items-center gap-2 mx-auto cursor-pointer">
                                <ArrowLeft size={16} />
                                Back to Home
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-blue-600 mb-2">Wassel</h1>
                    <p className="text-gray-600">Connect your LinkedIn account</p>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-8">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Linkedin className="w-10 h-10 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Welcome{clientInfo?.name ? `, ${clientInfo.name}` : ''}!
                        </h2>
                        <p className="text-gray-600">
                            You've been invited to connect your LinkedIn account with Wassel. This allows your campaign manager to run outreach on your behalf.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <a
                            href={`/api/auth/linkedin/start?invite=${token}`}
                            className="w-full bg-[#0077B5] hover:bg-[#006699] text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-colors"
                        >
                            <Linkedin className="w-5 h-5" />
                            Continue with LinkedIn
                        </a>

                        <div className="text-center text-sm text-gray-500 space-y-1">
                            <p>We'll ask for permission to view your basic profile and email.</p>
                            <p>Your data stays secure and encrypted.</p>
                        </div>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-400 mt-6">
                    By connecting, you agree to Wassel's{' '}
                    <Link href="/terms" className="text-blue-500 hover:underline">Terms</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-blue-500 hover:underline">Privacy Policy</Link>
                </p>
            </div>
        </div>
    );
}
