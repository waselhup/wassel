import { useState, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'wouter';
import AdminNav from '@/components/AdminNav';
import { Users, Target, TrendingUp, Database, Clock, Shield, Eye, Ban, ArrowLeft, Search, BarChart3, Activity } from 'lucide-react';

function getAuthToken(): string {
  return localStorage.getItem('supabase_token') || '';
}

function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` };
}

function timeAgo(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ========== Impersonation Banner ========== */
function ImpersonationBanner() {
  const impersonating = localStorage.getItem('admin_impersonate_email');
  if (!impersonating) return null;

  const exitImpersonation = () => {
    const backup = localStorage.getItem('admin_backup_token');
    if (backup) {
      localStorage.setItem('supabase_token', backup);
      localStorage.removeItem('admin_backup_token');
      localStorage.removeItem('admin_impersonate_email');
      window.location.href = '/admin/customers';
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center text-sm font-semibold text-white"
      style={{ background: 'linear-gradient(90deg, #dc2626, #ef4444)' }}>
      ⚠️ Viewing as <strong>{impersonating}</strong>
      <button onClick={exitImpersonation} className="ml-4 px-3 py-1 rounded text-xs font-bold"
        style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
        Exit Impersonation
      </button>
    </div>
  );
}

/* ========== Metric Card ========== */
function MetricCard({ icon: Icon, label, value, sub, color = '#ef4444' }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <p className="text-3xl font-extrabold" style={{ fontFamily: "'Syne', sans-serif" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

/* ========================================================
   OVERVIEW VIEW (/admin)
   ======================================================== */
function OverviewView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/overview', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-subtle)', borderTopColor: '#ef4444' }}></div></div>;

  const m = data?.metrics || {};
  const activity = data?.activity || [];

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>Admin Overview</h1>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={Users} label="Total Customers" value={m.totalTeams} />
        <MetricCard icon={Activity} label="Active This Week" value={m.activeWeek} color="#22c55e" />
        <MetricCard icon={Target} label="Campaigns Running" value={m.activeCampaigns} color="#f59e0b" />
        <MetricCard icon={Database} label="Total Prospects" value={m.totalProspects?.toLocaleString()} color="#a855f7" />
      </div>

      {/* Activity Feed */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Recent Activity</h3>
        {activity.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>No recent activity</p>
        ) : (
          <div className="space-y-3">
            {activity.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2 rounded-lg px-3 transition" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: a.type === 'signup' ? '#22c55e' : '#ef4444' }}>
                  {a.name?.slice(0, 2).toUpperCase() || '??'}
                </div>
                <p className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{a.text}</p>
                <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>{timeAgo(a.time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================
   CUSTOMERS TABLE VIEW (/admin/customers)
   ======================================================== */
function CustomersView() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'date' | 'active' | 'prospects'>('date');
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch('/api/admin/customers', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setCustomers(d.customers || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const impersonate = async (userId: string, email: string) => {
    if (!confirm(`Impersonate ${email}?`)) return;
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ targetUserId: userId }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('admin_backup_token', getAuthToken());
        localStorage.setItem('supabase_token', data.token);
        localStorage.setItem('admin_impersonate_email', email);
        window.location.href = '/app';
      }
    } catch (e) { console.error(e); }
  };

  const toggleSuspend = async (teamId: string) => {
    try {
      const res = await fetch(`/api/admin/customers/${teamId}/suspend`, {
        method: 'POST', headers: authHeaders(),
      });
      const { status } = await res.json();
      setCustomers(prev => prev.map(c => c.id === teamId ? { ...c, status } : c));
    } catch (e) { console.error(e); }
  };

  const filtered = customers
    .filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'active') return new Date(b.lastActive || 0).getTime() - new Date(a.lastActive || 0).getTime();
      if (sort === 'prospects') return (b.prospects || 0) - (a.prospects || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const planColors: Record<string, string> = { trial: '#94a3b8', starter: '#3b82f6', growth: '#a855f7', agency: '#f59e0b' };
  const statusColors: Record<string, string> = { active: '#22c55e', inactive: '#94a3b8', suspended: '#ef4444' };

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>Customers</h1>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as any)}
          className="px-3 py-2.5 rounded-lg text-sm"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
          <option value="date">Signup Date</option>
          <option value="active">Last Active</option>
          <option value="prospects">Prospects</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-subtle)', borderTopColor: '#ef4444' }}></div></div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Customer</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Plan</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Prospects</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Campaigns</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Status</th>
                <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="transition" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.email}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: `${planColors[c.plan] || '#94a3b8'}20`, color: planColors[c.plan] || '#94a3b8' }}>
                      {c.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm" style={{ color: 'var(--text-secondary)' }}>{c.prospects}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm" style={{ color: 'var(--text-secondary)' }}>{c.campaigns}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: `${statusColors[c.status] || '#94a3b8'}15`, color: statusColors[c.status] || '#94a3b8', border: `1px solid ${statusColors[c.status] || '#94a3b8'}40` }}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/admin/customers/${c.id}`}>
                        <button className="p-1.5 rounded-md" style={{ color: 'var(--text-muted)' }} title="View"><Eye className="w-3.5 h-3.5" /></button>
                      </Link>
                      {c.userId && (
                        <button onClick={() => impersonate(c.userId, c.email)} className="p-1.5 rounded-md" style={{ color: '#f59e0b' }} title="Impersonate">
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => toggleSuspend(c.id)} className="p-1.5 rounded-md" style={{ color: c.status === 'suspended' ? '#22c55e' : '#ef4444' }} title={c.status === 'suspended' ? 'Unsuspend' : 'Suspend'}>
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No customers found</p>}
        </div>
      )}
    </div>
  );
}

/* ========================================================
   CUSTOMER DETAIL VIEW (/admin/customers/:id)
   ======================================================== */
