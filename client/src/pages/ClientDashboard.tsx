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

type ImportJob = {
    id: string;
    campaign_id: string;
    source_url: string | null;
    prospect_count: number;
    status: string;
    created_at: string;
};

export default function ClientDashboard() {
    const { user } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [prospects, setProspects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [linkedinStatus, setLinkedinStatus] = useState<'connected' | 'pending' | 'unknown'>('unknown');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch campaigns
            const campRes = await fetch('/api/ext/campaigns', { headers: authHeaders() });
            if (campRes.ok) {
                const campData = await campRes.json();
                setCampaigns(campData.campaigns || []);
            }

            // Fetch prospects (recent imports)
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
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
                    <p className="text-gray-600">Loading your workspace...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
            <ClientNav />

            {/* Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Welcome */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                        Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}!
                    </h2>
                    <p className="text-gray-500">Here's an overview of your LinkedIn campaigns.</p>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Total Campaigns</p>
                                <h3 className="text-3xl font-bold text-gray-900 mt-1">{campaigns.length}</h3>
                            </div>
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Target className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Imported Prospects</p>
                                <h3 className="text-3xl font-bold text-gray-900 mt-1">{prospects.length}</h3>
                            </div>
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <Users className="w-5 h-5 text-green-600" />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">LinkedIn Status</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                    <span className="text-sm font-medium text-green-700">Connected</span>
                                </div>
                            </div>
                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <Linkedin className="w-5 h-5 text-indigo-600" />
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Campaigns */}
                <Card className="mb-8">
                    <div className="p-6 border-b">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Your Campaigns</h3>
                            <Link href="/app/campaigns">
                                <Button variant="outline" size="sm">
                                    View all <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                    <div className="divide-y">
                        {campaigns.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p>No campaigns yet.</p>
                                <p className="text-sm mt-1">Create a campaign in the Campaigns tab to start importing leads.</p>
                            </div>
                        ) : (
                            campaigns.map((c) => (
                                <div key={c.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                    <div>
                                        <p className="font-medium text-gray-900">{c.name}</p>
                                        <p className="text-xs text-gray-500">Created {new Date(c.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${c.status === 'active'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {c.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* Recent Imports */}
                <Card>
                    <div className="p-6 border-b">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Recent Imports</h3>
                            <span className="text-sm text-gray-500">{prospects.length} total prospects</span>
                        </div>
                    </div>
                    <div className="divide-y">
                        {prospects.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Download className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p>No imports yet.</p>
                                <p className="text-sm mt-1">Use the Wassel Chrome Extension to import prospects from LinkedIn.</p>
                            </div>
                        ) : (
                            prospects.slice(0, 10).map((p) => (
                                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                    <div>
                                        <p className="font-medium text-gray-900">{p.name || 'Unknown'}</p>
                                        <p className="text-sm text-gray-500">{p.title || ''} {p.company ? `at ${p.company}` : ''}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-400">
                                            {new Date(p.created_at).toLocaleDateString()}
                                        </span>
                                        {p.linkedin_url && (
                                            <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer"
                                                className="text-blue-500 hover:text-blue-700">
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* Extension CTA */}
                <div className="mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold">Wassel Chrome Extension</h3>
                            <p className="text-blue-100 text-sm mt-1">
                                Import LinkedIn search results directly into your campaigns.
                            </p>
                        </div>
                        <Link href="/extension">
                            <Button className="bg-white text-blue-600 hover:bg-blue-50">
                                <Download className="w-4 h-4 mr-2" />
                                Get Extension
                            </Button>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
