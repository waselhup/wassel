import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
    Loader2, Copy, CheckCircle, AlertCircle, Chrome,
    Key, Clock, RefreshCw, Shield
} from 'lucide-react';
import ClientNav from '@/components/ClientNav';

export default function ExtensionPairing() {
    const { user, accessToken } = useAuth();
    const [extensionToken, setExtensionToken] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const generateToken = async () => {
        // Try accessToken from context first, fall back to localStorage
        const token = accessToken || localStorage.getItem('supabase_token');
        if (!token) {
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
                    'Authorization': `Bearer ${token}`,
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
        <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
            <ClientNav />

            <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxHeight: '100vh' }}>
                <div className="max-w-3xl">
                    <div className="mb-6">
                        <h2 className="text-2xl font-extrabold mb-1" style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text-primary)' }}>Chrome Extension Setup</h2>
                        <p style={{ color: 'var(--text-muted)' }}>Connect the Wassel Chrome Extension to your account.</p>
                    </div>

                    {/* Step 1: Install */}
                    <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-start gap-4">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.12)' }}>
                                <Chrome className="w-4.5 h-4.5" style={{ color: 'var(--accent-primary)' }} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Step 1: Install Extension</h3>
                                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Load the Wassel extension in Chrome using Developer Mode.</p>
                                <ol className="text-xs space-y-1 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
                                    <li>Open <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,255,255,0.06)' }}>chrome://extensions</code></li>
                                    <li>Enable "Developer mode" (top right)</li>
                                    <li>Click "Load unpacked" and select the extension folder</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Generate Token */}
                    <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-start gap-4">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,0.12)' }}>
                                <Key className="w-4.5 h-4.5" style={{ color: '#22c55e' }} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Step 2: Generate Extension Token</h3>
                                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Generate a secure, short-lived token. Expires in 1 hour.</p>

                                {error && (
                                    <div className="flex items-center gap-2 p-3 rounded-lg mb-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                        <AlertCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                        <p className="text-xs" style={{ color: '#fca5a5' }}>{error}</p>
                                    </div>
                                )}

                                {!extensionToken ? (
                                    <Button
                                        onClick={generateToken}
                                        disabled={loading}
                                        size="sm"
                                        className="text-white"
                                        style={{ background: 'var(--gradient-primary)' }}
                                    >
                                        {loading ? (
                                            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating...</>
                                        ) : (
                                            <><Key className="w-3.5 h-3.5 mr-1.5" />Generate Token</>
                                        )}
                                    </Button>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)' }}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Extension Token</span>
                                                <button onClick={copyToken} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded" style={{ color: copied ? '#22c55e' : 'var(--text-muted)', background: 'rgba(255,255,255,0.04)' }}>
                                                    {copied ? <><CheckCircle className="w-3 h-3" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
                                                </button>
                                            </div>
                                            <code className="text-[10px] break-all block" style={{ color: 'var(--text-secondary)' }}>
                                                {extensionToken.substring(0, 60)}...
                                            </code>
                                        </div>

                                        <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Expires: {expiresAt ? new Date(expiresAt).toLocaleTimeString() : 'unknown'}</span>
                                            <span className="flex items-center gap-1"><Shield className="w-3 h-3" />{user?.role === 'super_admin' ? 'Admin' : 'Client'} access</span>
                                        </div>

                                        <Button variant="outline" size="sm" onClick={generateToken} style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
                                            <RefreshCw className="w-3 h-3 mr-1" />Regenerate
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Paste */}
                    <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-start gap-4">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(168,85,247,0.12)' }}>
                                <CheckCircle className="w-4.5 h-4.5" style={{ color: '#a855f7' }} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Step 3: Paste in Extension</h3>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Open the Wassel extension popup, paste the token, and click Save.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
