import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard, Target, Users, Download, Chrome,
    LogOut, Settings
} from 'lucide-react';
import { Link, useLocation } from 'wouter';

/**
 * Client navigation bar for /app/* pages.
 * Shows: Overview, Campaigns, Leads, Import, Extension
 */
export default function ClientNav() {
    const { user, signOut } = useAuth();
    const [location] = useLocation();

    const handleLogout = async () => {
        await signOut();
        window.location.href = '/login';
    };

    const navItems = [
        { href: '/app', label: 'Overview', icon: LayoutDashboard, match: /^\/app\/?$/ },
        { href: '/app/campaigns', label: 'Campaigns', icon: Target, match: /^\/app\/campaigns/ },
        { href: '/app/leads', label: 'Leads', icon: Users, match: /^\/app\/leads/ },
        { href: '/app/import', label: 'Import', icon: Download, match: /^\/app\/import/ },
        { href: '/app/extension', label: 'Extension', icon: Chrome, match: /^\/app\/extension/ },
    ];

    return (
        <>
            {/* Top header */}
            <header className="bg-white border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-14">
                        <div className="flex items-center gap-3">
                            <Link href="/app">
                                <span className="text-lg font-bold text-blue-600 cursor-pointer">Wassel</span>
                            </Link>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Client</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500 hidden sm:inline">{user?.email}</span>
                            <Button variant="ghost" size="sm" onClick={handleLogout}>
                                <LogOut className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Tab navigation */}
            <nav className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex gap-1 overflow-x-auto">
                        {navItems.map((item) => {
                            const isActive = item.match.test(location);
                            return (
                                <Link key={item.href} href={item.href}>
                                    <button
                                        className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${isActive
                                                ? 'text-blue-600 border-blue-600'
                                                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
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
