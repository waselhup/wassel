import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import ClientNav from '@/components/ClientNav';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, ChevronRight, Loader2, Megaphone, Trash2 } from 'lucide-react';

export default function Campaigns() {
  const [, navigate] = useLocation();
  const { accessToken } = useAuth();
  const token = accessToken || localStorage.getItem('supabase_token') || '';

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const deleteCampaign = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sequence/campaigns/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success || data.deleted) {
        setCampaigns(prev => prev.filter(c => c.id !== id));
        showToast('Campaign deleted');
      } else {
        showToast('Delete failed: ' + (data.error || 'Unknown'));
      }
    } catch (e: any) {
      showToast('Delete failed: ' + e.message);
    }
    setDeleting(false);
    setDeleteId(null);
  };

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%' }} />
                    <div className="skeleton" style={{ width: 160, height: 16 }} />
                    <div className="skeleton" style={{ width: 50, height: 18, borderRadius: 12 }} />
                  </div>
                  <div className="skeleton" style={{ width: '60%', height: 12, marginBottom: 8 }} />
                  <div className="skeleton" style={{ width: 120, height: 12 }} />
                </div>
              ))}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                          title="Delete campaign"
                          className="campaign-delete-btn"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#475569', opacity: 0, transition: 'all 0.15s' }}
                        >
                          <Trash2 size={15} />
                        </button>
                        <ChevronRight size={18} style={{ color: '#475569' }} />
                      </div>
                    </div>
                    {deleteId === c.id && (
                      <div onClick={e => e.stopPropagation()} style={{
                        marginTop: 10, padding: '10px 14px', borderRadius: 8,
                        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <span style={{ color: '#fca5a5', fontSize: 12, flex: 1 }}>Delete "{c.name}"? This will remove all steps and prospect data.</span>
                        <button onClick={() => setDeleteId(null)} style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => deleteCampaign(c.id)} disabled={deleting} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>{deleting ? '...' : 'Delete'}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, right: 24,
            background: '#1e293b', border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 10, padding: '12px 20px',
            color: '#f1f5f9', fontSize: 13, fontWeight: 500,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 1000,
          }}>
            {toast}
          </div>
        )}

        <style>{`
          .campaign-delete-btn:hover { opacity: 1 !important; color: #ef4444 !important; }
          div[style*="cursor: pointer"]:hover .campaign-delete-btn { opacity: 0.7 !important; }
        `}</style>
      </main>
    </div>
  );
}
