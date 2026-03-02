import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Users, Target, Clock, ArrowRight, Mail, Linkedin, Copy, Send } from 'lucide-react';
import { trpc } from '@/lib/trpc';

type Client = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  created_at: string;
  linkedin_connections?: Array<{ linkedin_name?: string; linkedin_email?: string }>;
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ success?: boolean; inviteLink?: string; emailSent?: boolean; error?: string } | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  const { data: profile, isLoading: profileLoading } = trpc.auth.me.useQuery();
  const { data: team, isLoading: teamLoading } = trpc.auth.getTeam.useQuery();

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('supabase_token');
      const res = await fetch('/api/clients/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch (e) {
      console.error('Failed to fetch clients:', e);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleSendInvite = async () => {
    if (!inviteEmail) return;
    setInviteLoading(true);
    setInviteResult(null);
    try {
      const token = localStorage.getItem('supabase_token');
      const res = await fetch('/api/invites/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  if (profileLoading || teamLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل لوحة التحكم...</p>
        </div>
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'مستخدم';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-600">وصل</h1>
            <p className="text-sm text-gray-600">لوحة التحكم الرئيسية</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{profile?.full_name || 'مستخدم'}</p>
              <p className="text-xs text-gray-500">{profile?.email}</p>
            </div>
            <Button onClick={handleLogout} variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">مرحباً بك يا {firstName}! 👋</h2>
          <p className="text-lg text-gray-600">منصة ذكية لإدارة حملات LinkedIn بكفاءة واحترافية</p>
        </div>

        {/* Invite Client */}
        <div className="mb-12">
          <Card className="p-6 border-l-4 border-l-indigo-600">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <Mail className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Invite Client</h3>
                <p className="text-sm text-gray-600">Send a LinkedIn connect invite to your client</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Input type="email" placeholder="client@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} disabled={inviteLoading} dir="ltr" />
              <Input type="text" placeholder="Client name (optional)" value={inviteName} onChange={(e) => setInviteName(e.target.value)} disabled={inviteLoading} dir="ltr" />
              <Button onClick={handleSendInvite} disabled={inviteLoading || !inviteEmail} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Send Invite
              </Button>
            </div>
            {inviteResult && (
              <div className={`rounded-lg p-4 ${inviteResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {inviteResult.success ? (
                  <div>
                    <p className="text-sm text-green-800 font-medium mb-2">
                      {inviteResult.emailSent ? '✅ Invite sent via email!' : '✅ Invite created — share the link:'}
                    </p>
                    {inviteResult.inviteLink && (
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-white px-3 py-2 rounded border flex-1 break-all">{inviteResult.inviteLink}</code>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(inviteResult.inviteLink!)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-red-800">{inviteResult.error}</p>
                )}
              </div>
            )}
          </Card>
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

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600 mb-1">الفريق</p><p className="text-2xl font-bold text-gray-900">{team?.name || 'فريقي'}</p></div><Users className="w-8 h-8 text-blue-600 opacity-20" /></div></Card>
          <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600 mb-1">الحملات</p><p className="text-2xl font-bold text-gray-900">0</p></div><Target className="w-8 h-8 text-indigo-600 opacity-20" /></div></Card>
          <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600 mb-1">العملاء المحتملين</p><p className="text-2xl font-bold text-gray-900">0</p></div><Users className="w-8 h-8 text-green-600 opacity-20" /></div></Card>
          <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600 mb-1">قائمة الانتظار</p><p className="text-2xl font-bold text-gray-900">0</p></div><Clock className="w-8 h-8 text-orange-600 opacity-20" /></div></Card>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-600">
            <Target className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">الحملات</h3>
            <p className="text-sm text-gray-600 mb-4">أنشئ وأدر حملات LinkedIn الخاصة بك بسهولة</p>
            <a href="/dashboard/campaigns" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1">اذهب إلى الحملات <ArrowRight className="w-4 h-4" /></a>
          </Card>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-green-600">
            <Users className="w-8 h-8 text-green-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">العملاء المحتملين</h3>
            <p className="text-sm text-gray-600 mb-4">استعرض وأدر قائمة العملاء المحتملين بفعالية</p>
            <a href="/dashboard/leads" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1">اذهب إلى العملاء <ArrowRight className="w-4 h-4" /></a>
          </Card>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-orange-600">
            <Clock className="w-8 h-8 text-orange-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">قائمة الانتظار</h3>
            <p className="text-sm text-gray-600 mb-4">راجع واعتمد الإجراءات المعلقة بعناية وثقة</p>
            <a href="/dashboard/queue" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1">اذهب إلى القائمة <ArrowRight className="w-4 h-4" /></a>
          </Card>
        </div>
      </main>
    </div>
  );
}
