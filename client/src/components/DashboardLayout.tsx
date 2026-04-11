import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import {
  Home, UserCog, Linkedin, FileText, Mail, Coins, User,
  LogOut, Globe, Menu, X, ChevronDown, BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, pageTitle }) => {
  const { t, i18n } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  React.useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  // Direct Supabase fetch for token_balance and plan on every navigation
  // Initialize from AuthContext profile immediately (no flicker)
  useEffect(() => {
    if (profile) {
      if (tokenBalance === null) setTokenBalance(profile.token_balance ?? 0);
      if (plan === null) setPlan(profile.plan ?? 'free');
    }
  }, [profile]);

  // Fetch fresh data from Supabase ONCE on mount (not on every navigation)
  useEffect(() => {
    const fetchFreshData = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('token_balance, plan')
          .eq('id', user.id)
          .single();
        if (data) {
          setTokenBalance(data.token_balance ?? 0);
          setPlan(data.plan ?? 'free');
        }
      } catch (err) {
        console.error('[DashboardLayout] Failed to fetch profile:', err);
      }
    };
    fetchFreshData();
  }, [user?.id]);

  const displayTokens = tokenBalance !== null ? tokenBalance : '...';
  const displayPlan = (() => {
    if (!plan) return '...';
    switch (plan) {
      case 'free': return t('nav.plan.free');
      case 'starter': return t('nav.plan.starter');
      case 'pro': return t('nav.plan.pro');
      case 'elite': return t('nav.plan.elite');
      default: return plan;
    }
  })();

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
    { label: t('sidebar.home'), icon: <Home className="w-5 h-5" />, href: '/app' },
    { label: t('sidebar.setup'), icon: <UserCog className="w-5 h-5" />, href: '/app/setup' },
    { label: t('sidebar.linkedin'), icon: <Linkedin className="w-5 h-5" />, href: '/app/linkedin' },
    { label: t('sidebar.cv'), icon: <FileText className="w-5 h-5" />, href: '/app/cv' },
    { label: t('sidebar.campaigns'), icon: <Mail className="w-5 h-5" />, href: '/app/campaigns' },
    { label: t('sidebar.knowledge'), icon: <BookOpen className="w-5 h-5" />, href: '/app/knowledge' },
    { label: t('sidebar.tokens'), icon: <Coins className="w-5 h-5" />, href: '/app/tokens' },
    { label: t('sidebar.profile'), icon: <User className="w-5 h-5" />, href: '/app/profile' },
  ];

  const isActive = (href: string) => {
    if (href === '/app') return location === '/app';
    return location.startsWith(href);
  };

  return (
    <div className="flex h-screen bg-[var(--bg-surface)] overflow-hidden">
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

      <aside className="hidden lg:flex lg:flex-col h-screen w-72 bg-[var(--bg-base)] border-e border-[var(--border-subtle)] overflow-y-auto flex-shrink-0"
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 hover:bg-[var(--bg-surface)] rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 pt-8 border-b border-[var(--border-subtle)]">
          <h1 className="text-2xl font-cairo font-bold text-[var(--accent-primary)]">
            وصّل
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 ${
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

        <div className="border-t border-[var(--border-subtle)] p-4">
          <div className="bg-[var(--bg-surface)] rounded-lg p-4">
            <p className="text-xs text-[var(--text-secondary)] mb-1">{t('sidebar.tokens')}</p>
            <p className="text-2xl font-bold text-[var(--accent-primary)]">
              {displayTokens}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              {t('nav.balance')}: <span className="font-semibold text-[var(--text-primary)]">{displayPlan}</span>
            </p>
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)] p-4 space-y-3">
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
      </aside>

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
              <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent-primary)] bg-opacity-10">
                <Coins className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="text-sm font-semibold text-[var(--accent-primary)]">
                  {displayTokens}
                </span>
              </div>

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--accent-secondary)] flex items-center justify-center text-white font-semibold">
                    {profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <span className="hidden sm:inline text-sm font-medium text-[var(--text-primary)]">
                    {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''}
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
                      <Link href="/app/profile">
                        <a
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors border-b border-[var(--border-subtle)]"
                        >
                          <User className="w-4 h-4" />
                          <span className="text-sm">{t('sidebar.profile')}</span>
                        </a>
                      </Link>
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

export default DashboardLayout;




