import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
    Loader2, Copy, CheckCircle, AlertCircle, Chrome,
    Key, Clock, RefreshCw, Shield
} from 'lucide-react';
import { Link } from 'wouter';

export default function ExtensionPairing() {
    const { user, accessToken } = useAuth();
    const [extensionToken, setExtensionToken] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const generateToken = async () => {
        if (!accessToken) {
            setError('Not authenticated. Please sign in first.');
            return;
        }

        setLoading(true);
        setError('');
        setExtensionToken(null);

        try {
            const res = await fetch('/api/auth/extension-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            const data = await res.json();

            if (res.ok && data.token) {
                setExtensionToken(data.token);
                setExpiresAt(data.expiresAt);
            } else {
                setError(data.error || 'Failed to generate token');
            }
        } catch {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const copyToken = () => {
        if (extensionToken) {
            navigator.clipboard.writeText(extensionToken);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
            {/* Header */}
            <header className="bg-white border-b shadow-sm">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <Link href="/app">
                                <span className="text-xl font-bold text-blue-600 hover:text-blue-700 cursor-pointer">Wassel</span>
                            </Link>
                            <span className="text-gray-400">/</span>
                            <span className="text-sm font-medium text-gray-600">Extension Setup</span>
                        </div>
                        <Link href="/app">
                            <Button variant="ghost" size="sm">← Back to Dashboard</Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Chrome Extension Setup</h2>
                    <p className="text-gray-500">Connect the Wassel Chrome Extension to your account.</p>
                </div>

                {/* Step 1: Install */}
                <Card className="p-6 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Chrome className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">Step 1: Install Extension</h3>
                            <p className="text-sm text-gray-600 mb-3">
                                Load the Wassel extension in Chrome using Developer Mode.
                            </p>
                            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                                <li>Open <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">chrome://extensions</code></li>
                                <li>Enable "Developer mode" (top right)</li>
                                <li>Click "Load unpacked" and select the <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">wassel-extension</code> folder</li>
                            </ol>
                        </div>
                    </div>
                </Card>

                {/* Step 2: Generate Token */}
                <Card className="p-6 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Key className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">Step 2: Generate Extension Token</h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Generate a secure, short-lived token for the extension. This token expires in 1 hour.
                            </p>

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                                    <AlertCircle className="w-4 h-4 text-red-600" />
                                    <p className="text-sm text-red-800">{error}</p>
                                </div>
                            )}

                            {!extensionToken ? (
                                <Button
                                    onClick={generateToken}
                                    disabled={loading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Key className="w-4 h-4 mr-2" />
                                            Generate Token
                                        </>
                                    )}
                                </Button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="bg-gray-50 border rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium text-gray-500">Extension Token</span>
                                            <Button variant="ghost" size="sm" onClick={copyToken}>
                                                {copied ? (
                                                    <>
                                                        <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                                                        <span className="text-green-600 text-xs">Copied!</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-3 h-3 mr-1" />
                                                        <span className="text-xs">Copy</span>
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        <code className="text-xs text-gray-700 break-all block">
                                            {extensionToken.substring(0, 60)}...
                                        </code>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            Expires: {expiresAt ? new Date(expiresAt).toLocaleTimeString() : 'unknown'}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Shield className="w-3.5 h-3.5" />
                                            {user?.role === 'super_admin' ? 'Admin' : 'Client'} access
                                        </span>
                                    </div>

                                    <Button variant="outline" size="sm" onClick={generateToken}>
                                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                        Regenerate
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Step 3: Paste in Extension */}
                <Card className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">Step 3: Paste in Extension</h3>
                            <p className="text-sm text-gray-600 mb-2">
                                Open the Wassel extension popup, paste the token in the API Token field, and click Save.
                            </p>
                            <p className="text-xs text-gray-400">
                                The extension will automatically connect to your Wassel account and start working on LinkedIn pages.
                            </p>
                        </div>
                    </div>
                </Card>
            </main>
        </div>
    );
}
