import React, { useState } from 'react';
import { Menu, X, BarChart3, Zap, Users, Send, FileText, Cog, LogOut } from 'lucide-react';
import { useLocation } from 'wouter';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [, setLocation] = useLocation();

  const navItems = [
    { icon: BarChart3, label: 'لوحة التحكم', labelEn: 'Dashboard', href: '/dashboard' },
    { icon: Zap, label: 'الحملات', labelEn: 'Campaigns', href: '/dashboard/campaigns' },
    { icon: Users, label: 'الجهات المحتملة', labelEn: 'Leads', href: '/dashboard/leads' },
    { icon: Send, label: 'قائمة الانتظار', labelEn: 'Queue', href: '/dashboard/queue' },
    { icon: FileText, label: 'القوالب', labelEn: 'Templates', href: '/dashboard/templates' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen && (
            <h2 className="text-xl font-bold text-blue-600">وصل</h2>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => setLocation(item.href)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors ${
                  window.location.pathname === item.href
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <Icon size={20} className="flex-shrink-0" />
                <span className={`${sidebarOpen ? 'block' : 'hidden'} font-medium text-right`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-gray-200 p-3 space-y-2">
          <button onClick={() => setLocation('/dashboard/settings')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors text-gray-700">
            <Cog size={20} className="flex-shrink-0" />
            <span className={`${sidebarOpen ? 'block' : 'hidden'} font-medium text-right`}>
              الإعدادات
            </span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 transition-colors text-gray-700 hover:text-red-600">
            <LogOut size={20} className="flex-shrink-0" />
            <span className={`${sidebarOpen ? 'block' : 'hidden'} font-medium text-right`}>
              تسجيل الخروج
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <div className="text-gray-600 text-right">
            <span className="text-sm">أهلاً بعودتك</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-400 rounded-full flex items-center justify-center text-white font-semibold">
              أ
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
