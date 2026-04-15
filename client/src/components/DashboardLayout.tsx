import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { WasselLogo } from './WasselLogo';
import {
  Home, BarChart2, FileText, Send, Coins, User, BookOpen,
  LogOut, Globe, Menu, X, ChevronDown, Settings, TrendingUp, UserCheck, PenSquare
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, pageTitle }) => {
  const { t, i18n } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [userPlan, setUserPlan] = useState<string>('free');
  const isRTL = i18n.language === 'ar';

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('token_balance,plan').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setTokenBalance(data.token_balance ?? 0);
          setUserPlan(data.plan ?? 'free');
        }
      });
  }, [user?.id]);

  const planLabel: Record<string, string> = {
    free: isRTL ? '\u0645\u062c\u0627\u0646\u064a' : 'Free',
    starter: isRTL ? '\u0645\u0628\u062a\u062f\u0626' : 'Starter',
    pro: isRTL ? '\u0627\u062d\u062a\u0631\u0627\u0641\u064a' : 'Pro',
    elite: isRTL ? '\u0625\u0644\u064a\u062a' : 'Elite',
  };

  const nav = [
    { href: '/app', icon: Home, label: t('nav.home', '\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629') },
    { href: '/app/linkedin', icon: BarChart2, label: t('nav.linkedin', 'LinkedIn') },
    { href: '/app/profile-analysis', icon: UserCheck, label: t('nav.profileAnalysis', 'تحليل البروفايل') },
    { href: '/app/cv', icon: FileText, label: t('nav.cv', '\u0627\u0644\u0633\u064a\u0631\u0629') },
    { href: '/app/campaigns', icon: Send, label: t('nav.campaigns', '\u0627\u0644\u062d\u0645\u0644\u0627\u062a') },
    { href: '/app/posts', icon: PenSquare, label: t('nav.posts', '\u0627\u0644\u0645\u0646\u0634\u0648\u0631\u0627\u062a') },
    { href: '/app/tokens', icon: Coins, label: t('nav.tokens', '\u0627\u0644\u0631\u0635\u064a\u062f') },
    { href: '/app/knowledge', icon: BookOpen, label: t('nav.knowledge', '\u0627\u0644\u0645\u0639\u0631\u0641\u0629') },
    { href: '/app/analytics', icon: TrendingUp, label: t('nav.analytics', 'التحليلات') },
    { href: '/app/profile', icon: User, label: t('nav.profile', '\u0627\u0644\u0645\u0644\u0641') },
  ];

  const isActive = (href: string) => href === '/app' ? location === '/app' : location.startsWith(href);

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  const toggleLang = () => {
    const nl = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(nl);
    document.documentElement.lang = nl;
    document.documentElement.dir = nl === 'ar' ? 'rtl' : 'ltr';
  };

  const SidebarContent = () => (
    <aside style={{
      width: '240px', minWidth: '240px', height: '100vh',
      background: 'var(--wsl-surf)', borderInlineEnd: '1px solid var(--wsl-border)',
      display: 'flex', flexDirection: 'column', overflow: 'auto', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--wsl-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <WasselLogo size={38} />
        <span style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: '16px', color: 'var(--wsl-teal)' }}>
          {'\u0648\u0635\u0651\u0644'}
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {nav.map(item => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '8px', marginBottom: '2px',
                background: active ? 'var(--wsl-teal-bg)' : 'transparent',
                color: active ? 'var(--wsl-ink)' : 'var(--wsl-ink-3)',
                fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: '13px',
                textDecoration: 'none', cursor: 'pointer',
                borderInlineStart: active ? '2.5px solid var(--wsl-teal)' : '2.5px solid transparent',
                transition: 'all 150ms ease',
              }}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
              {active && <span style={{ marginInlineStart: 'auto', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--wsl-teal)' }} />}
            </Link>
          );
        })}
      </nav>

      {/* Token Balance */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--wsl-border)', background: 'var(--wsl-surf-2)' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--wsl-ink-3)', marginBottom: '4px', fontFamily: 'Cairo, sans-serif' }}>
          {t('nav.tokens', '\u0627\u0644\u0631\u0635\u064a\u062f')}
        </div>
        <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--wsl-teal)', fontFamily: 'Inter, sans-serif' }}>
          {tokenBalance !== null ? tokenBalance : '...'}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--wsl-ink-4)', marginTop: '2px', fontFamily: 'Cairo, sans-serif' }}>
          {planLabel[userPlan] || userPlan}
        </div>
      </div>

      {/* Bottom actions */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--wsl-border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button onClick={toggleLang} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--wsl-ink-3)', fontWeight: 900, fontSize: '12px', cursor: 'pointer', width: '100%' }}>
          <Globe size={14} />
          {i18n.language === 'ar' ? 'EN' : 'AR'}
        </button>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#DC2626', fontWeight: 900, fontSize: '12px', cursor: 'pointer', width: '100%', fontFamily: 'Cairo, sans-serif' }}>
          <LogOut size={14} />
          {t('nav.logout', '\u062e\u0631\u0648\u062c')}
        </button>
      </div>
    </aside>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--wsl-bg)', overflow: 'hidden' }}>
      {/* Desktop sidebar - always visible */}
      <div className="hidden lg:flex" style={{ height: '100vh' }}>
        <SidebarContent />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }} className="lg:hidden">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileOpen(false)} />
          <div style={{ position: 'relative', zIndex: 51, height: '100vh' }}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Header */}
        <header style={{
          background: 'rgba(244,247,251,0.94)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--wsl-border)', padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
          position: 'sticky', top: 0, zIndex: 40,
        }}>
          <button className="lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--wsl-ink-2)' }}>
            <Menu size={20} />
          </button>
          {pageTitle && (
            <h1 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: '20px', color: 'var(--wsl-ink)', letterSpacing: '-0.4px', margin: 0 }}>
              {pageTitle}
            </h1>
          )}
          <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: 'var(--wsl-teal-bg)', border: '1px solid var(--wsl-teal-border)' }}>
              <Coins size={14} style={{ color: 'var(--wsl-teal)' }} />
              <span style={{ fontWeight: 900, fontSize: '13px', color: 'var(--wsl-teal)', fontFamily: 'Inter, sans-serif' }}>
                {tokenBalance !== null ? tokenBalance : '...'}
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--wsl-border)', background: 'var(--wsl-surf)', cursor: 'pointer' }}>
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile?.full_name || ''}
                    referrerPolicy="no-referrer"
                    style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--wsl-teal)' }}
                  />
                ) : (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--wsl-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '13px', fontFamily: 'Cairo, sans-serif' }}>
                    {profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--wsl-ink-2)', fontFamily: 'Cairo, sans-serif' }}>
                  {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''}
                </span>
                <ChevronDown size={12} style={{ color: 'var(--wsl-ink-3)' }} />
              </button>
              {userMenuOpen && (
                <div style={{ position: 'absolute', top: '100%', insetInlineEnd: 0, marginTop: '4px', width: '160px', background: 'var(--wsl-surf)', border: '1px solid var(--wsl-border)', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden', zIndex: 50 }}>
                  <Link
                    href="/app/profile"
                    onClick={() => setUserMenuOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', color: 'var(--wsl-ink-2)', fontWeight: 700, fontSize: '12px', textDecoration: 'none', borderBottom: '1px solid var(--wsl-border)', fontFamily: 'Cairo, sans-serif' }}
                  >
                    <User size={13} /> {t('nav.profile', '\u0627\u0644\u0645\u0644\u0641')}
                  </Link>
                  <button onClick={() => { setUserMenuOpen(false); handleLogout(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', color: '#DC2626', fontWeight: 700, fontSize: '12px', border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', fontFamily: 'Cairo, sans-serif' }}>
                    <LogOut size={13} /> {t('nav.logout', '\u062e\u0631\u0648\u062c')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
