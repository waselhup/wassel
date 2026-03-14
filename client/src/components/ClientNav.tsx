import { useAuth } from '@/contexts/AuthContext';
import {
    LayoutDashboard, Target, Users, Download, Chrome,
    LogOut
} from 'lucide-react';
import { Link, useLocation } from 'wouter';

/**
 * Client navigation sidebar for /app/* pages.
 * Renders just <aside> — parent flex container is in each page.
 * RTL-aware: border switches side automatically via CSS.
 */
export default function ClientNav() {
    const { user, signOut } = useAuth();
    const [location] = useLocation();

    const handleLogout = async () => {
        try {
            // Clear ALL cached data first
            localStorage.removeItem('wassel_user_cache');
            localStorage.removeItem('supabase_token');
            localStorage.removeItem('wassel_admin_key');
            localStorage.removeItem('wassel_user');
            localStorage.removeItem('wassel_lang');
            // Clear any Supabase sb-* keys
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-') || key.startsWith('supabase')) {
                    localStorage.removeItem(key);
                }
            });
            await signOut();
        } catch (e) {
            console.error('Logout error:', e);
        }
        // Always redirect regardless of errors
        window.location.href = '/login';
    };

    const navItems = [
        { href: '/app', label: 'Overview', icon: LayoutDashboard, match: /^\/app\/?$/ },
        { href: '/app/campaigns', label: 'Campaigns', icon: Target, match: /^\/app\/campaigns/ },
        { href: '/app/leads', label: 'Leads', icon: Users, match: /^\/app\/leads/ },
        { href: '/app/import', label: 'Import', icon: Download, match: /^\/app\/import/ },
        { href: '/app/extension', label: 'Extension', icon: Chrome, match: /^\/app\/extension/ },
    ];

    const initials = user?.email
        ? user.email.slice(0, 2).toUpperCase()
        : 'WA';

    return (
        <aside
            className="w-60 flex flex-col justify-between shrink-0 h-screen"
            style={{
                background: 'var(--bg-surface)',
                borderInlineEnd: '1px solid var(--border-subtle)',
            }}
        >
            {/* Top: Logo + Nav */}
            <div>
                {/* Logo */}
                <div className="px-5 pt-6 pb-5">
                    <Link href="/app">
                        <div className="flex items-center gap-2.5 cursor-pointer">
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                                style={{ background: 'var(--gradient-primary)' }}
                            >
                                W
                            </div>
                            <span
                                className="text-lg font-extrabold tracking-tight"
                                style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text-primary)' }}
                            >
                                assel
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
                                        background: isActive ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
                                        border: isActive ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
                                        color: isActive ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                                    }}
                                >
                                    <item.icon
                                        className="w-4 h-4"
                                        style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                                    />
                                    {item.label}
                                </button>
                            </Link>
                        );
                    })}
                </nav>
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
                        style={{ background: 'var(--gradient-primary)' }}
                    >
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {user?.email || 'User'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="online-dot"></div>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Online</span>
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
    );
}
