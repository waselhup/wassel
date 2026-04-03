import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, CheckCircle2, XCircle, RefreshCw, Key, Shield, AlertTriangle } from 'lucide-react';

export default function LinkedInSession() {
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [liAt, setLiAt] = useState('');
  const [jsessionId, setJsessionId] = useState('');
  const [saveResult, setSaveResult] = useState<any>(null);

  const getAuthHeaders = () => {
    const keys = Object.keys(localStorage);
    const sbKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (sbKey) {
      try {
        const parsed = JSON.parse(localStorage.getItem(sbKey) || '');
        const token = parsed?.access_token || parsed?.currentSession?.access_token;
        if (token) return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      } catch {}
    }
    const directToken = localStorage.getItem('supabase_token');
    if (directToken) return { Authorization: `Bearer ${directToken}`, 'Content-Type': 'application/json' };
    return { 'Content-Type': 'application/json' };
  };

  const checkSession = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/session/status', { headers: getAuthHeaders() });
      const data = await res.json();
      setSessionStatus(data);
    } catch (err: any) {
      setSessionStatus({ error: err.message });
    }
    setLoading(false);
  };

  const verifySession = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/session/verify', { headers: getAuthHeaders() });
      const data = await res.json();
      setSessionStatus((prev: any) => ({ ...prev, ...data }));
    } catch (err: any) {
      setSessionStatus((prev: any) => ({ ...prev, verified: false, reason: err.message }));
    }
    setVerifying(false);
  };

  const saveManualCookie = async () => {
    if (!liAt.trim()) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch('/api/session/manual-store', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          li_at: liAt.trim(),
          jsessionid: jsessionId.trim() || undefined,
        }),
      });
      const data = await res.json();
      setSaveResult(data);
      if (data.success) {
        setLiAt('');
        setJsessionId('');
        await checkSession();
      }
    } catch (err: any) {
      setSaveResult({ error: err.message });
    }
    setSaving(false);
  };

  useEffect(() => { checkSession(); }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/app">
          <button className="flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-8 cursor-pointer">
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
        </Link>

        <h1 className="text-3xl font-bold mb-2">LinkedIn Session</h1>
        <p className="text-gray-400 mb-8">Manage your LinkedIn connection for cloud campaign execution</p>

        {/* Current Status */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield size={20} className="text-purple-400" />
              Current Session Status
            </h2>
            <button
              onClick={verifySession}
              disabled={verifying}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw size={14} className={verifying ? 'animate-spin' : ''} />
              {verifying ? 'Verifying...' : 'Verify with LinkedIn'}
            </button>
          </div>

          {loading ? (
            <div className="text-gray-400">Checking session...</div>
          ) : sessionStatus?.hasSession ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {sessionStatus.verified === true ? (
                  <CheckCircle2 size={24} className="text-green-400" />
                ) : sessionStatus.verified === false ? (
                  <XCircle size={24} className="text-red-400" />
                ) : (
                  <AlertTriangle size={24} className="text-yellow-400" />
                )}
                <div>
                  <div className="font-medium">
                    {sessionStatus.verified === true
                      ? `Connected as ${sessionStatus.linkedinName || 'Unknown'}`
                      : sessionStatus.verified === false
                      ? 'Session EXPIRED — LinkedIn rejected the cookie'
                      : 'Session stored — not yet verified'}
                  </div>
                  {sessionStatus.reason && (
                    <div className="text-sm text-red-400 mt-1">{sessionStatus.reason}</div>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                <div>Last updated: {sessionStatus.lastUpdated || sessionStatus.updatedAt || 'Unknown'}</div>
                <div>Last verified: {sessionStatus.lastVerified || 'Never'}</div>
                {sessionStatus.cookieLength && <div>Cookie length: {sessionStatus.cookieLength} chars</div>}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <XCircle size={24} className="text-red-400" />
              <div>
                <div className="font-medium">No LinkedIn session stored</div>
                <div className="text-sm text-gray-400">Use the extension or paste your cookie below</div>
              </div>
            </div>
          )}
        </div>

        {/* Manual Cookie Input */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Key size={20} className="text-purple-400" />
            Manual Cookie Input
          </h2>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4 text-sm">
            <p className="text-yellow-300 font-medium mb-2">How to get your LinkedIn cookies:</p>
            <ol className="space-y-2 text-gray-300 list-decimal list-inside">
              <li>Open <a href="https://www.linkedin.com" target="_blank" rel="noopener" className="text-purple-400 underline">linkedin.com</a> in Chrome and <strong>make sure you're logged in</strong></li>
              <li>Press <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-xs">F12</kbd> to open DevTools</li>
              <li>Go to <strong>Application</strong> tab → <strong>Cookies</strong> → <strong>https://www.linkedin.com</strong></li>
              <li>Find <code className="bg-gray-700 px-1 rounded">li_at</code> — copy the <strong>Value</strong> (long string starting with "AQ...")</li>
              <li>Find <code className="bg-gray-700 px-1 rounded">JSESSIONID</code> — copy its value too (starts with "ajax:")</li>
              <li>Paste both below and click Save</li>
            </ol>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                li_at cookie <span className="text-red-400">*</span>
              </label>
              <textarea
                value={liAt}
                onChange={(e) => setLiAt(e.target.value)}
                placeholder="AQEDAQxxxxxx... (paste the full value)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono text-gray-100 placeholder-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                JSESSIONID cookie <span className="text-gray-500">(optional but recommended)</span>
              </label>
              <input
                value={jsessionId}
                onChange={(e) => setJsessionId(e.target.value)}
                placeholder='ajax:1234567890123456789'
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono text-gray-100 placeholder-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
              />
            </div>

            {saveResult && (
              <div className={`p-3 rounded-lg text-sm ${saveResult.success ? 'bg-green-900/40 border border-green-700 text-green-300' : 'bg-red-900/40 border border-red-700 text-red-300'}`}>
                {saveResult.success ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    Cookie verified and saved! Connected as <strong>{saveResult.linkedinName}</strong>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <XCircle size={16} />
                      {saveResult.error || 'Failed to save'}
                    </div>
                    {saveResult.reason && <div className="mt-1 text-xs">{saveResult.reason}</div>}
                    {saveResult.hint && <div className="mt-1 text-xs text-yellow-300">{saveResult.hint}</div>}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={saveManualCookie}
              disabled={saving || !liAt.trim()}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-semibold text-white disabled:opacity-50 transition-all"
            >
              {saving ? 'Verifying & Saving...' : 'Verify & Save Cookie'}
            </button>
          </div>
        </div>

        {/* Extension Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-3">Using the Extension Instead</h2>
          <p className="text-gray-400 text-sm mb-3">
            If you have the Wassel extension installed, it automatically extracts cookies from Chrome. Make sure:
          </p>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li>You're logged into LinkedIn in Chrome</li>
            <li>The Wassel dashboard is open in a tab</li>
            <li>Click the Wassel extension icon → "Refresh Session"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
