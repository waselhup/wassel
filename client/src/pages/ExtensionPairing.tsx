import { useState, useEffect } from 'react';
import ClientNav from '@/components/ClientNav';
import { Chrome, Download, Wifi, Link2, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://wassel-alpha.vercel.app/api';

export default function ExtensionPairing() {
  const [linkedinStatus, setLinkedinStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // Check LinkedIn connection status
  useEffect(() => {
    fetch(`${API_BASE}/linkedin/status`)
      .then(r => r.json())
      .then(data => setLinkedinStatus(data))
      .catch(() => setLinkedinStatus({ connected: false }))
      .finally(() => setLoadingStatus(false));
  }, []);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('linkedin') === 'connected') {
      setLinkedinStatus({ connected: true, name: params.get('name') || 'LinkedIn User' });
    }
  }, []);

  const disconnectLinkedIn = async () => {
    setDisconnecting(true);
    try {
      const token = localStorage.getItem('supabase_token') || '';
      await fetch(`${API_BASE}/linkedin/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      setLinkedinStatus({ connected: false });
    } catch {}
    setDisconnecting(false);
  };

  const card = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 16 };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <ClientNav />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxHeight: '100vh' }}>
        <div className="max-w-3xl">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold mb-1" style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text-primary)' }}>
              Extension & LinkedIn
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>Download the extension and connect your LinkedIn account.</p>
          </div>

          {/* ═══ SECTION 1: Download Extension ═══ */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Download size={20} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Download Chrome Extension</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
                  Import prospects from LinkedIn search results. Scan pages, select prospects, and import them into your campaigns.
                </p>
                <a
                  href="/wassel-extension.zip"
                  download
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    color: '#fff', border: 'none', borderRadius: 8,
                    padding: '10px 20px', fontSize: 13, fontWeight: 600,
                    textDecoration: 'none', cursor: 'pointer',
                  }}
                >
                  ⬇ Download Extension v1.1.0
                </a>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 10 }}>Chrome only · Free</span>
              </div>
            </div>
          </div>

          {/* Installation Steps */}
          <div style={card}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📦 Installation Steps</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Download the ZIP file above',
                'Unzip the file on your computer',
                'Open Chrome → chrome://extensions',
                'Enable "Developer Mode" (top right toggle)',
                'Click "Load unpacked"',
                'Select the unzipped "wassel-extension" folder',
                'Done! The extension icon will appear in your toolbar',
              ].map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#c4b5fd',
                  }}>{i + 1}</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, paddingTop: 2 }}>{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ SECTION 2: LinkedIn OAuth ═══ */}
          <div style={{ ...card, borderColor: linkedinStatus?.connected ? 'rgba(34,197,94,0.25)' : 'rgba(124,58,237,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                background: linkedinStatus?.connected ? 'rgba(34,197,94,0.12)' : 'rgba(0,119,181,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {linkedinStatus?.connected
                  ? <CheckCircle size={20} color="#22c55e" />
                  : <Link2 size={20} color="#0077b5" />
                }
              </div>
              <div style={{ flex: 1 }}>
                {loadingStatus ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Checking LinkedIn connection...</span>
                  </div>
                ) : linkedinStatus?.connected ? (
                  <>
                    <h3 style={{ color: '#86efac', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>✅ LinkedIn Connected</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 8 }}>
                      {linkedinStatus.name || 'Your account'} · Connected
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
                      Wassel can send invites on your behalf automatically via the LinkedIn API. No browser extension needed for invites.
                    </p>
                    <button
                      onClick={disconnectLinkedIn}
                      disabled={disconnecting}
                      style={{
                        background: 'rgba(239,68,68,0.08)', color: '#fca5a5',
                        border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6,
                        padding: '6px 14px', fontSize: 11, cursor: 'pointer',
                        opacity: disconnecting ? 0.6 : 1,
                      }}
                    >
                      {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </>
                ) : (
                  <>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Connect Your LinkedIn Account</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
                      Allow Wassel to send invites on your behalf — safely and officially through LinkedIn's API. 
                      This opens LinkedIn's authorization page where you approve access.
                    </p>
                    <a
                      href={`${API_BASE}/linkedin/connect`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'linear-gradient(135deg, #0077b5, #00a0dc)',
                        color: '#fff', border: 'none', borderRadius: 8,
                        padding: '10px 20px', fontSize: 13, fontWeight: 600,
                        textDecoration: 'none', cursor: 'pointer',
                      }}
                    >
                      🔗 Connect LinkedIn Account
                    </a>
                    <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 8 }}>
                      Your data is encrypted and never shared. You can disconnect anytime.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ═══ SECTION 3: Auto-Connect Info ═══ */}
          <div style={{ ...card, background: 'rgba(34,197,94,0.04)', borderColor: 'rgba(34,197,94,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Wifi size={20} color="#22c55e" />
              </div>
              <div>
                <h3 style={{ color: '#86efac', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Extension Auto-Connects</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
                  When you're logged in to Wassel, the extension syncs automatically. No tokens to copy or paste — just install and go.
                </p>
              </div>
            </div>
          </div>

          {/* Share link */}
          <div style={{ ...card, background: 'rgba(255,255,255,0.02)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>Share this download page with your team:</p>
            <code style={{
              color: '#c4b5fd', fontSize: 12, background: 'rgba(124,58,237,0.1)',
              padding: '6px 12px', borderRadius: 6, display: 'inline-block', userSelect: 'all' as const,
            }}>wassel-alpha.vercel.app/extension-download</code>
          </div>
        </div>
      </main>
    </div>
  );
}
