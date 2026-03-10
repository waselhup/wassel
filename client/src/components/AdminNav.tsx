import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard, Users, Send, Activity, UserCog,
    LogOut, Shield, Settings
} from 'lucide-react';
import { Link, useLocation } from 'wouter';

/**
 * Admin navigation bar for /admin/* pages.
 * Shows: Dashboard, Clients, Invites, Imports, System
 */
export default function AdminNav() {
    const { user, signOut } = useAuth();
    const [location] = useLocation();

    const handleLogout = async () => {
        await signOut();
        window.location.href = '/login';
    };

    const navItems = [
        { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, match: /^\/admin\/?$/ },
        { href: '/admin/clients', label: 'Clients', icon: Users, match: /^\/admin\/clients/ },
        { href: '/admin/operate', label: 'Operate', icon: UserCog, match: /^\/admin\/operate/ },
    ];

    return (
        <>
            {/* Top header */}
            <header className="bg-gray-900 border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-14">
                        <div className="flex items-center gap-3">
                            <Link href="/admin">
                                <span className="text-lg font-bold text-white cursor-pointer">Wassel</span>
                            </Link>
                            <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                Admin
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-400 hidden sm:inline">{user?.email}</span>
                            <Link href="/app">
                                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                                    Client View
                                </Button>
                            </Link>
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-white">
                                <LogOut className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Tab navigation */}
            <nav className="bg-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex gap-1">
                        {navItems.map((item) => {
                            const isActive = item.match.test(location);
                            return (
                                <Link key={item.href} href={item.href}>
                                    <button
                                        className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${isActive
                                                ? 'text-white border-blue-400'
                                                : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'
                                            }`}
                                    >
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </button>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </nav>
        </>
    );
}
