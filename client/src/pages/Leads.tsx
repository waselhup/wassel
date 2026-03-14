import { useState, useEffect } from 'react';
import ClientNav from '@/components/ClientNav';
import { useAuth } from '@/contexts/AuthContext';
import Avatar from '@/components/Avatar';
import { Search, Trash2, X, Loader2, Users, ExternalLink } from 'lucide-react';

function getToken() {
  return localStorage.getItem('supabase_token') || '';
}

export default function Leads() {
  const { accessToken } = useAuth();
  const token = accessToken || getToken();

  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetchProspects();
  }, []);

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ext/prospects', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      const list = data.data || data.prospects || data || [];
      setProspects(Array.isArray(list) ? list : []);
    } catch {}
    setLoading(false);
  };

  const filtered = prospects.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.title || '').toLowerCase().includes(q) || (p.company || '').toLowerCase().includes(q);
  });

  const toggleCheck = (id: string) => {
    const n = new Set(checked);
    n.has(id) ? n.delete(id) : n.add(id);
    setChecked(n);
  };
  const toggleAll = () => {
    if (checked.size === filtered.length) setChecked(new Set());
    else setChecked(new Set(filtered.map(p => p.id)));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const deleteSelected = async () => {
    if (checked.size === 0) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/ext/prospects', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds: Array.from(checked) }),
      });
      const data = await res.json();
      if (data.success || data.deleted) {
        // Optimistic remove
        setProspects(prev => prev.filter(p => !checked.has(p.id)));
        showToast(`${checked.size} prospect${checked.size > 1 ? 's' : ''} deleted`);
        setChecked(new Set());
      } else {
        showToast('Delete failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e: any) {
      showToast('Delete failed: ' + e.message);
    }
    setDeleting(false);
    setShowConfirm(false);
  };

  const deleteSingle = async (id: string) => {
    setChecked(new Set([id]));
    setDeleting(true);
    try {
      const res = await fetch('/api/ext/prospects', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds: [id] }),
      });
      const data = await res.json();
      if (data.success || data.deleted) {
        setProspects(prev => prev.filter(p => p.id !== id));
        showToast('1 prospect deleted');
      }
    } catch {}
    setDeleting(false);
    setChecked(new Set());
  };

  const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <ClientNav />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxHeight: '100vh' }}>
        <div style={{ maxWidth: 900 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>Leads</h2>
              <p style={{ color: '#64748b', fontSize: 13 }}>{prospects.length} prospects imported</p>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: '#475569' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, title, or company..."
              style={{
                width: '100%', padding: '10px 14px 10px 34px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
                color: '#f1f5f9', fontSize: 14, outline: 'none',
              }}
            />
          </div>

          {/* Bulk action bar */}
          {checked.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
              background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)',
              borderRadius: 10, padding: '10px 16px',
            }}>
              <span style={{ color: '#c4b5fd', fontWeight: 600, fontSize: 13 }}>{checked.size} selected</span>
              <button
                onClick={() => setShowConfirm(true)}
                style={{
                  background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Trash2 size={13} /> Delete Selected
              </button>
              <button
                onClick={() => setChecked(new Set())}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginLeft: 'auto', padding: 4 }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Delete Confirmation */}
          {showConfirm && (
            <div style={{
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8, padding: '10px 16px', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ color: '#fca5a5', fontSize: 13, flex: 1 }}>
                Delete {checked.size} prospect{checked.size > 1 ? 's' : ''}? This cannot be undone.
              </span>
              <button onClick={() => setShowConfirm(false)}
                style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={deleteSelected} disabled={deleting}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}

          {/* Table */}
          <div style={card}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 8 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                    <div className="skeleton" style={{ width: 120, height: 14 }} />
                    <div className="skeleton" style={{ width: 100, height: 12, marginLeft: 'auto' }} />
                    <div className="skeleton" style={{ width: 80, height: 12 }} />
                  </div>
                ))}
              </div>
            ) : prospects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <Users size={36} style={{ color: '#475569', margin: '0 auto 12px' }} />
                <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No prospects yet</h3>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Import prospects using the Wassel extension on LinkedIn.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', width: 36 }}>
                        <input type="checkbox" checked={checked.size === filtered.length && filtered.length > 0} onChange={toggleAll} style={{ accentColor: '#7c3aed' }} />
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Name</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Title</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Company</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>LinkedIn</th>
                      <th style={{ padding: '10px 12px', width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: checked.has(p.id) ? 'rgba(124,58,237,0.06)' : 'transparent' }}
                        className="leads-row">
                        <td style={{ padding: '10px 12px' }}>
                          <input type="checkbox" checked={checked.has(p.id)} onChange={() => toggleCheck(p.id)} style={{ accentColor: '#7c3aed' }} />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar name={p.name || '?'} size="sm" />
                            <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{p.name || '—'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{p.title || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{p.company || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {p.linkedin_url ? (
                            <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 4 }}
                              onClick={e => e.stopPropagation()}>
                              <ExternalLink size={12} /> Profile
                            </a>
                          ) : <span style={{ color: '#475569' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteSingle(p.id); }}
                            title="Delete prospect"
                            className="leads-delete-btn"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                              color: '#475569', opacity: 0,
                              transition: 'opacity 0.15s, color 0.15s',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, right: 24,
            background: '#1e293b', border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 10, padding: '12px 20px',
            color: '#f1f5f9', fontSize: 13, fontWeight: 500,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            zIndex: 1000, animation: 'slideUp 0.3s ease',
          }}>
            {toast}
          </div>
        )}

        <style>{`
          .leads-row:hover .leads-delete-btn { opacity: 1 !important; color: #ef4444 !important; }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </main>
    </div>
  );
}
