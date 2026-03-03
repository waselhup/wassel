import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Target, Clock, ArrowRight, Mail, Linkedin, Copy, Send, LogOut, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';

type Client = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  created_at: string;
  linkedin_connections?: Array<{ linkedin_name?: string; linkedin_email?: string }>;
};

type InviteRecord = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  clientStatus: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  tokenMasked: string;
  inviteUrl: string;
};

type InviteResult = {
  success?: boolean;
  clientId?: string;
  inviteToken?: string;
  inviteUrl?: string;
  sent?: boolean;
  provider?: string;
  message?: string;
  error?: string;
  emailError?: string;
};

function getAdminKey(): string {
  return localStorage.getItem('wassel_admin_key') || '';
}

function adminHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminKey()}` };
}

export default function Dashboard() {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const key = getAdminKey();
    if (!key) { window.location.href = '/login'; return; }
    fetchClients();
    fetchInvites();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients/status', { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      } else if (res.status === 401) {
        localStorage.removeItem('wassel_admin_key');
        window.location.href = '/login';
      }
    } catch (e) { console.error('Failed to fetch clients:', e); }
    finally { setLoading(false); }
  };

  const fetchInvites = async () => {
    try {
      const res = await fetch('/api/invites/latest', { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites || []);
      }
    } catch (e) { console.error('Failed to fetch invites:', e); }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail) return;
    setInviteLoading(true);
    setInviteResult(null);
    try {
      const res = await fetch('/api/invites/send', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ email: inviteEmail, name: inviteName || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInviteResult(data);
        setInviteEmail('');
        setInviteName('');
        fetchClients();
        fetchInvites();
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

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

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
  const invitedCount = clients.filter(c => c.status === 'invited' || c.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-600">Wassel</h1>
            <p className="text-sm text-gray-600">Admin Dashboard</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Invite Client ── */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" /> Invite Client
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <Input placeholder="Client email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="flex-1" type="email" />
            <Input placeholder="Name (optional)" value={inviteName} onChange={e => setInviteName(e.target.value)} className="sm:w-48" />
            <Button onClick={handleSendInvite} disabled={!inviteEmail || inviteLoading} className="bg-blue-600 hover:bg-blue-700">
              {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send Invite
            </Button>
          </div>

          {/* Invite Result */}
          {inviteResult && (
            inviteResult.success ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-800">Invite Created!</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${inviteResult.sent ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                    {inviteResult.sent ? `Email sent via ${inviteResult.provider}` : 'No email — copy link below'}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-white border border-green-300 rounded-md p-2">
                  <code className="text-sm text-gray-800 flex-1 break-all">{inviteResult.inviteUrl}</code>
                  <button onClick={() => copyText(inviteResult.inviteUrl!, 'link')} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center gap-1 whitespace-nowrap">
                    <Copy className="w-3 h-3" /> {copied === 'link' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                {inviteResult.emailError && (
                  <p className="text-xs text-red-600 mt-2">⚠ Email error: {inviteResult.emailError}</p>
                )}
                <p className="text-xs text-green-700 mt-2">{inviteResult.message}</p>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                <p className="text-sm text-red-800">❌ {inviteResult.error}</p>
              </div>
            )
          )}
        </Card>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600 mb-1">Total Clients</p><p className="text-2xl font-bold text-gray-900">{clients.length}</p></div><Users className="w-8 h-8 text-blue-600 opacity-20" /></div></Card>
          <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600 mb-1">Connected</p><p className="text-2xl font-bold text-green-600">{connectedCount}</p></div><Linkedin className="w-8 h-8 text-green-600 opacity-20" /></div></Card>
          <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600 mb-1">Pending</p><p className="text-2xl font-bold text-yellow-600">{invitedCount}</p></div><Mail className="w-8 h-8 text-yellow-600 opacity-20" /></div></Card>
        </div>

        {/* ── Clients ── */}
        {clients.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Clients</h3>
            <div className="grid gap-3">
              {clients.map(client => (
                <Card key={client.id} className="p-4">
                  <div className="flex items-center justify-between">
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
                        copyText(JSON.stringify({ clientId: client.id, apiUrl: `${window.location.origin}/api` }), client.id);
                        window.open('https://www.linkedin.com/search/results/people/', '_blank');
                      }}
                        className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 transition-colors inline-flex items-center gap-1 font-semibold">
                        ⚡ Operate
                      </button>
                      <a href="/extension" className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors">Extension</a>
                      <button onClick={() => copyText(JSON.stringify({ clientId: client.id, apiUrl: `${window.location.origin}/api` }), 'pair-' + client.id)}
                        className="text-xs bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors inline-flex items-center gap-1">
                        <Copy className="w-3 h-3" /> {copied === 'pair-' + client.id ? 'Copied!' : 'Pair'}
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {clients.length === 0 && (
          <Card className="p-12 text-center mb-8">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Clients Yet</h3>
            <p className="text-gray-500">Send your first invite above to get started.</p>
          </Card>
        )}

        {/* ── Invite History ── */}
        {invites.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Invite History</h3>
              <Button variant="outline" size="sm" onClick={fetchInvites}>
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invites.map(inv => (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{inv.email}</td>
                        <td className="px-4 py-3 text-gray-600">{inv.name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.status === 'used' ? 'bg-green-100 text-green-700' :
                              inv.status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {inv.status === 'used' ? 'Used ✅' : inv.status === 'expired' ? 'Expired ⏰' : 'Pending ⏳'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(inv.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(inv.expires_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => copyText(inv.inviteUrl, 'inv-' + inv.id)}
                              className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 inline-flex items-center gap-1">
                              <Copy className="w-3 h-3" /> {copied === 'inv-' + inv.id ? 'Copied!' : 'Copy'}
                            </button>
                            <a href={inv.inviteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── Navigation Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-600">
            <Target className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaigns</h3>
            <p className="text-sm text-gray-600 mb-4">Create and manage campaigns</p>
            <a href="/dashboard/campaigns" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1">Go <ArrowRight className="w-4 h-4" /></a>
          </Card>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-green-600">
            <Users className="w-8 h-8 text-green-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Leads</h3>
            <p className="text-sm text-gray-600 mb-4">View and manage prospects</p>
            <a href="/dashboard/leads" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1">Go <ArrowRight className="w-4 h-4" /></a>
          </Card>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-orange-600">
            <Clock className="w-8 h-8 text-orange-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Queue</h3>
            <p className="text-sm text-gray-600 mb-4">Review pending actions</p>
            <a href="/dashboard/queue" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1">Go <ArrowRight className="w-4 h-4" /></a>
          </Card>
        </div>
      </main>
    </div>
  );
}
