import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Users, Mail, Settings, LogOut, Globe, Menu, X,
  ChevronDown, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
}

interface AdminLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, pageTitle }) => {
  const { t, i18n } = useTranslation();
  const { profile, signOut } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Redirect if not admin
  if (!profile?.is_admin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-surface)]">
        <div className="text-center">
          <p className="text-[var(--text-secondary)] mb-4">{t('admin.notAuthorized')}</p>
          <Link href="/app">
            <a className="text-[var(--accent-primary)] hover:underline">
              {t('common.back')}
            </a>
          </Link>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    const { error } = await signOut();
    if (!error) {
      window.location.href = '/';
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  const isArabic = i18n.language === 'ar';

  const navItems: NavItem[] = [
    { label: t('admin.dashboard'), icon: <BarChart3 className="w-5 h-5" />, href: '/admin' },
    { label: t('admin.users'), icon: <Users className="w-5 h-5" />, href: '/admin/users' },
    { label: t('admin.campaigns'), icon: <Mail className="w-5 h-5" />, href: '/admin/campaigns' },
    { label: t('admin.settings'), icon: <Settings className="w-5 h-5" />, href: '/admin/settings' },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') return location === '/admin';
    return location.startsWith(href);
  };
  return (
    <div className="flex h-screen bg-[var(--bg-surface)]">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{
          x: isArabic ? (sidebarOpen ? 0 : 280) : (sidebarOpen ? 0 : -280),
        }}
        transition={{ duration: 0.3 }}
        className={`fixed ${isArabic ? 'right-0' : 'left-0'} top-0 h-screen w-80 bg-[var(--bg-base)] border-${isArabic ? 'l' : 'r'} border-[var(--border-subtle)] z-50 lg:relative lg:translate-x-0 overflow-y-auto flex flex-col`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 hover:bg-[var(--bg-surface)] rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 pt-8 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-cairo font-bold text-[var(--accent-primary)]">
              وصّل
            </h1>
            <span className="px-2 py-1 text-xs font-semibold bg-[var(--accent-primary)] text-white rounded">
              {t('admin.adminBadge')}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                }`}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </a>
            </Link>
          ))}
        </nav>

        <div className="border-t border-[var(--border-subtle)] p-4 space-y-3">
          <Link href="/app">
            <a className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {t('admin.backToApp')}
            </a>
          </Link>

          <button
            onClick={toggleLanguage}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <Globe className="w-4 h-4" />
            {i18n.language === 'ar' ? 'EN' : 'AR'}
          </button>

          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </motion.aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-[var(--bg-base)] border-b border-[var(--border-subtle)] sticky top-0 z-40">
          <div className="px-4 md:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-[var(--bg-surface)] rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              {pageTitle && (
                <h2 className="text-xl font-cairo font-semibold text-[var(--text-primary)]">
                  {pageTitle}
                </h2>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <UserAvatar
                    avatarUrl={profile?.avatar_url}
                    name={profile?.full_name}
                    email={profile?.email}
                    size="sm"
                  />
                  <span className="hidden sm:inline text-sm font-medium text-[var(--text-primary)]">
                    {profile?.full_name?.split(' ')[0] || 'Admin'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`absolute top-full ${isArabic ? 'left-0' : 'right-0'} mt-2 w-48 bg-[var(--bg-base)] rounded-lg border border-[var(--border-subtle)] shadow-lg overflow-hidden z-50`}
                    >
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors text-red-600"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm">{t('nav.logout')}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;