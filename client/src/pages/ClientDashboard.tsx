import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
    Loader2, Linkedin, Target, Users, ExternalLink,
    ChevronRight, Download, CheckCircle, Zap, BarChart3, UserCheck, MessageSquare, ArrowUpRight, RefreshCw
} from 'lucide-react';
import { Link } from 'wouter';
import ClientNav from '@/components/ClientNav';
import ProfileHeroCard from '@/components/ProfileHeroCard';
import ProspectCard from '@/components/ProspectCard';

function getAuthToken(): string {
    return localStorage.getItem('supabase_token') || '';
}

function authHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` };
}

type Campaign = {
    id: string;
    name: string;
    status: string;
    created_at: string;
};

export default function ClientDashboard() {
    const { user } = useAuth();
    const { t, i18n } = useTranslation();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [prospects, setProspects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [queueCount, setQueueCount] = useState(0);
    const [linkedinConnected, setLinkedinConnected] = useState(false);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [activityLoading, setActivityLoading] = useState(false);
    const [liProfile, setLiProfile] = useState<{ photoUrl: string | null; headline: string | null; fullName: string | null } | null>(null);

    const firstName = user?.user_metadata?.given_name ||
        user?.user_metadata?.name?.split(' ')[0] ||
        user?.email?.split('@')[0]?.split('.')[0] || 'there';
    const capitalName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    const photoUrl = user?.photoUrl || user?.user_metadata?.picture || user?.user_metadata?.avatar_url || null;

    function formatTimeAgo(dateStr: string): string {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }

    function formatDate(dateStr: string): string {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    }

    const fetchActivityLogs = async () => {
        setActivityLoading(true);
        try {
            const res = await fetch('/api/activity-log?limit=50', { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setActivityLogs(data.logs || []);
            }
        } catch {} finally { setActivityLoading(false); }
    };

    useEffect(() => {
        fetchData();
        fetchActivityLogs();
        // Poll activity logs every 5 seconds (only when tab is visible)
        const interval = setInterval(() => {
            if (!document.hidden) fetchActivityLogs();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Fetch LinkedIn profile (non-blocking for hero card)
    useEffect(() => {
        fetch('/api/linkedin/profile', { headers: authHeaders() })
            .then(r => r.json())
            .then(data => {
                if (data && (data.photoUrl || data.fullName || data.headline)) {
                    setLiProfile(data);
                }
            })
            .catch(() => {}); // silent fail — use fallback data
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [campRes, prospectsRes] = await Promise.all([
                fetch('/api/ext/campaigns', { headers: authHeaders() }),
                fetch('/api/ext/prospects', { headers: authHeaders() }),
            ]);

            if (campRes.ok) {
                const campData = await campRes.json();
                setCampaigns(campData.campaigns || []);
            }
            if (prospectsRes.ok) {
                const prospectsData = await prospectsRes.json();
                setProspects(prospectsData.prospects || []);
            }

            // Try queue count
            try {
                const queueRes = await fetch('/api/sequence/queue/active', { headers: authHeaders() });
                if (queueRes.ok) {
                    const queueData = await queueRes.json();
                    setQueueCount(queueData.queue?.length || 0);
                }
            } catch {}

            // Check LinkedIn connection
            try {
                const liRes = await fetch('/api/linkedin/status', { headers: authHeaders() });
                if (liRes.ok) {
                    const liData = await liRes.json();
                    setLinkedinConnected(liData.connected || false);
                }
            } catch {}

        } catch (e) {
            console.error('Failed to fetch dashboard data:', e);
        } finally {
            setLoading(false);
        }
    };

    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

    // Skeleton loader
    if (loading) {
        return (
            <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
                <ClientNav />
                <div className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxHeight: '100vh' }}>
                    <div style={{ maxWidth: 1100 }}>
                        <div className="skeleton" style={{ width: 280, height: 28, marginBottom: 8 }} />
                        <div className="skeleton" style={{ width: 200, height: 14, marginBottom: 28 }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
                            {[1,2,3,4].map(i => (
                                <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
                                    <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 12 }} />
                                    <div className="skeleton" style={{ width: 50, height: 28 }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const card: React.CSSProperties = {
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-sm)',
    };

    return (
        <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
            <ClientNav />

            <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxHeight: '100vh' }}>
                <div style={{ maxWidth: 1100 }}>

                    {/* ══ Connect LinkedIn Banner ══ */}
                    {!linkedinConnected && (
                        <div className="flex items-center justify-between px-5 py-4 rounded-xl mb-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                            <div className="flex items-center gap-3">
                                <Linkedin className="w-5 h-5" style={{ color: '#1a56db' }} />
                                <div>
                                    <p className="text-sm font-semibold" style={{ color: '#1e40af' }}>{t('dashboard.connectLinkedin')}</p>
                                </div>
                            </div>
                            <a href="/api/linkedin/connect">
                                <button className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#0077b5' }}>
                                    {t('dashboard.connectBtn')}
                                </button>
                            </a>
                        </div>
                    )}

                    {/* ══ Extension Download Banner ══ */}
                    {!user?.extensionInstalled && (
                        <div className="flex items-center justify-between px-5 py-4 rounded-xl mb-6" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            <div className="flex items-center gap-3">
                                <Download className="w-5 h-5" style={{ color: '#059669' }} />
                                <div>
                                    <p className="text-sm font-semibold" style={{ color: '#065f46' }}>{t('onboarding.extensionPage.title')}</p>
                                    <p className="text-xs" style={{ color: '#059669' }}>{t('onboarding.extensionPage.subtitle')}</p>
                                </div>
                            </div>
                            <Link href="/extension-download">
                                <button className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#059669' }}>
                                    {t('onboarding.extensionPage.downloadBtn')}
                                </button>
                            </Link>
                        </div>
                    )}

                    {/* ══ Profile Hero Card ══ */}
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div style={{ flex: 1, minWidth: 0, maxWidth: 360 }}>
                            <ProfileHeroCard
                                photoUrl={liProfile?.photoUrl || photoUrl}
                                fullName={liProfile?.fullName || capitalName}
                                headline={liProfile?.headline || null}
                                isOnline={true}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, paddingTop: 8 }}>
                            {user?.role === 'super_admin' && (
                                <Link href="/admin">
                                    <span className="text-xs px-3 py-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer" style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                                        لوحة الإدارة →
                                    </span>
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* ══ Main grid: stats + sidebar ══ */}
                    <div className="flex flex-col lg:flex-row gap-6">

                        {/* LEFT — Main stats area (60%) */}
                        <div className="flex-1 min-w-0">

                            {/* 4 Metric Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                {[
                                    { label: t('dashboard.stats.sequences'), value: campaigns.length, icon: Target, color: '#1a56db', bg: '#eff6ff' },
                                    { label: t('dashboard.stats.prospects'), value: prospects.length, icon: Users, color: '#059669', bg: '#ecfdf5' },
                                    { label: t('dashboard.stats.running'), value: activeCampaigns, icon: Zap, color: '#d97706', bg: '#fffbeb' },
                                    { label: t('dashboard.stats.queue'), value: queueCount, icon: BarChart3, color: '#6366f1', bg: '#eef2ff' },
                                ].map((stat, i) => (
                                    <div key={i} className="p-4" style={{ ...card }}>
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: stat.bg }}>
                                                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                                            </div>
                                        </div>
                                        <h3 className="text-2xl font-extrabold" style={{ fontFamily: "'Outfit', sans-serif" }}>{stat.value}</h3>
                                    </div>
                                ))}
                            </div>

                            {/* Campaigns List */}
                            <div className="mb-6" style={{ ...card, overflow: 'hidden' }}>
                                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('dashboard.campaigns')}</h3>
                                    <Link href="/app/campaigns">
                                        <button className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                                            {t('dashboard.viewAll')} <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </Link>
                                </div>
                                <div>
                                    {campaigns.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <Target className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                                            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>{t('dashboard.noCampaigns')}</p>
                                            <Link href="/app/campaigns/new">
                                                <button className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--gradient-primary)' }}>
                                                    + {t('dashboard.startCampaign')}
                                                </button>
                                            </Link>
                                        </div>
                                    ) : (
                                        campaigns.slice(0, 5).map((c) => (
                                            <Link key={c.id} href={`/app/campaigns/${c.id}`}>
                                                <div className="px-5 py-3.5 flex items-center justify-between transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                                                    <div>
                                                        <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                                                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                            {t('campaigns.created')} {formatDate(c.created_at)}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full"
                                                        style={{
                                                            background: c.status === 'active' ? '#ecfdf5' : c.status === 'paused' ? '#fffbeb' : '#f3f4f6',
                                                            color: c.status === 'active' ? '#059669' : c.status === 'paused' ? '#d97706' : '#6b7280',
                                                        }}>
                                                        {c.status === 'active' ? t('common.active') : c.status === 'paused' ? t('common.paused') : c.status === 'draft' ? t('common.draft') : c.status}
                                                    </span>
                                                </div>
                                            </Link>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Recent prospects */}
                            <div style={{ ...card, overflow: 'hidden' }}>
                                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('dashboard.recentProspects')}</h3>
                                    <Link href="/app/leads">
                                        <button className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                                            {t('dashboard.viewAll')} <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </Link>
                                </div>
                                <div className="p-4">
                                    {prospects.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <Download className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('dashboard.noProspects')}</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {prospects.slice(0, 4).map((p) => (
                                                <ProspectCard
                                                    key={p.id}
                                                    prospect={{
                                                        name: p.name || p.full_name || 'Unknown',
                                                        title: p.title,
                                                        company: p.company,
                                                        location: p.location,
                                                        linkedin_url: p.linkedin_url,
                                                        profile_picture_url: p.profile_picture_url || p.photo_url || p.avatar_url,
                                                    }}
                                                    showCheckbox={false}
                                                    showLinkedIn={false}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT — Sidebar (30%) */}
                        <div className="lg:w-[280px] flex-shrink-0 space-y-4">

                            {/* Prospecting Status */}
                            <div className="p-5" style={{ ...card }}>
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('dashboard.prospectingStatus')}</p>
                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: activeCampaigns > 0 ? '#ecfdf5' : '#f3f4f6', color: activeCampaigns > 0 ? '#059669' : '#6b7280' }}>
                                        {activeCampaigns > 0 ? t('common.active') : t('dashboard.idle')}
                                    </span>
                                </div>
                                <div className="flex gap-4">
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Zap className="w-3.5 h-3.5" style={{ color: '#d97706' }} />
                                            <span className="text-lg font-bold">{activeCampaigns}</span>
                                        </div>
                                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('dashboard.activeCampaigns')}</p>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <BarChart3 className="w-3.5 h-3.5" style={{ color: '#6366f1' }} />
                                            <span className="text-lg font-bold">{queueCount}</span>
                                        </div>
                                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('dashboard.queuedActions')}</p>
                                    </div>
                                </div>
                            </div>

                            {/* ══ Recent Activity Feed ══ */}
                            <div style={{ ...card, overflow: 'hidden' }}>
                                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('dashboard.recentActivity')}</p>
                                    <button onClick={fetchActivityLogs} className="p-1 rounded hover:bg-gray-100 transition" title="Refresh">
                                        <RefreshCw className={`w-3 h-3 ${activityLoading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-muted)' }} />
                                    </button>
                                </div>
                                <div className="px-4 py-2" style={{ maxHeight: 300, overflowY: 'auto' }}>
                                    {activityLogs.length === 0 ? (
                                        <div className="py-6 text-center">
                                            <Zap className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.noActivity')}</p>
                                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{t('dashboard.keepChromeOpen')}</p>
                                        </div>
                                    ) : (
                                        activityLogs.map((entry: any) => (
                                            <div key={entry.id} className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                <span className="text-base mt-0.5">
                                                    {entry.action_type === 'visit' ? '👁' :
                                                     entry.action_type === 'connect' || entry.action_type === 'invitation' ? '🤝' :
                                                     entry.action_type === 'message' ? '💬' : '⚡'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                                        {entry.prospect_name || 'Unknown prospect'}
                                                    </p>
                                                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                                                        {entry.action_type}{' '}
                                                        {entry.status === 'success' ? '✅' : entry.status === 'failed' ? '❌' : '⏳'}
                                                    </p>
                                                    <p className="text-[10px]" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                                                        {formatTimeAgo(entry.executed_at || entry.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="p-5" style={{ ...card }}>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t('dashboard.quickActions')}</p>
                                <div className="space-y-2">
                                    <Link href="/app/campaigns/new">
                                        <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors" style={{ background: 'var(--bg-card-hover, #f1f5f9)' }}>
                                            <Target className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                                            <span>{t('dashboard.startCampaign')}</span>
                                            <ArrowUpRight className="w-3 h-3 ml-auto" style={{ color: 'var(--text-muted)' }} />
                                        </button>
                                    </Link>
                                    <Link href="/app/extension">
                                        <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors" style={{ background: 'var(--bg-card-hover, #f1f5f9)' }}>
                                            <Download className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                                            <span>{t('dashboard.setupExtension')}</span>
                                            <ArrowUpRight className="w-3 h-3 ml-auto" style={{ color: 'var(--text-muted)' }} />
                                        </button>
                                    </Link>
                                    <Link href="/app/leads">
                                        <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors" style={{ background: 'var(--bg-card-hover, #f1f5f9)' }}>
                                            <Users className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                                            <span>{t('dashboard.viewProspects')}</span>
                                            <ArrowUpRight className="w-3 h-3 ml-auto" style={{ color: 'var(--text-muted)' }} />
                                        </button>
                                    </Link>
                                </div>
                            </div>

                            {/* Extension CTA */}
                            <div className="p-5" style={{ ...card, borderColor: 'var(--accent-primary)', background: '#eff6ff' }}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                                        <Zap className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: '#1e40af' }}>Chrome Extension</p>
                                        <p className="text-[10px]" style={{ color: '#3b82f6' }}>{t('onboarding.features.import')}</p>
                                    </div>
                                </div>
                                <Link href="/app/extension">
                                    <button className="w-full py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--gradient-primary)' }}>
                                        {t('dashboard.setupExtension')}
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
