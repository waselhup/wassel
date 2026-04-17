import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Menu, X, Globe } from 'lucide-react';
import { WasselLogo } from '../WasselLogo';

const NAV_ITEMS: Array<{ href: string; key: string; labelAr: string; labelEn: string }> = [
  { href: '#features', key: 'features', labelAr: 'المميزات', labelEn: 'Features' },
  { href: '#how', key: 'how', labelAr: 'كيف يعمل', labelEn: 'How it works' },
  { href: '#demo', key: 'demo', labelAr: 'العرض', labelEn: 'Demo' },
  { href: '#pricing', key: 'pricing', labelAr: 'الأسعار', labelEn: 'Pricing' },
];

export default function LandingNav() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleLang = () => {
    const next = isAr ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <>
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 60,
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          background: scrolled ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.6)',
          borderBottom: scrolled ? '0.5px solid rgba(15,23,42,0.08)' : '0.5px solid transparent',
          boxShadow: scrolled ? '0 1px 0 rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.12)' : 'none',
          transition: 'background 200ms, border-color 200ms, box-shadow 200ms',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <WasselLogo size={30} />
            <span
              style={{
                fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                fontWeight: 800,
                fontSize: 17,
                color: '#0F766E',
                letterSpacing: '-0.02em',
              }}
            >
              {isAr ? 'وصّل' : 'Wassel'}
            </span>
          </Link>

          {/* Center nav — desktop only */}
          <nav
            className="hidden md:flex"
            style={{ flex: 1, justifyContent: 'center', gap: 28 }}
          >
            {NAV_ITEMS.map((item) => (
              <a
                key={item.key}
                href={item.href}
                style={{
                  fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: 14,
                  color: '#334155',
                  textDecoration: 'none',
                  transition: 'color 150ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#0F766E')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#334155')}
              >
                {isAr ? item.labelAr : item.labelEn}
              </a>
            ))}
          </nav>

          <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={toggleLang}
              aria-label="Toggle language"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid rgba(15,23,42,0.08)',
                background: 'rgba(255,255,255,0.6)',
                color: '#0F172A',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                letterSpacing: 0.5,
              }}
            >
              <Globe size={13} />
              {isAr ? 'EN' : 'AR'}
            </button>

            <Link
              href="/login"
              className="hidden sm:inline-flex"
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 13,
                color: '#0F172A',
                textDecoration: 'none',
                transition: 'color 150ms',
              }}
            >
              {isAr ? 'تسجيل الدخول' : 'Sign in'}
            </Link>

            <Link
              href="/signup"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '9px 16px',
                borderRadius: 10,
                fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 13,
                color: '#fff',
                background: '#0F766E',
                textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(15,118,110,0.3), inset 0 1px 0 rgba(255,255,255,0.12)',
                transition: 'transform 150ms, background 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#115E59';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#0F766E';
              }}
            >
              {isAr ? 'ابدأ مجاناً' : 'Get started'}
            </Link>

            <button
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Menu"
              style={{
                padding: 8,
                borderRadius: 8,
                border: '1px solid rgba(15,23,42,0.08)',
                background: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
              }}
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(255,255,255,0.98)',
              backdropFilter: 'blur(20px)',
              padding: '20px 24px',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <WasselLogo size={30} />
                <span style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 17, color: '#0F766E' }}>
                  {isAr ? 'وصّل' : 'Wassel'}
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
                style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(15,23,42,0.08)', background: '#fff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {NAV_ITEMS.map((item, i) => (
                <motion.a
                  key={item.key}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.04 }}
                  style={{
                    padding: '16px 8px',
                    borderBottom: '1px solid rgba(15,23,42,0.06)',
                    fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: 18,
                    color: '#0F172A',
                    textDecoration: 'none',
                  }}
                >
                  {isAr ? item.labelAr : item.labelEn}
                </motion.a>
              ))}
            </nav>
            <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                style={{
                  textAlign: 'center',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px solid rgba(15,23,42,0.1)',
                  background: '#fff',
                  fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                  fontWeight: 700,
                  color: '#0F172A',
                  textDecoration: 'none',
                  fontSize: 15,
                }}
              >
                {isAr ? 'تسجيل الدخول' : 'Sign in'}
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                style={{
                  textAlign: 'center',
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: '#0F766E',
                  fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                  fontWeight: 700,
                  color: '#fff',
                  textDecoration: 'none',
                  fontSize: 15,
                }}
              >
                {isAr ? 'ابدأ مجاناً' : 'Get started'}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
