import { useAuth } from '@/contexts/AuthContext';
import Avatar from '@/components/Avatar';
import {
    LayoutDashboard, Target, Users, FileText, Chrome,
    LogOut, Globe
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';

/**
 * Client navigation sidebar for /app/* pages.
 * Renders just <aside> — parent flex container is in each page.
 * RTL-aware: border switches side automatically via CSS.
 * Includes language toggle (AR/EN) and mobile bottom nav support.
 */
export default function ClientNav() {
    const { user, signOut } = useAuth();
    const { t, i18n } = useTranslation();
    const [location] = useLocation();

    const handleLogout = async () => {
        try {
            localStorage.removeItem('wassel_user_cache');
            localStorage.removeItem('supabase_token');
            localStorage.removeItem('wassel_admin_key');
            localStorage.removeItem('wassel_user');
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-') || key.startsWith('supabase')) {
                    localStorage.removeItem(key);
                }
            });
            await signOut();
        } catch (e) {
            console.error('Logout error:', e);
        }
        window.location.href = '/login';
    };

    const toggleLang = () => {
        const newLang = i18n.language === 'ar' ? 'en' : 'ar';
        i18n.changeLanguage(newLang);
    };

    const navItems = [
        { href: '/app', label: t('nav.dashboard'), icon: LayoutDashboard, match: /^\/app\/?$/ },
        { href: '/app/campaigns', label: t('nav.campaigns'), icon: Target, match: /^\/app\/campaigns/ },
        { href: '/app/leads', label: t('nav.prospects'), icon: Users, match: /^\/app\/leads/ },
        { href: '/app/posts', label: t('nav.posts'), icon: FileText, match: /^\/app\/posts/ },
        { href: '/app/extension', label: t('nav.extension'), icon: Chrome, match: /^\/app\/extension/ },
    ];

    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const avatarUrl = user?.user_metadata?.avatar_url || null;

    return (
        <aside
            className="client-nav-sidebar w-60 flex flex-col justify-between shrink-0 h-screen"
            style={{
                background: 'var(--bg-surface)',
                borderInlineEnd: '1px solid var(--border-subtle)',
            }}
        >
            {/* Top: Logo + Nav */}
            <div>
                {/* Logo */}
                <div className="px-5 pt-6 pb-5 desktop-only">
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
                                    className="nav-item w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
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
                                    <span className="nav-label">{item.label}</span>
                                </button>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Bottom: Language toggle + User section */}
            <div className="desktop-only">
                {/* Language Toggle */}
                <div className="px-3 mb-2">
                    <button
                        onClick={toggleLang}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all"
                        style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                        }}
                    >
                        <span className="flex items-center gap-2">
                            <Globe className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                            {i18n.language === 'en' ? '🌐 العربية' : '🌐 English'}
                        </span>
                        <span style={{ opacity: 0.5, fontSize: '11px' }}>
                            {i18n.language === 'en' ? 'EN' : 'AR'}
                        </span>
                    </button>
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
                        <Avatar name={displayName} size="md" imageUrl={avatarUrl} />
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
            </div>
        </aside>
    );
}
