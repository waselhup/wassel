import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Linkedin, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { Link } from 'wouter';

export default function Login() {
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Verify admin key against backend
      const res = await fetch('/api/clients/status', {
        headers: { Authorization: `Bearer ${adminKey}` },
      });

      if (res.ok) {
        // Valid admin key — store and redirect
        localStorage.setItem('wassel_admin_key', adminKey);
        window.location.href = '/dashboard';
      } else {
        setError('Invalid admin key. Please check and try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">Wassel</h1>
          <p className="text-gray-600">LinkedIn Campaign Management</p>
        </div>

        <Card className="p-8 shadow-lg">
          {!showAdmin ? (
            // Customer view — LinkedIn is the primary auth
            <div className="space-y-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Linkedin className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Wassel</h2>
                <p className="text-gray-600 text-sm">
                  If you received an invite link, click it to connect your LinkedIn account.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-sm text-blue-800 font-medium mb-1">Received an invitation?</p>
                <p className="text-xs text-blue-600">
                  Check your email for the invite link from your campaign manager.
                  Click the link to connect your LinkedIn account securely.
                </p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <button
                  onClick={() => setShowAdmin(true)}
                  className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  Admin Access
                </button>
              </div>
            </div>
          ) : (
            // Admin login — simple key auth
            <form onSubmit={handleAdminLogin} className="space-y-6">
              <div className="text-center mb-2">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-gray-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Admin Login</h2>
                <p className="text-sm text-gray-500">Enter your admin key to access the dashboard.</p>
              </div>

              <div>
                <label htmlFor="admin-key" className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Key
                </label>
                <Input
                  id="admin-key"
                  type="password"
                  placeholder="Enter admin key"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  disabled={loading}
                  required
                  className="w-full"
                />
              </div>

              {error && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !adminKey}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              <button
                type="button"
                onClick={() => { setShowAdmin(false); setError(''); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
              >
                ← Back
              </button>
            </form>
          )}
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
