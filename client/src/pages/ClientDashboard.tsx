import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
    Loader2, Linkedin, Target, Users, ExternalLink,
    ChevronRight, Download, CheckCircle
} from 'lucide-react';
import { Link } from 'wouter';
import ClientNav from '@/components/ClientNav';

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
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [prospects, setProspects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const campRes = await fetch('/api/ext/campaigns', { headers: authHeaders() });
            if (campRes.ok) {
                const campData = await campRes.json();
                setCampaigns(campData.campaigns || []);
            }
            const prospectsRes = await fetch('/api/ext/prospects', { headers: authHeaders() });
            if (prospectsRes.ok) {
                const prospectsData = await prospectsRes.json();
                setProspects(prospectsData.prospects || []);
            }
        } catch (e) {
            console.error('Failed to fetch dashboard data:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
                <ClientNav />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: 'var(--accent-primary)' }} />
                        <p style={{ color: 'var(--text-muted)' }}>Loading your workspace...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
            <ClientNav />

            {/* Main content — scrollable */}
            <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ maxHeight: '100vh' }}>
                {/* Welcome */}
                <div className="mb-6">
                    <h2 className="text-2xl font-extrabold mb-1" style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text-primary)' }}>
                        Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}!
                    </h2>
                    <p style={{ color: 'var(--text-muted)' }}>Here's an overview of your LinkedIn campaigns.</p>
                </div>

                {/* 3 Stat cards — visible immediately */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(12px)' }}>
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Total Campaigns</p>
                                <h3 className="text-3xl font-extrabold" style={{ fontFamily: "'Syne', sans-serif" }}>{campaigns.length}</h3>
                            </div>
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.12)' }}>
                                <Target className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                            </div>
                        </div>
                    </div>

                    <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(12px)' }}>
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Imported Prospects</p>
                                <h3 className="text-3xl font-extrabold" style={{ fontFamily: "'Syne', sans-serif" }}>{prospects.length}</h3>
                            </div>
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
                                <Users className="w-4 h-4" style={{ color: '#22c55e' }} />
                            </div>
                        </div>
                    </div>

                    <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(12px)' }}>
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>LinkedIn Status</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />
                                    <span className="text-sm font-medium" style={{ color: '#22c55e' }}>Connected</span>
                                </div>
                            </div>
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
                                <Linkedin className="w-4 h-4" style={{ color: '#6366f1' }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Campaigns List */}
                <div className="rounded-xl mb-6 overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Your Campaigns</h3>
                        <Link href="/app/campaigns">
                            <Button variant="ghost" size="sm" style={{ color: 'var(--text-muted)' }}>
                                View all <ChevronRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                        </Link>
                    </div>
                    <div>
                        {campaigns.length === 0 ? (
                            <div className="p-8 text-center">
                                <Target className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No campaigns yet. Create one to start importing leads.</p>
                            </div>
                        ) : (
                            campaigns.map((c) => (
                                <div key={c.id} className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <div>
                                        <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Created {new Date(c.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                                        style={{
                                            background: c.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)',
                                            color: c.status === 'active' ? '#22c55e' : '#94a3b8',
                                        }}>
                                        {c.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent Imports */}
                <div className="rounded-xl mb-6 overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Imports</h3>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{prospects.length} total</span>
                    </div>
                    <div>
                        {prospects.length === 0 ? (
                            <div className="p-8 text-center">
                                <Download className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No imports yet. Use the Chrome Extension to import prospects.</p>
                            </div>
                        ) : (
                            prospects.slice(0, 10).map((p) => (
                                <div key={p.id} className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <div>
                                        <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{p.name || 'Unknown'}</p>
                                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.title || ''} {p.company ? `at ${p.company}` : ''}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                                        {p.linkedin_url && (
                                            <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-secondary)' }}>
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Extension CTA */}
                <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-accent)', boxShadow: '0 0 30px rgba(124,58,237,0.08)' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Wassel Chrome Extension</h3>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                Import LinkedIn search results directly into your campaigns.
                            </p>
                        </div>
                        <Link href="/app/extension">
                            <Button size="sm" className="text-white" style={{ background: 'var(--gradient-primary)' }}>
                                <Download className="w-3.5 h-3.5 mr-1.5" />
                                Setup
                            </Button>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