function CustomerDetailView({ teamId }: { teamId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/customers/${teamId}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [teamId]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-subtle)', borderTopColor: '#ef4444' }}></div></div>;
  if (!data?.team) return <p style={{ color: 'var(--text-muted)' }}>Team not found</p>;

  const m = data.metrics || {};
  const planColors: Record<string, string> = { trial: '#94a3b8', starter: '#3b82f6', growth: '#a855f7', agency: '#f59e0b' };

  return (
    <div>
      <Link href="/admin/customers">
        <button className="flex items-center gap-1.5 text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Customers
        </button>
      </Link>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-extrabold" style={{ fontFamily: "'Syne', sans-serif" }}>
          {data.profile?.full_name || data.team.name || 'Customer'}
        </h1>
        <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full"
          style={{ background: `${planColors[data.team.plan] || '#94a3b8'}20`, color: planColors[data.team.plan] || '#94a3b8' }}>
          {data.team.plan}
        </span>
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{data.profile?.email}</p>

      {/* 4 Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={Users} label="Prospects" value={m.prospects} />
        <MetricCard icon={Target} label="Active Campaigns" value={m.activeCampaigns} color="#f59e0b" />
        <MetricCard icon={TrendingUp} label="Accept Rate" value={`${m.acceptanceRate}%`} color="#22c55e" />
        <MetricCard icon={Clock} label="Days Since Signup" value={m.daysSinceSignup} color="#a855f7" />
      </div>

      {/* Campaigns Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
        <div className="px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Campaigns</h3>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {(data.campaigns || []).map((c: any) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</td>
                <td className="px-4 py-3">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                    style={{ background: c.status === 'active' ? '#22c55e15' : '#94a3b815', color: c.status === 'active' ? '#22c55e' : '#94a3b8' }}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{c.type}</td>
                <td className="px-4 py-3 text-xs text-right" style={{ color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!data.campaigns || data.campaigns.length === 0) && <p className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>No campaigns</p>}
      </div>
    </div>
  );
}

/* ========================================================
   USAGE STATS VIEW (/admin/stats)
   ======================================================== */
function StatsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-subtle)', borderTopColor: '#ef4444' }}></div></div>;

  const daily = data?.dailyData || [];
  const tableCounts = data?.tableCounts || {};
  const maxSignup = Math.max(...daily.map((d: any) => d.signups), 1);
  const maxInvite = Math.max(...daily.map((d: any) => d.invites), 1);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>Platform Stats</h1>

      {/* System Health Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {Object.entries(tableCounts).map(([table, count]) => (
          <div key={table} className="p-4 rounded-xl text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>{(count as number).toLocaleString()}</p>
            <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: 'var(--text-muted)' }}>{table}</p>
          </div>
        ))}
      </div>

      {/* Daily Signups Chart */}
      <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Daily Signups (30 days)</h3>
        <div className="flex items-end gap-1 h-32">
          {daily.map((d: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${(d.signups / maxSignup) * 100}%`,
                  minHeight: d.signups > 0 ? '4px' : '1px',
                  background: d.signups > 0 ? '#ef4444' : 'rgba(255,255,255,0.06)',
                }}
                title={`${d.date}: ${d.signups} signups`}
              ></div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Invites Chart */}
      <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Daily Invites Sent (30 days)</h3>
        <div className="flex items-end gap-1 h-32">
          {daily.map((d: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${(d.invites / maxInvite) * 100}%`,
                  minHeight: d.invites > 0 ? '4px' : '1px',
                  background: d.invites > 0 ? '#a855f7' : 'rgba(255,255,255,0.06)',
                }}
                title={`${d.date}: ${d.invites} invites`}
              ></div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Connections Chart */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Daily Connections (30 days)</h3>
        <div className="flex items-end gap-1 h-32">
          {daily.map((d: any, i: number) => {
            const maxConn = Math.max(...daily.map((x: any) => x.connections), 1);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${(d.connections / maxConn) * 100}%`,
                    minHeight: d.connections > 0 ? '4px' : '1px',
                    background: d.connections > 0 ? '#22c55e' : 'rgba(255,255,255,0.06)',
                  }}
                  title={`${d.date}: ${d.connections} connections`}
                ></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ========================================================
   SETTINGS PLACEHOLDER
   ======================================================== */
function SettingsView() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6" style={{ fontFamily: "'Syne', sans-serif" }}>Admin Settings</h1>
      <div className="rounded-xl p-10 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-lg mb-2" style={{ color: 'var(--text-secondary)' }}>⚙️ Settings coming soon</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Email configuration, plan management, and system settings will be here.</p>
      </div>
    </div>
  );
}

/* ========================================================
   MAIN DASHBOARD EXPORT
   ======================================================== */
export default function Dashboard() {
  const [location] = useLocation();

  // Determine which sub-view to show
  const customerDetailMatch = location.match(/^\/admin\/customers\/(.+)/);
  let view = 'overview';
  let detailId = '';

  if (customerDetailMatch) {
    view = 'detail';
    detailId = customerDetailMatch[1];
  } else if (location.startsWith('/admin/customers')) {
    view = 'customers';
  } else if (location.startsWith('/admin/stats')) {
    view = 'stats';
  } else if (location.startsWith('/admin/settings')) {
    view = 'settings';
  }

  return (
    <>
      <ImpersonationBanner />
      <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <AdminNav />
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto" style={{ maxHeight: '100vh' }}>
          {view === 'overview' && <OverviewView />}
          {view === 'customers' && <CustomersView />}
          {view === 'detail' && <CustomerDetailView teamId={detailId} />}
          {view === 'stats' && <StatsView />}
          {view === 'settings' && <SettingsView />}
        </main>
      </div>
    </>
  );
}
