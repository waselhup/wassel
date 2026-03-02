import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Target, Clock, ArrowRight, Mail, Linkedin, Copy, Send, LogOut } from 'lucide-react';

type Client = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  created_at: string;
  linkedin_connections?: Array<{ linkedin_name?: string; linkedin_email?: string }>;
};

function getAdminKey(): string {
  return localStorage.getItem('wassel_admin_key') || '';
}

export default function Dashboard() {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ success?: boolean; inviteLink?: string; emailSent?: boolean; error?: string } | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Check admin auth
  useEffect(() => {
    const key = getAdminKey();
    if (!key) {
      window.location.href = '/login';
      return;
    }
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients/status', {
        headers: { Authorization: `Bearer ${getAdminKey()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      } else if (res.status === 401) {
        localStorage.removeItem('wassel_admin_key');
        window.location.href = '/login';
        return;
      }
    } catch (e) {
      console.error('Failed to fetch clients:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail) return;
    setInviteLoading(true);
    setInviteResult(null);
    try {
      const res = await fetch('/api/invites/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminKey()}` },
        body: JSON.stringify({ email: inviteEmail, name: inviteName || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteResult({ success: true, inviteLink: data.inviteLink, emailSent: data.emailSent });
        setInviteEmail('');
        setInviteName('');
        fetchClients();
      } else {
        setInviteResult({ error: data.error || 'Failed to send invite' });
      }
    } catch {
      setInviteResult({ error: 'Network error' });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wassel_admin_key');
    window.location.href = '/';
  };

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const connectedCount = clients.filter(c => c.status === 'connected').length;
  const invitedCount = clients.filter(c => c.status === 'invited').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-600">Wassel</h1>
            <p className="text-sm text-gray-600">Admin Dashboard</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Invite Client Card */}
        <div className="mb-8">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600" />
              Invite Client
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <Input
                placeholder="Client email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
                type="email"
              />
              <Input
                placeholder="Client name (optional)"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSendInvite} disabled={!inviteEmail || inviteLoading} className="bg-blue-600 hover:bg-blue-700">
                {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="ml-2">Send Invite</span>
              </Button>
            </div>

            {inviteResult && (
              <div className={`p-3 rounded-lg text-sm ${inviteResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {inviteResult.success ? (
                  <div>
                    <p className="text-green-800 font-medium mb-1">✅ Invite created!</p>
                    {inviteResult.inviteLink && (
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-green-100 px-2 py-1 rounded flex-1 overflow-auto">{inviteResult.inviteLink}</code>
                        <button onClick={() => copyToClipboard(inviteResult.inviteLink!)} className="text-green-700 hover:text-green-900">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-green-700 mt-1">
                      {inviteResult.emailSent ? '📧 Email sent to client' : '📋 Copy the link and share it with your client'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-red-800">{inviteResult.error}</p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600 mb-1">Total Clients</p><p className="text-2xl font-bold text-gray-900">{clients.length}</p></div><Users className="w-8 h-8 text-blue-600 opacity-20" /></div></Card>
          <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600 mb-1">Connected</p><p className="text-2xl font-bold text-green-600">{connectedCount}</p></div><Linkedin className="w-8 h-8 text-green-600 opacity-20" /></div></Card>
          <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600 mb-1">Pending</p><p className="text-2xl font-bold text-yellow-600">{invitedCount}</p></div><Mail className="w-8 h-8 text-yellow-600 opacity-20" /></div></Card>
        </div>

        {/* Client List */}
        {clients.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Clients</h3>
            <div className="grid gap-3">
              {clients.map((client) => (
                <Card key={client.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${client.status === 'connected' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {client.status === 'connected' ? <Linkedin className="w-5 h-5 text-green-600" /> : <Mail className="w-5 h-5 text-gray-400" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{client.name || client.email}</p>
                        <p className="text-sm text-gray-500">{client.email}</p>
                        {client.linkedin_connections?.[0]?.linkedin_name && (
                          <p className="text-xs text-blue-600">LinkedIn: {client.linkedin_connections[0].linkedin_name}</p>
                        )}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${client.status === 'connected' ? 'bg-green-100 text-green-700' :
                        client.status === 'invited' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                      {client.status === 'connected' ? 'Connected ✅' : client.status === 'invited' ? 'Invited 📧' : 'Pending ⏳'}
                    </span>
                  </div>
                  {client.status === 'connected' && (
                    <div className="flex items-center gap-2 mt-3 ml-14">
                      <button onClick={() => {
                        const config = JSON.stringify({ clientId: client.id, apiUrl: `${window.location.origin}/api` });
                        navigator.clipboard.writeText(config);
                        window.open('https://www.linkedin.com/search/results/people/', '_blank');
                      }}
                        className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 transition-colors inline-flex items-center gap-1 font-semibold"
                      >
                        ⚡ Operate
                      </button>
                      <a href="https://www.linkedin.com/search/results/people/" target="_blank" rel="noopener noreferrer"
                        className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors inline-flex items-center gap-1"
                      >
                        <Linkedin className="w-3 h-3" /> LinkedIn ↗
                      </a>
                      <a href="/extension"
                        className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
                      >
                        Extension
                      </a>
                      <button onClick={() => copyToClipboard(JSON.stringify({ clientId: client.id, apiUrl: `${window.location.origin}/api` }))}
                        className="text-xs bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors inline-flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Pair
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {clients.length === 0 && (
          <Card className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Clients Yet</h3>
            <p className="text-gray-500 mb-6">Send your first invite to get started. The client will connect their LinkedIn account, and you can start operating campaigns.</p>
          </Card>
        )}

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-600">
            <Target className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaigns</h3>
            <p className="text-sm text-gray-600 mb-4">Create and manage LinkedIn campaigns</p>
            <a href="/dashboard/campaigns" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1">Go to Campaigns <ArrowRight className="w-4 h-4" /></a>
          </Card>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-green-600">
            <Users className="w-8 h-8 text-green-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Leads</h3>
            <p className="text-sm text-gray-600 mb-4">View and manage your prospects</p>
            <a href="/dashboard/leads" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1">Go to Leads <ArrowRight className="w-4 h-4" /></a>
          </Card>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-orange-600">
            <Clock className="w-8 h-8 text-orange-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Queue</h3>
            <p className="text-sm text-gray-600 mb-4">Review and approve pending actions</p>
            <a href="/dashboard/queue" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1">Go to Queue <ArrowRight className="w-4 h-4" /></a>
          </Card>
        </div>
      </main>
    </div>
  );
}
