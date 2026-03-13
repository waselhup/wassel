import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import ClientNav from '@/components/ClientNav';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, ChevronRight, Loader2, Megaphone } from 'lucide-react';

export default function Campaigns() {
  const [, navigate] = useLocation();
  const { accessToken } = useAuth();
  const token = accessToken || localStorage.getItem('supabase_token') || '';

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/ext/campaigns', {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
      .then(r => r.json())
      .then(data => {
        const list = data.data || data.campaigns || data || [];
        setCampaigns(Array.isArray(list) ? list : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.2s' };
  const statusColors: Record<string, { dot: string; bg: string; text: string }> = {
    active: { dot: '#22c55e', bg: 'rgba(34,197,94,0.1)', text: '#86efac' },
    paused: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', text: '#fcd34d' },
    draft: { dot: '#64748b', bg: 'rgba(100,116,139,0.1)', text: '#94a3b8' },
    completed: { dot: '#3b82f6', bg: 'rgba(59,130,246,0.1)', text: '#93c5fd' },
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <ClientNav />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxHeight: '100vh' }}>
        <div style={{ maxWidth: 800 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>Campaigns</h2>
              <p style={{ color: '#64748b', fontSize: 13 }}>Manage your outreach sequences.</p>
            </div>
            <button onClick={() => navigate('/app/campaigns/new')}
              style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> New Campaign
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
              <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <p>Loading campaigns...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
              <Megaphone size={40} style={{ color: '#475569', margin: '0 auto 16px' }} />
              <h3 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No campaigns yet</h3>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>Create your first outreach campaign to start connecting with prospects.</p>
              <button onClick={() => navigate('/app/campaigns/new')}
                style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={16} /> Create your first campaign
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {campaigns.map((c: any) => {
                const st = statusColors[c.status] || statusColors.draft;
                return (
                  <div key={c.id} style={card}
                    onClick={() => navigate(`/app/campaigns/${c.id}`)}
                    onMouseOver={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)')}
                    onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot }} />
                          <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, margin: 0 }}>{c.name}</h3>
                          <span style={{ background: st.bg, color: st.text, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                            {c.status}
                          </span>
                        </div>
                        {c.description && <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>{c.description}</p>}
                        <div style={{ display: 'flex', gap: 16, color: '#475569', fontSize: 12 }}>
                          <span>Created {new Date(c.created_at).toLocaleDateString()}</span>
                          {c.type && <span style={{ color: '#64748b' }}>Type: {c.type}</span>}
                        </div>
                      </div>
                      <ChevronRight size={18} style={{ color: '#475569', marginTop: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
