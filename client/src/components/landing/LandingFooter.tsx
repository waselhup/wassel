import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Linkedin, Twitter, Globe, ArrowRight } from 'lucide-react';
import { WasselLogo } from '../WasselLogo';

const ease = [0.16, 1, 0.3, 1] as const;

export default function LandingFooter() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const toggleLang = () => {
    const next = isAr ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  const columns: Array<{ title: { ar: string; en: string }; links: Array<{ href: string; ar: string; en: string; external?: boolean }> }> = [
    {
      title: { ar: 'المنتج', en: 'Product' },
      links: [
        { href: '#features', ar: 'المميزات', en: 'Features' },
        { href: '#demo', ar: 'العرض التوضيحي', en: 'Demo' },
        { href: '#pricing', ar: 'الأسعار', en: 'Pricing' },
        { href: '/signup', ar: 'ابدأ مجاناً', en: 'Start free' },
      ],
    },
    {
      title: { ar: 'الشركة', en: 'Company' },
      links: [
        { href: '/about', ar: 'من نحن', en: 'About' },
        { href: '/blog', ar: 'المدونة', en: 'Blog' },
        { href: 'mailto:waselhup@gmail.com', ar: 'اتصل بنا', en: 'Contact', external: true },
      ],
    },
    {
      title: { ar: 'الموارد', en: 'Resources' },
      links: [
        { href: '/login', ar: 'تسجيل الدخول', en: 'Sign in' },
        { href: '/signup', ar: 'إنشاء حساب', en: 'Sign up' },
      ],
    },
    {
      title: { ar: 'قانوني', en: 'Legal' },
      links: [
        { href: '/privacy', ar: 'سياسة الخصوصية', en: 'Privacy' },
        { href: '/terms', ar: 'شروط الاستخدام', en: 'Terms' },
        { href: '/privacy#pdpl', ar: 'الامتثال لنظام PDPL', en: 'PDPL compliance' },
      ],
    },
  ];

  return (
    <>
      {/* Final CTA */}
      <section style={{ padding: '100px 24px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, ease }}
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 28,
              padding: 'clamp(48px, 8vw, 96px) 32px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #0F766E 0%, #115E59 50%, #042F2E 100%)',
              boxShadow: '0 30px 80px -30px rgba(15,118,110,0.4)',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
                opacity: 0.5,
                pointerEvents: 'none',
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -200,
                insetInlineEnd: -200,
                width: 500,
                height: 500,
                background: 'radial-gradient(circle, rgba(212,162,46,0.2) 0%, transparent 60%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative' }}>
              <h2
                style={{
                  fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                  fontSize: 'clamp(30px, 4.5vw, 48px)',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  color: '#fff',
                  lineHeight: 1.15,
                  margin: 0,
                  maxWidth: 760,
                  marginInline: 'auto',
                }}
              >
                {isAr
                  ? 'انضم إلى آلاف المحترفين السعوديين'
                  : 'Join thousands of Saudi professionals'}
              </h2>
              <p
                style={{
                  fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                  fontSize: 17,
                  color: 'rgba(255,255,255,0.7)',
                  marginTop: 16,
                  marginBottom: 32,
                  lineHeight: 1.6,
                  maxWidth: 580,
                  marginInline: 'auto',
                }}
              >
                {isAr
                  ? 'حسابك الأول مجاني. 100 توكن هدية عند التسجيل. بدون بطاقة ائتمانية.'
                  : 'Your first account is free. 100 tokens gift on signup. No credit card needed.'}
              </p>
              <Link
                href="/signup"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '15px 26px',
                  borderRadius: 12,
                  background: '#fff',
                  color: '#0F766E',
                  fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                  fontWeight: 800,
                  fontSize: 15,
                  textDecoration: 'none',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                  transition: 'transform 150ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {isAr ? 'ابدأ مجاناً' : 'Start free'}
                <ArrowRight size={15} style={{ transform: isAr ? 'rotate(180deg)' : undefined }} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '80px 24px 40px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div
            className="landing-footer-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr repeat(4, 1fr)',
              gap: 40,
              marginBottom: 48,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <WasselLogo size={32} />
                <span
                  style={{
                    fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                    fontWeight: 800,
                    fontSize: 18,
                    color: '#0F766E',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {isAr ? 'وصّل' : 'Wassel'}
                </span>
              </div>
              <p
                style={{
                  fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                  fontSize: 13,
                  color: '#64748B',
                  lineHeight: 1.6,
                  maxWidth: 280,
                  margin: 0,
                }}
              >
                {isAr
                  ? 'منصة سعودية مدعومة بالذكاء الاصطناعي لنمو مسارك المهني.'
                  : 'Saudi AI-powered platform for your career growth.'}
              </p>
              <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                <a
                  href="https://www.linkedin.com/company/wassel"
                  aria-label="LinkedIn"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#F1F5F9',
                    color: '#475569',
                    transition: 'background 180ms, color 180ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#0F766E';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#F1F5F9';
                    e.currentTarget.style.color = '#475569';
                  }}
                >
                  <Linkedin size={16} />
                </a>
                <a
                  href="https://twitter.com/waselhup"
                  aria-label="X / Twitter"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#F1F5F9',
                    color: '#475569',
                    transition: 'background 180ms, color 180ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#0F766E';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#F1F5F9';
                    e.currentTarget.style.color = '#475569';
                  }}
                >
                  <Twitter size={16} />
                </a>
                <button
                  onClick={toggleLang}
                  aria-label="Toggle language"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0 12px',
                    height: 36,
                    borderRadius: 10,
                    border: 'none',
                    background: '#F1F5F9',
                    color: '#475569',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: 0.3,
                  }}
                >
                  <Globe size={13} />
                  {isAr ? 'EN' : 'AR'}
                </button>
              </div>
            </div>

            {columns.map((col) => (
              <div key={col.title.en}>
                <div
                  style={{
                    fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#0B1220',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 16,
                  }}
                >
                  {isAr ? col.title.ar : col.title.en}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.links.map((l) => (
                    <li key={l.href + l.en}>
                      {l.external ? (
                        <a
                          href={l.href}
                          style={{
                            fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                            fontSize: 13.5,
                            color: '#475569',
                            textDecoration: 'none',
                            transition: 'color 150ms',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#0F766E')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
                        >
                          {isAr ? l.ar : l.en}
                        </a>
                      ) : (
                        <Link
                          href={l.href}
                          style={{
                            fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                            fontSize: 13.5,
                            color: '#475569',
                            textDecoration: 'none',
                            transition: 'color 150ms',
                          }}
                          onMouseEnter={(e: any) => (e.currentTarget.style.color = '#0F766E')}
                          onMouseLeave={(e: any) => (e.currentTarget.style.color = '#475569')}
                        >
                          {isAr ? l.ar : l.en}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            style={{
              paddingTop: 28,
              borderTop: '1px solid rgba(15,23,42,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
              fontSize: 12,
              color: '#94A3B8',
            }}
          >
            <div>© 2026 Wassel · {isAr ? 'كل الحقوق محفوظة' : 'All rights reserved'}</div>
            <div>{isAr ? 'متوافق مع نظام حماية البيانات الشخصية (PDPL)' : 'PDPL compliant · Made in Saudi Arabia'}</div>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 1024px) {
          .landing-footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .landing-footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
