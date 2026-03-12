import { useAuth } from '@/contexts/AuthContext';
import {
    LayoutDashboard, Users, BarChart3,
    LogOut, Shield, Settings, ExternalLink
} from 'lucide-react';
import { Link, useLocation } from 'wouter';

/**
 * Admin sidebar navigation — dark theme with RED accent.
 * Visually distinct from client purple accent.
 */
export default function AdminNav() {
    const { user, signOut } = useAuth();
    const [location] = useLocation();

    const handleLogout = async () => {
        await signOut();
        window.location.href = '/login';
    };

    const navItems = [
        { href: '/admin', label: 'Overview', icon: LayoutDashboard, match: /^\/admin\/?$/ },
        { href: '/admin/customers', label: 'Customers', icon: Users, match: /^\/admin\/customers/ },
        { href: '/admin/stats', label: 'Usage Stats', icon: BarChart3, match: /^\/admin\/stats/ },
        { href: '/admin/settings', label: 'Settings', icon: Settings, match: /^\/admin\/settings/ },
    ];

    const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'AD';

    return (
        <div className="flex h-screen">
            <aside
                className="w-60 flex flex-col justify-between shrink-0"
                style={{
                    background: 'var(--bg-surface)',
                    borderRight: '1px solid var(--border-subtle)',
                }}
            >
                <div>
                    {/* Logo + Admin badge */}
                    <div className="px-5 pt-6 pb-5">
                        <Link href="/admin">
                            <div className="flex items-center gap-2.5 cursor-pointer">
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                                    style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}
                                >
                                    W
                                </div>
                                <span
                                    className="text-lg font-extrabold tracking-tight"
                                    style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text-primary)' }}
                                >
                                    assel
                                </span>
                                <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider"
                                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                                >
                                    Admin
                                </span>
                            </div>
                        </Link>
                    </div>

                    {/* Nav items */}
                    <nav className="px-3 space-y-1">
                        {navItems.map((item) => {
                            const isActive = item.match.test(location);
                            return (
                                <Link key={item.href} href={item.href}>
                                    <button
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                                        style={{
                                            background: isActive ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                                            border: isActive ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid transparent',
                                            color: isActive ? '#f87171' : 'var(--text-secondary)',
                                        }}
                                    >
                                        <item.icon
                                            className="w-4 h-4"
                                            style={{ color: isActive ? '#ef4444' : 'var(--text-muted)' }}
                                        />
                                        {item.label}
                                    </button>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Switch to client view */}
                    <div className="px-3 mt-6">
                        <Link href="/app">
                            <button
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                                style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Client View
                            </button>
                        </Link>
                    </div>
                </div>

                {/* User section */}
                <div
                    className="px-4 py-4 mx-3 mb-3 rounded-lg"
                    style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-subtle)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}
                        >
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {user?.email || 'Admin'}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <Shield className="w-2.5 h-2.5" style={{ color: '#ef4444' }} />
                                <span className="text-[10px]" style={{ color: '#ef4444' }}>Super Admin</span>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-1.5 rounded-md transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            title="Sign Out"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
}
