import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Target, Trash2, Zap, ChevronRight } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Link } from 'wouter';
import ClientNav from '@/components/ClientNav';

export default function Campaigns() {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'invitation_message' as const,
  });

  // Fetch campaigns
  const { data: campaigns, isLoading, refetch } = trpc.campaigns.list.useQuery();

  // Create campaign mutation
  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      setFormData({ name: '', description: '', type: 'invitation_message' });
      setShowCreateForm(false);
      refetch();
    },
  });

  // Delete campaign mutation
  const deleteCampaign = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      await createCampaign.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
      });
    } catch (err) {
      console.error('[Campaigns] Create failed:', err);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه الحملة؟')) {
      await deleteCampaign.mutateAsync({ id });
    }
  };

  const campaignTypes: Record<string, string> = {
    invitation: 'Invitations',
    message: 'Messages',
    invitation_message: 'Invite + Message',
    visit: 'Profile Visits',
    email_finder: 'Email Finder',
    combined: 'Combined',
  };

  const statusLabels: Record<string, { text: string; bg: string; color: string }> = {
    active: { text: 'Active', bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
    draft: { text: 'Draft', bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
    paused: { text: 'Paused', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    completed: { text: 'Completed', bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <ClientNav />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-primary)' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <ClientNav />

      <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxHeight: '100vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-3" style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text-primary)' }}>
              <Target className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
              Campaigns
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Create and manage your LinkedIn outreach campaigns</p>
          </div>
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            size="sm"
            className="text-white flex items-center gap-1.5"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            New Campaign
          </Button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-accent)', boxShadow: '0 0 30px rgba(124,58,237,0.08)' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Create New Campaign</h2>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Campaign Name *</label>
                <Input
                  type="text"
                  placeholder="e.g., Q2 LinkedIn Outreach"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description (optional)</label>
                <textarea
                  placeholder="Add a description for your campaign..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Campaign Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  {Object.entries(campaignTypes).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {createCampaign.error && (
                <div className="text-xs p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                  {createCampaign.error.message}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={createCampaign.isPending || !formData.name.trim()}
                  size="sm"
                  className="text-white flex items-center gap-1.5"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  {createCampaign.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating...</>
                  ) : (
                    <><Zap className="w-3.5 h-3.5" />Create Campaign</>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                  style={{ color: 'var(--text-muted)' }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Campaigns Grid */}
        {campaigns && campaigns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((campaign: any) => {
              const st = statusLabels[campaign.status] || statusLabels.draft;
              return (
                <div key={campaign.id} className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{campaign.name}</h3>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {campaignTypes[campaign.type] || campaign.type}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                      {st.text}
                    </span>
                  </div>

                  {campaign.description && (
                    <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{campaign.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Prospects</p>
                      <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{campaign.stats?.total_leads || 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Completed</p>
                      <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{campaign.stats?.completed || 0}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/app/campaigns/${campaign.id}`}>
                      <Button variant="ghost" size="sm" className="flex-1 text-xs" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                        Details <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                    <button
                      onClick={() => handleDeleteCampaign(campaign.id)}
                      disabled={deleteCampaign.isPending}
                      className="p-1.5 rounded-md transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <Target className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No campaigns yet</h3>
            <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Create your first campaign to start outreach</p>
            <Button
              onClick={() => setShowCreateForm(true)}
              size="sm"
              className="text-white mx-auto flex items-center gap-1.5"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Create Campaign
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
