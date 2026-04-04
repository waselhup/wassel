import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import ClientNav from '@/components/ClientNav';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, ChevronRight, Loader2, Megaphone, Trash2, Play, Pause, Search } from 'lucide-react';

type Campaign = {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'draft' | 'completed';
  description?: string;
  created_at: string;
  type?: string;
  prospect_count?: number;
  completed_count?: number;
};

type StatusTab = 'all' | 'active' | 'paused' | 'draft' | 'completed';

export default function Campaigns() {
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const { accessToken } = useAuth();
  const token = accessToken || localStorage.getItem('supabase_token') || '';

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

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
        showToast(t('campaigns.deleted'));
      } else {
        showToast(t('campaigns.deleteFailed') + ': ' + (data.error || ''));
      }
    } catch (e: any) {
      showToast(t('campaigns.deleteFailed') + ': ' + e.message);
    }
    setDeleting(false);
    setDeleteId(null);
  };

  const toggleCampaignStatus = async (e: React.MouseEvent, campaign: Campaign) => {
    e.stopPropagation();
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    try {
      if (newStatus === 'active') {
        // Use cloud launch for activation
        const res = await fetch(`/api/cloud/campaign/${campaign.id}/launch`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (!data.success) {
          showToast(data.error || t('campaigns.activateFailed'));
          return;
        }
      } else {
        const res = await fetch('/api/trpc/campaigns.updateStatus', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ json: { id: campaign.id, status: newStatus } }),
        });
        const data = await res.json();
        if (data.error) {
          showToast(data.error.message || t('campaigns.pauseFailed'));
          return;
        }
      }
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus as any } : c));
      showToast(newStatus === 'active' ? t('campaigns.activated') : t('campaigns.paused'));
    } catch (e: any) {
      showToast(e.message);
    }
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

  const statusColors: Record<string, { dot: string; bg: string; text: string }> = {
    active: { dot: '#22c55e', bg: 'rgba(34,197,94,0.1)', text: '#86efac' },
    paused: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', text: '#fcd34d' },
    draft: { dot: '#64748b', bg: 'rgba(100,116,139,0.1)', text: '#94a3b8' },
    completed: { dot: '#3b82f6', bg: 'rgba(59,130,246,0.1)', text: '#93c5fd' },
  };

  function statusLabel(status: string): string {
    if (status === 'active') return t('common.active');
    if (status === 'paused') return t('common.paused');
    if (status === 'draft') return t('common.draft');
    if (status === 'completed') return t('common.completed');
    return status;
  }

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'all', label: t('common.all') },
    { key: 'active', label: t('common.active') },
    { key: 'paused', label: t('common.paused') },
    { key: 'draft', label: t('common.draft') },
    { key: 'completed', label: t('common.completed') },
  ];

  const tabCounts = campaigns.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filtered = campaigns.filter(c => {
    const matchesTab = activeTab === 'all' || c.status === activeTab;
    const matchesSearch = !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const card: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s',
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <ClientNav />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxHeight: '100vh' }}>
        <div style={{ maxWidth: 860 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>
                {t('campaigns.title')}
              </h2>
              <p style={{ color: '#64748b', fontSize: 13 }}>{t('campaigns.manage')}</p>
            </div>
            <button
              onClick={() => navigate('/app/campaigns/templates')}
              style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> {t('campaigns.new')}
            </button>
          </div>

          {/* Tabs + Search */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', padding: 4, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
              {tabs.map(tab => {
                const count = tab.key === 'all' ? campaigns.length : (tabCounts[tab.key] || 0);
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 600 : 400,
                      background: isActive ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : 'transparent',
                      color: isActive ? '#fff' : '#64748b', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    {tab.label}
                    {count > 0 && (
                      <span style={{
                        background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(100,116,139,0.2)',
                        borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                      }}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('common.search') + '...'}
                style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: '#f1f5f9', fontSize: 13, outline: 'none' }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => (
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
          ) : filtered.length === 0 ? (
            campaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
                <Megaphone size={40} style={{ color: '#475569', margin: '0 auto 16px' }} />
                <h3 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{t('campaigns.noCampaigns')}</h3>
                <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>{t('campaigns.noCampaignsDesc')}</p>
                <button
                  onClick={() => navigate('/app/campaigns/templates')}
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={16} /> {t('campaigns.createFirst')}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: 14 }}>
                {t('common.noResults')}
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map((c) => {
                const st = statusColors[c.status] || statusColors.draft;
                return (
                  <div
                    key={c.id}
                    style={card}
                    onClick={() => navigate(`/app/campaigns/${c.id}`)}
                    onMouseOver={e => { (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)'); (e.currentTarget.style.transform = 'translateY(-1px)'); }}
                    onMouseOut={e => { (e.currentTarget.style.borderColor = 'var(--border-subtle)'); (e.currentTarget.style.transform = 'none'); }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                          <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 700, margin: 0 }}>{c.name}</h3>
                          <span style={{ background: st.bg, color: st.text, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                            {statusLabel(c.status)}
                          </span>
                        </div>
                        {c.description && (
                          <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>{c.description}</p>
                        )}
                        <div style={{ display: 'flex', gap: 16, color: '#475569', fontSize: 12, flexWrap: 'wrap' }}>
                          <span>{t('campaigns.created')} {formatDate(c.created_at)}</span>
                          {c.type && <span>{t('campaigns.type')}: {c.type}</span>}
                          {typeof c.prospect_count === 'number' && (
                            <span style={{ color: '#7c3aed' }}>
                              👥 {c.prospect_count} {t('leads.prospects')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        {/* Pause/Resume button */}
                        {(c.status === 'active' || c.status === 'paused') && (
                          <button
                            onClick={e => toggleCampaignStatus(e, c)}
                            title={c.status === 'active' ? t('common.pause') : t('common.resume')}
                            style={{
                              background: c.status === 'active' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
                              border: c.status === 'active' ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(34,197,94,0.25)',
                              borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
                              color: c.status === 'active' ? '#fcd34d' : '#86efac',
                              display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                            }}>
                            {c.status === 'active' ? <><Pause size={12} /> {t('common.pause')}</> : <><Play size={12} /> {t('common.resume')}</>}
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteId(c.id)}
                          title={t('common.delete')}
                          className="campaign-delete-btn"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#475569', opacity: 0, transition: 'all 0.15s', borderRadius: 6 }}>
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight size={16} style={{ color: '#475569' }} onClick={() => navigate(`/app/campaigns/${c.id}`)} />
                      </div>
                    </div>

                    {deleteId === c.id && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: '#fca5a5', fontSize: 12, flex: 1 }}>{t('campaigns.deleteConfirm', { name: c.name })}</span>
                        <button onClick={() => setDeleteId(null)} style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>{t('common.cancel')}</button>
                        <button onClick={() => deleteCampaign(c.id)} disabled={deleting} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>
                          {deleting ? <Loader2 size={11} style={{ display: 'inline' }} /> : t('common.delete')}
                        </button>
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
          <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1e293b', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 10, padding: '12px 20px', color: '#f1f5f9', fontSize: 13, fontWeight: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 1000 }}>
            {toast}
          </div>
        )}

        <style>{`
          .campaign-delete-btn:hover { opacity: 1 !important; color: #ef4444 !important; }
          div[style*="cursor: pointer"]:hover .campaign-delete-btn { opacity: 0.6 !important; }
        `}</style>
      </main>
    </div>
  );
}
