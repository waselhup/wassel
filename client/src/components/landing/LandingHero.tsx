import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Play, TrendingUp, Sparkles } from 'lucide-react';
import { useState } from 'react';

const ease = [0.16, 1, 0.3, 1] as const;

export default function LandingHero({ onWatchDemo }: { onWatchDemo?: () => void }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: px * 6, y: py * -6 });
  }

  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        paddingTop: 48,
        paddingBottom: 80,
      }}
    >
      {/* Dot-grid background */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(15,23,42,0.12) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          opacity: 0.4,
          maskImage: 'radial-gradient(ellipse at 50% 30%, #000 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%, #000 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      {/* Soft teal radial from top */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -200,
          insetInlineEnd: '-20%',
          width: 700,
          height: 700,
          background: 'radial-gradient(circle, rgba(15,118,110,0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: -260,
          insetInlineStart: '-15%',
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(212,162,46,0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          maxWidth: 1200,
          margin: '0 auto',
          padding: '48px 24px 0',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 60,
          alignItems: 'center',
        }}
        className="lg:grid-cols-2"
      >
        {/* Left content */}
        <div>
          {/* Pill badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              border: '1px solid rgba(15,118,110,0.15)',
              background: 'rgba(15,118,110,0.06)',
              color: '#0F766E',
              fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: isAr ? 0 : 0.3,
              marginBottom: 28,
            }}
          >
            <Sparkles size={12} />
            {isAr ? '🇸🇦 صُنع في السعودية بذكاء اصطناعي' : '🇸🇦 Saudi-built, AI-powered'}
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.05 }}
            style={{
              fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
              fontSize: 'clamp(40px, 6vw, 72px)',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              color: '#0B1220',
              margin: 0,
            }}
          >
            {isAr ? (
              <>
                مسارك المهني
                <br />
                <span
                  style={{
                    backgroundImage: 'linear-gradient(92deg, #0F766E 0%, #14B8A6 45%, #D4A22E 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  يستحق ذكاءً حقيقياً
                </span>
              </>
            ) : (
              <>
                Your career deserves
                <br />
                <span
                  style={{
                    backgroundImage: 'linear-gradient(92deg, #0F766E 0%, #14B8A6 45%, #D4A22E 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  real intelligence
                </span>
              </>
            )}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.15 }}
            style={{
              fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
              fontSize: 'clamp(16px, 1.4vw, 20px)',
              lineHeight: 1.6,
              color: '#475569',
              maxWidth: 540,
              marginTop: 24,
              marginBottom: 36,
            }}
          >
            {isAr
              ? 'حلّل بروفايلك، طوّر سيرتك الذاتية، انشر محتوى احترافي، وتواصل مع الفرص المناسبة — كل هذا في منصة واحدة مصممة بعناية.'
              : 'Analyze your profile, craft your résumé, publish thoughtful posts, and reach the right opportunities — all in one carefully designed platform.'}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.25 }}
            style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}
          >
            <Link
              href="/signup"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 56,
                padding: '0 24px',
                borderRadius: 12,
                background: '#0F766E',
                color: '#fff',
                fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(15,118,110,0.35), inset 0 1px 0 rgba(255,255,255,0.15), 0 12px 28px -10px rgba(15,118,110,0.45)',
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#115E59';
                const ic = e.currentTarget.querySelector('[data-arrow]') as HTMLElement | null;
                if (ic) ic.style.transform = isAr ? 'translateX(-3px)' : 'translateX(3px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#0F766E';
                const ic = e.currentTarget.querySelector('[data-arrow]') as HTMLElement | null;
                if (ic) ic.style.transform = 'translateX(0)';
              }}
            >
              {isAr ? 'ابدأ الآن مجاناً' : 'Start free'}
              <span data-arrow style={{ display: 'inline-flex', transition: 'transform 180ms ease' }}>
                <ArrowRight size={16} style={{ transform: isAr ? 'rotate(180deg)' : undefined }} />
              </span>
            </Link>

            <button
              onClick={onWatchDemo}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 56,
                padding: '0 22px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.8)',
                color: '#0B1220',
                border: '1px solid rgba(15,23,42,0.12)',
                fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                transition: 'border-color 150ms, transform 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(15,118,110,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)';
              }}
            >
              <Play size={14} style={{ fill: '#0F766E', color: '#0F766E' }} />
              {isAr ? 'شاهد العرض' : 'Watch demo'}
            </button>
          </motion.div>

          {/* Trust row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease, delay: 0.4 }}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
              fontSize: 13,
              color: '#64748B',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#0F766E', fontWeight: 800 }}>✓</span>
              {isAr ? '1,000 توكن مجاناً' : '1,000 free tokens'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#0F766E', fontWeight: 800 }}>✓</span>
              {isAr ? 'بدون بطاقة ائتمانية' : 'No credit card'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#0F766E', fontWeight: 800 }}>✓</span>
              {isAr ? 'العربية أصلياً' : 'Arabic-native'}
            </span>
          </motion.div>
        </div>

        {/* Right visual: product mockup with tilt */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.2 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTilt({ x: 0, y: 0 })}
          style={{
            position: 'relative',
            perspective: 1200,
          }}
        >
          <motion.div
            animate={{ rotateY: tilt.x, rotateX: tilt.y }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            style={{ position: 'relative', transformStyle: 'preserve-3d' }}
          >
            {/* Back card (floating stat) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: [0, -8, 0] }}
              transition={{ opacity: { duration: 0.6, delay: 0.6 }, y: { duration: 5, repeat: Infinity, ease: 'easeInOut' } }}
              style={{
                position: 'absolute',
                top: -28,
                insetInlineStart: -28,
                zIndex: 1,
                background: '#fff',
                border: '1px solid rgba(15,23,42,0.08)',
                borderRadius: 16,
                padding: '14px 18px',
                boxShadow: '0 12px 30px -10px rgba(15,23,42,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #0F766E, #14B8A6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }}
              >
                <TrendingUp size={16} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
                  {isAr ? 'تقييم البروفايل' : 'Profile score'}
                </div>
                <div style={{ fontSize: 18, color: '#0B1220', fontWeight: 900, letterSpacing: '-0.02em' }}>
                  87<span style={{ fontSize: 12, color: '#94A3B8' }}>/100</span>
                </div>
              </div>
            </motion.div>

            {/* Main browser card */}
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                background: '#fff',
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid rgba(15,23,42,0.08)',
                boxShadow: '0 28px 60px -20px rgba(15,23,42,0.25)',
              }}
            >
              {/* Browser chrome */}
              <div
                style={{
                  background: '#F1F5F9',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderBottom: '1px solid rgba(15,23,42,0.06)',
                }}
              >
                <div style={{ display: 'flex', gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF5F57' }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#FEBC2E' }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28C840' }} />
                </div>
                <div
                  style={{
                    flex: 1,
                    background: '#fff',
                    color: '#64748B',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 10.5,
                    textAlign: 'center',
                    direction: 'ltr',
                    border: '1px solid rgba(15,23,42,0.06)',
                  }}
                >
                  wassel.sa/app
                </div>
              </div>

              {/* Dashboard mockup body */}
              <div style={{ padding: 22, minHeight: 360, background: 'linear-gradient(180deg, #FAFBFC 0%, #fff 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748B', fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif', fontWeight: 600 }}>
                      {isAr ? 'مرحباً، محمد' : 'Welcome, Mohammed'}
                    </div>
                    <div style={{ fontSize: 18, color: '#0B1220', fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em' }}>
                      {isAr ? 'لوحتك اليوم' : 'Your dashboard today'}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      background: 'rgba(15,118,110,0.08)',
                      color: '#0F766E',
                      fontSize: 11,
                      fontWeight: 800,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    1,000
                  </div>
                </div>

                {/* Fake cards row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                  {[
                    { label: isAr ? 'التحليلات' : 'Analyses', value: 12 },
                    { label: isAr ? 'السير' : 'CVs', value: 5 },
                    { label: isAr ? 'المنشورات' : 'Posts', value: 24 },
                  ].map((x, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif', fontWeight: 600 }}>{x.label}</div>
                      <div style={{ fontSize: 18, color: '#0B1220', fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em' }}>{x.value}</div>
                    </div>
                  ))}
                </div>

                {/* Score meter */}
                <div style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: '#475569', fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif', fontWeight: 700 }}>
                      {isAr ? 'تحليل بروفايل LinkedIn' : 'LinkedIn profile analysis'}
                    </div>
                    <div style={{ fontSize: 11, color: '#0F766E', fontFamily: 'Inter, sans-serif', fontWeight: 800 }}>+12 {isAr ? 'هذا الأسبوع' : 'this week'}</div>
                  </div>
                  {[
                    { label: isAr ? 'العنوان الوظيفي' : 'Headline', pct: 92 },
                    { label: isAr ? 'النبذة' : 'Summary', pct: 85 },
                    { label: isAr ? 'الخبرات' : 'Experience', pct: 78 },
                  ].map((row, i) => (
                    <div key={i} style={{ marginBottom: i < 2 ? 10 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#64748B', marginBottom: 4, fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif', fontWeight: 600 }}>
                        <span>{row.label}</span>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>{row.pct}%</span>
                      </div>
                      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${row.pct}%` }}
                          transition={{ duration: 1.1, delay: 0.8 + i * 0.1, ease }}
                          style={{ height: '100%', background: 'linear-gradient(90deg, #0F766E, #14B8A6)', borderRadius: 999 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating lower card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: [0, 6, 0] }}
              transition={{ opacity: { duration: 0.6, delay: 0.8 }, y: { duration: 5, delay: 1, repeat: Infinity, ease: 'easeInOut' } }}
              style={{
                position: 'absolute',
                bottom: -22,
                insetInlineEnd: -22,
                zIndex: 3,
                background: '#0B1220',
                color: '#fff',
                borderRadius: 14,
                padding: '12px 16px',
                boxShadow: '0 12px 30px -8px rgba(15,23,42,0.4)',
                fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                minWidth: 180,
              }}
            >
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>
                {isAr ? 'أُطلقت للتو' : 'Just launched'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>
                {isAr ? 'حملة Q1' : 'Q1 campaign'}
              </div>
              <div style={{ fontSize: 11, color: '#14B8A6', fontFamily: 'Inter, sans-serif', fontWeight: 700, marginTop: 4 }}>
                ● 18 {isAr ? 'رسالة جاهزة' : 'messages ready'}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
