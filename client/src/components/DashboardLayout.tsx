import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import UserAvatar from '@/components/UserAvatar';
import { WasselLogo } from './WasselLogo';
import {
  Home, FileText, Send, Coins, User, LogOut, Globe, Menu,
  ChevronDown, TrendingUp, UserCheck, PenSquare, Shield, TicketCheck, HelpCircle
} from 'lucide-react';
import FeedbackFAB from './FeedbackFAB';

interface DashboardLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

interface NavItem {
  href: string;
  icon: any;
  label: string;
  comingSoon?: boolean;
  badge?: number;
}

interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
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
  const font = isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif';

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('token_balance,plan').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setTokenBalance(data.token_balance ?? 0);
          setUserPlan(data.plan ?? 'free');
        }
      });
  }, [user?.id, location]);

  const planLabel: Record<string, string> = {
    free: isRTL ? 'مجاني' : 'Free',
    starter: isRTL ? 'مبتدئ' : 'Starter',
    pro: isRTL ? 'احترافي' : 'Pro',
    elite: isRTL ? 'إليت' : 'Elite',
  };

  const overviewItems: NavItem[] = [
    { href: '/app', icon: Home, label: t('nav.home', isRTL ? 'الرئيسية' : 'Dashboard') },
    { href: '/app/profile-analysis', icon: UserCheck, label: t('nav.profileAnalysis', isRTL ? 'تحليل البروفايل' : 'Profile Analysis') },
  ];

  const toolItems: NavItem[] = [
    { href: '/app/cv', icon: FileText, label: t('nav.cv', isRTL ? 'السيرة الذاتية' : 'CV Tailor') },
    { href: '/app/posts', icon: PenSquare, label: t('nav.posts', isRTL ? 'استوديو المنشورات' : 'Posts Studio') },
    { href: '/app/coming-soon?feature=campaigns', icon: Send, label: t('nav.campaigns', isRTL ? 'الحملات' : 'Campaigns'), comingSoon: true },
    { href: '/app/analytics', icon: TrendingUp, label: t('nav.analytics', isRTL ? 'التحليلات' : 'Analytics') },
  ];

  const accountItems: NavItem[] = [
    { href: '/app/profile', icon: User, label: t('nav.profile', isRTL ? 'الإعدادات' : 'Settings') },
    { href: '/app/tickets', icon: TicketCheck, label: t('nav.tickets', isRTL ? 'الدعم والمساعدة' : 'Help & Support') },
  ];

  const ADMIN_EMAILS = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];
  if (ADMIN_EMAILS.includes(user?.email || '')) {
    accountItems.push({ href: '/app/admin', icon: Shield, label: t('nav.admin', isRTL ? 'لوحة الإدارة' : 'Admin') });
  }

  const groups: NavGroup[] = [
    { key: 'overview', label: isRTL ? 'نظرة عامة' : 'Overview', items: overviewItems },
    { key: 'tools', label: isRTL ? 'الأدوات' : 'Tools', items: toolItems },
    { key: 'account', label: isRTL ? 'الحساب' : 'Account', items: accountItems },
  ];

  const isActive = (href: string) => {
    const base = href.split('?')[0];
    if (base === '/app') return location === '/app';
    return location.startsWith(base);
  };

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

  const NavLink: React.FC<{ item: NavItem }> = ({ item }) => {
    const active = isActive(item.href);
    const dim = item.comingSoon;
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.55rem 0.75rem',
          borderRadius: 8,
          marginBottom: 2,
          background: active ? 'var(--bg-off)' : 'transparent',
          color: active ? 'var(--text)' : (dim ? 'var(--text-muted)' : 'var(--text-dim)'),
          fontFamily: font,
          fontWeight: active ? 500 : 400,
          fontSize: '0.85rem',
          textDecoration: 'none',
          cursor: 'pointer',
          opacity: dim ? 0.75 : 1,
          transition: 'all 120ms ease',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = 'var(--bg-off)';
            e.currentTarget.style.color = 'var(--text)';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = dim ? 'var(--text-muted)' : 'var(--text-dim)';
          }
        }}
      >
        {active && (
          <span
            style={{
              position: 'absolute',
              insetInlineStart: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 3,
              height: 20,
              background: 'var(--brand)',
              borderRadius: isRTL ? '2px 0 0 2px' : '0 2px 2px 0',
            }}
          />
        )}
        <Icon size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.badge != null && (
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'var(--brand)',
              color: 'white',
              minWidth: 18,
              textAlign: 'center',
            }}
          >
            {item.badge}
          </span>
        )}
        {item.comingSoon && (
          <span
            style={{
              fontSize: '0.6rem',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'var(--border-soft)',
              color: 'var(--text-muted)',
              fontFamily: font,
            }}
          >
            {t('common.comingSoon', isRTL ? 'قريباً' : 'Soon')}
          </span>
        )}
      </Link>
    );
  };

  const SidebarContent: React.FC = () => (
    <aside
      style={{
        width: 248,
        minWidth: 248,
        height: '100vh',
        background: 'var(--bg)',
        borderInlineEnd: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        flexShrink: 0,
        fontFamily: font,
      }}
    >
      {/* Brand lockup */}
      <div
        style={{
          padding: '1.15rem 1rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <WasselLogo size={30} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1 }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>
            {isRTL ? 'وصل' : 'Wassel'}
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: 0.2 }}>
            {planLabel[userPlan] || userPlan}
          </span>
        </div>
      </div>

      {/* Groups */}
      <nav style={{ flex: 1, padding: '0.5rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {groups.map((g) => (
          <div key={g.key}>
            <div
              style={{
                padding: '0.4rem 0.75rem 0.35rem',
                fontSize: '0.65rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                fontWeight: 600,
                fontFamily: font,
              }}
            >
              {g.label}
            </div>
            {g.items.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        ))}
      </nav>

      {/* Tokens */}
      <div
        style={{
          margin: '0.65rem',
          padding: '0.75rem 0.85rem',
          border: '1px solid var(--border)',
          borderRadius: 10,
          background: 'var(--bg-off)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'var(--brand-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Coins size={15} color="var(--brand-deep)" strokeWidth={1.6} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {t('nav.tokens', isRTL ? 'الرصيد' : 'Tokens')}
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'Inter, sans-serif', lineHeight: 1.1 }}>
            {tokenBalance !== null ? tokenBalance.toLocaleString('en-US') : '…'}
          </div>
        </div>
      </div>

      {/* User block */}
      <div
        style={{
          padding: '0.75rem 0.85rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <UserAvatar
          avatarUrl={profile?.avatar_url}
          name={profile?.full_name}
          email={user?.email}
          size="sm"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 500,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''}
          </div>
          <div
            style={{
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.email}
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div
        style={{
          padding: '0.4rem 0.65rem 0.85rem',
          display: 'flex',
          gap: 4,
        }}
      >
        <button
          onClick={toggleLang}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '0.45rem 0.6rem',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'white',
            color: 'var(--text-body)',
            fontWeight: 500,
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontFamily: font,
          }}
        >
          <Globe size={13} strokeWidth={1.5} />
          {i18n.language === 'ar' ? 'EN' : 'AR'}
        </button>
        <button
          onClick={handleLogout}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '0.45rem 0.6rem',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'white',
            color: 'var(--text-body)',
            fontWeight: 500,
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontFamily: font,
          }}
        >
          <LogOut size={13} strokeWidth={1.5} />
          {t('nav.logout', isRTL ? 'خروج' : 'Logout')}
        </button>
      </div>
    </aside>
  );

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: 'var(--bg-off)',
        overflow: 'hidden',
        fontFamily: font,
      }}
    >
      <div className="hidden lg:flex" style={{ height: '100vh' }}>
        <SidebarContent />
      </div>

      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }} className="lg:hidden">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} onClick={() => setMobileOpen(false)} />
          <div style={{ position: 'relative', zIndex: 51, height: '100vh' }}>
            <SidebarContent />
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <header
          className="dl-topbar"
          style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(14px)',
            borderBottom: '1px solid var(--border)',
            padding: '0.85rem 1.4rem',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          <button
            className="lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              padding: 6,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'white',
              cursor: 'pointer',
              color: 'var(--text-body)',
            }}
          >
            <Menu size={18} strokeWidth={1.5} />
          </button>
          {pageTitle && (
            <h1
              style={{
                fontFamily: font,
                fontWeight: 500,
                fontSize: '1.1rem',
                color: 'var(--text)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              {pageTitle}
            </h1>
          )}
          <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0.35rem 0.7rem',
                borderRadius: 8,
                background: 'white',
                border: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--brand)',
                }}
              />
              <Coins size={13} strokeWidth={1.5} style={{ color: 'var(--text-dim)' }} />
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: 'var(--text)',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {tokenBalance !== null ? tokenBalance.toLocaleString('en-US') : '…'}
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0.3rem 0.55rem 0.3rem 0.35rem',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'white',
                  cursor: 'pointer',
                  fontFamily: font,
                }}
              >
                <UserAvatar
                  avatarUrl={profile?.avatar_url}
                  name={profile?.full_name}
                  email={user?.email}
                  size="sm"
                />
                <span style={{ fontWeight: 500, fontSize: '0.78rem', color: 'var(--text)' }}>
                  {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''}
                </span>
                <ChevronDown size={12} style={{ color: 'var(--text-dim)' }} strokeWidth={1.5} />
              </button>
              {userMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    insetInlineEnd: 0,
                    width: 180,
                    background: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                    zIndex: 50,
                    fontFamily: font,
                  }}
                >
                  <Link
                    href="/app/profile"
                    onClick={() => setUserMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '0.6rem 0.85rem',
                      color: 'var(--text-body)',
                      fontWeight: 500,
                      fontSize: '0.78rem',
                      textDecoration: 'none',
                      borderBottom: '1px solid var(--border-soft)',
                    }}
                  >
                    <User size={13} strokeWidth={1.5} /> {t('nav.profile', isRTL ? 'الملف' : 'Profile')}
                  </Link>
                  <Link
                    href="/app/tickets"
                    onClick={() => setUserMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '0.6rem 0.85rem',
                      color: 'var(--text-body)',
                      fontWeight: 500,
                      fontSize: '0.78rem',
                      textDecoration: 'none',
                      borderBottom: '1px solid var(--border-soft)',
                    }}
                  >
                    <HelpCircle size={13} strokeWidth={1.5} /> {t('nav.help', isRTL ? 'الدعم' : 'Support')}
                  </Link>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '0.6rem 0.85rem',
                      color: '#b91c1c',
                      fontWeight: 500,
                      fontSize: '0.78rem',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      width: '100%',
                      fontFamily: font,
                    }}
                  >
                    <LogOut size={13} strokeWidth={1.5} /> {t('nav.logout', isRTL ? 'خروج' : 'Logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main
          className="dl-main"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '1.75rem 2rem',
            background: 'var(--bg-off)',
          }}
        >
          {children}
        </main>
        <FeedbackFAB />
      </div>
    </div>
  );
};

export default DashboardLayout;
