import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Check, X, ChevronDown, Menu, ArrowUpRight,
  Zap, MessageSquare, BarChart3, Shield, Target, Link2,
  Twitter, Linkedin, Mail, Star
} from 'lucide-react';

/* ─── Scroll animation wrapper ─── */
function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Floating notification card ─── */
function FloatCard({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Marquee logos ─── */
const LOGOS = ['أرامكو', 'STC', 'سابك', 'موبايلي', 'الأهلي', 'الراجحي', 'PIF', 'نيوم', 'stc pay', 'Noon', 'Jarir'];

function LogoMarquee() {
  return (
    <div className="overflow-hidden">
      <motion.div
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        className="flex gap-12 w-max"
      >
        {[...LOGOS, ...LOGOS].map((logo, i) => (
          <span key={i} className="text-lg font-bold whitespace-nowrap" style={{ color: 'rgba(148,163,184,0.5)', fontFamily: "'Cairo', sans-serif" }}>
            {logo}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ─── Accordion item ─── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '18px 0' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-right gap-4"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ color: '#F8FAFC', fontSize: 16, fontWeight: 600, fontFamily: "'Cairo', sans-serif" }}>{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={20} style={{ color: '#94A3B8', flexShrink: 0 }} />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <p style={{ color: '#94A3B8', fontSize: 15, fontFamily: "'Cairo', sans-serif", paddingTop: 12, lineHeight: 1.7 }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FAQS = [
  { q: 'هل وصل آمن لحساب LinkedIn؟', a: 'نعم، نعمل ضمن حدود LinkedIn الرسمية ونطبق تأخيرات بشرية ومعدلات يومية محمية. حسابك محمي بالكامل.' },
  { q: 'هل أحتاج إلى خبرة تقنية؟', a: 'لا، الإعداد يستغرق 5 دقائق فقط. فقط ثبّت الامتداد، اربط حسابك، وأنشئ حملتك الأولى.' },
  { q: 'كيف يعمل تكامل Apollo؟', a: 'تستطيع البحث عن عملاء محتملين بالمسمى الوظيفي والموقع والقطاع مباشرة من داخل وصل واستيرادهم لقائمة العملاء بنقرة واحدة.' },
  { q: 'ماذا يحدث إذا لم أكن راضياً؟', a: 'نضمن استرجاع أموالك خلال 30 يوماً بدون أسئلة. رضاك أولويتنا.' },
  { q: 'هل يعمل مع LinkedIn المدفوع؟', a: 'نعم، يعمل مع جميع إصدارات LinkedIn: المجاني والمدفوع وSales Navigator.' },
  { q: 'كم عدد الحسابات التي أستطيع إدارتها؟', a: 'في الخطة المجانية: حساب واحد. Pro: 3 أعضاء. Enterprise: عدد غير محدود مع white-label.' },
];

const FEATURES = [
  { icon: <Zap size={22} />, color: '#6366F1', bg: 'rgba(99,102,241,0.15)', title: 'تواصل تلقائي', desc: 'أرسل طلبات تواصل مخصصة تلقائياً ضمن الحدود الآمنة لـ LinkedIn' },
  { icon: <MessageSquare size={22} />, color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', title: 'رسائل AI', desc: 'رسائل مخصصة بالذكاء الاصطناعي تناسب كل شخص وقطاع تلقائياً' },
  { icon: <BarChart3 size={22} />, color: '#10B981', bg: 'rgba(16,185,129,0.15)', title: 'تحليلات حية', desc: 'تابع معدلات القبول والردود وأداء كل حملة في الوقت الفعلي' },
  { icon: <Shield size={22} />, color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', title: 'آمن 100%', desc: 'تأخيرات بشرية ومعدلات يومية ومراقبة لضمان سلامة حسابك' },
  { icon: <Target size={22} />, color: '#EF4444', bg: 'rgba(239,68,68,0.15)', title: 'استهداف دقيق', desc: 'استهدف بالمسمى والشركة والموقع والقطاع للوصول لمن يهمك' },
  { icon: <Link2 size={22} />, color: '#06B6D4', bg: 'rgba(6,182,212,0.15)', title: 'تكامل Apollo', desc: 'استورد قوائم العملاء من Apollo.io مباشرة بنقرة واحدة' },
];

const TESTIMONIALS = [
  {
    stars: 5, initial: 'خ', color: '#6366F1',
    quote: 'وصل غيّر طريقة عملي كلياً. وفّرت 15 ساعة أسبوعياً وزدت عملائي 3 أضعاف خلال شهرين فقط.',
    name: 'خالد الشمري', title: 'مدير مبيعات — شركة تقنية'
  },
  {
    stars: 5, initial: 'س', color: '#8B5CF6',
    quote: 'أفضل أداة LinkedIn automation رأيتها. النتائج تتحدث عن نفسها، والدعم ممتاز.',
    name: 'سارة القحطاني', title: 'HR Manager — Big 4'
  },
  {
    stars: 5, initial: 'م', color: '#10B981',
    quote: 'استخدمت 3 أدوات قبل وصل. لن أرجع لغيره أبداً. السعر مناسب والنتائج أفضل.',
    name: 'محمد العمري', title: 'Founder — SaaS Startup'
  },
];

/* ══════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════ */
export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const s: Record<string, React.CSSProperties> = {
    page: { background: '#0F172A', minHeight: '100vh', direction: 'rtl', fontFamily: "'Cairo', sans-serif", color: '#F8FAFC', overflowX: 'hidden' },
    nav: {
      position: 'fixed', top: 0, right: 0, left: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 5vw', height: 64,
      background: scrolled ? 'rgba(15,23,42,0.9)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
      transition: 'all 0.3s ease',
    },
    logoText: { fontSize: 22, fontWeight: 900, background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    navLinks: { display: 'flex', alignItems: 'center', gap: 32 },
    navLink: { color: '#94A3B8', fontSize: 14, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s', cursor: 'pointer' },
    btnGhost: { padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', color: '#F8FAFC', background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Cairo', sans-serif" },
    btnIndigo: { padding: '8px 18px', borderRadius: 8, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: "'Cairo', sans-serif", transition: 'opacity 0.2s' },
    hero: { minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '80px 5vw 60px', position: 'relative', overflow: 'hidden' },
    heroBg: { position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' },
    section: { padding: '80px 5vw' },
    sectionCenter: { padding: '80px 5vw', textAlign: 'center' },
    sectionTitle: { fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: '#F8FAFC', marginBottom: 16, lineHeight: 1.3 },
    sectionSub: { fontSize: 16, color: '#94A3B8', lineHeight: 1.7, maxWidth: 560 },
    card: { background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, transition: 'transform 0.2s, box-shadow 0.2s' },
  };

  return (
    <div style={s.page}>

      {/* ─── NAVBAR ─── */}
      <nav style={s.nav}>
        <Link href="/">
          <span style={s.logoText}>وصل</span>
        </Link>

        {/* Desktop links */}
        <div style={s.navLinks} className="hidden md:flex">
          {[['المميزات', '#features'], ['الأسعار', '#pricing'], ['المدونة', '/blog']].map(([label, href]) => (
            <a key={label} href={href} style={s.navLink}>{label}</a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <button style={s.btnGhost}>تسجيل الدخول</button>
          </Link>
          <Link href="/signup">
            <button style={s.btnIndigo}>ابدأ مجاناً</button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)} style={{ background: 'none', border: 'none', color: '#F8FAFC', cursor: 'pointer' }}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ position: 'fixed', top: 64, right: 0, left: 0, zIndex: 999, background: '#1E293B', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {[['المميزات', '#features'], ['الأسعار', '#pricing'], ['المدونة', '/blog']].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobileOpen(false)} style={{ ...s.navLink, fontSize: 16 }}>{label}</a>
            ))}
            <Link href="/login"><button style={{ ...s.btnGhost, width: '100%' }}>تسجيل الدخول</button></Link>
            <Link href="/signup"><button style={{ ...s.btnIndigo, width: '100%', padding: '12px' }}>ابدأ مجاناً</button></Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── HERO ─── */}
      <section style={s.hero}>
        {/* Animated mesh background */}
        <div style={s.heroBg}>
          <div style={{ position: 'absolute', top: '10%', right: '20%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', animation: 'pulse1 8s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', animation: 'pulse2 10s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '40%', left: '30%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', animation: 'pulse1 12s ease-in-out infinite' }} />
        </div>

        <style>{`
          @keyframes pulse1 { 0%,100%{transform:scale(1) translateY(0)} 50%{transform:scale(1.1) translateY(-20px)} }
          @keyframes pulse2 { 0%,100%{transform:scale(1) translateY(0)} 50%{transform:scale(0.9) translateY(20px)} }
        `}</style>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '5vw', width: '100%', flexWrap: 'wrap' }}>

          {/* LEFT: Text */}
          <div style={{ flex: '1 1 400px', maxWidth: 600 }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', borderRadius: 100,
                border: '1px solid rgba(99,102,241,0.4)',
                background: 'rgba(99,102,241,0.1)',
                boxShadow: '0 0 20px rgba(99,102,241,0.15)',
                marginBottom: 24,
              }}
            >
              <span>🚀</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#A5B4FC' }}>مدعوم بالذكاء الاصطناعي</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 900, lineHeight: 1.2, marginBottom: 20 }}
            >
              <span style={{ color: '#F8FAFC' }}>أتمتة تواصلك على LinkedIn</span>
              <br />
              <span style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>وضاعف عملاءك 10 أضعاف</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              style={{ fontSize: 17, color: '#94A3B8', lineHeight: 1.8, marginBottom: 32 }}
            >
              وصل يرسل طلبات التواصل والرسائل المخصصة تلقائياً. وفّر 20+ ساعة أسبوعياً.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}
            >
              <Link href="/signup">
                <button style={{ ...s.btnIndigo, padding: '14px 28px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 30px rgba(99,102,241,0.4)' }}>
                  ابدأ تجربتك المجانية <ArrowLeft size={18} />
                </button>
              </Link>
              <Link href="/demo">
                <button style={{ ...s.btnGhost, padding: '14px 24px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Play size={16} /> شاهد كيف يعمل
                </button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}
            >
              {['بدون بطاقة ائتمان', '14 يوم مجاناً', 'إلغاء في أي وقت'].map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748B' }}>
                  <Check size={14} style={{ color: '#10B981' }} />
                  <span>{t}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* RIGHT: Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ flex: '0 0 auto', position: 'relative', width: 'min(380px, 90vw)' }}
          >
            {/* Main metrics card */}
            <div style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
                <span style={{ fontSize: 13, color: '#94A3B8' }}>الحملة نشطة — وصل يعمل</span>
              </div>
              {[
                { label: 'دعوات مُرسلة', value: '247', icon: '📈', color: '#6366F1' },
                { label: 'معدل القبول', value: '68%', icon: '✅', color: '#10B981' },
                { label: 'ردود جديدة', value: '23', icon: '💬', color: '#8B5CF6' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 14, color: '#94A3B8' }}>{item.label}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.icon} {item.value}</span>
                </div>
              ))}
            </div>

            {/* Floating notification cards */}
            <FloatCard delay={0} className="absolute" style={{ top: -20, left: -20 } as any}>
              <div style={{ background: '#1E293B', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', fontSize: 13, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                ✅ تم قبول الدعوة · أحمد السعيد
              </div>
            </FloatCard>

            <FloatCard delay={1.5} className="absolute" style={{ bottom: 60, left: -30 } as any}>
              <div style={{ background: '#1E293B', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', fontSize: 13, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                💬 رد جديد · سارة المحمد
              </div>
            </FloatCard>

            <FloatCard delay={0.8} className="absolute" style={{ bottom: -10, right: -10 } as any}>
              <div style={{ background: '#1E293B', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', fontSize: 13, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                🎯 تم إرسال 50 دعوة
              </div>
            </FloatCard>
          </motion.div>
        </div>
      </section>

      {/* ─── LOGOS STRIP ─── */}
      <section style={{ padding: '40px 5vw', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <FadeUp>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#475569', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.1em' }}>يثق بنا محترفون من</p>
          <LogoMarquee />
        </FadeUp>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" style={s.section}>
        <FadeUp>
          <h2 style={{ ...s.sectionTitle, textAlign: 'center' }}>كل ما تحتاجه لتوسيع شبكتك المهنية</h2>
          <p style={{ ...s.sectionSub, textAlign: 'center', margin: '0 auto 48px' }}>أدوات مدعومة بالذكاء الاصطناعي تعمل بدلاً عنك</p>
        </FadeUp>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {FEATURES.map((f, i) => (
            <FadeUp key={f.title} delay={i * 0.08}>
              <div
                style={s.card}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px ${f.color}22`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.color, marginBottom: 16 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#F8FAFC', marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section style={{ ...s.sectionCenter, background: 'rgba(30,41,59,0.5)' }}>
        <FadeUp>
          <h2 style={s.sectionTitle}>3 خطوات للنجاح</h2>
          <p style={{ ...s.sectionSub, margin: '0 auto 56px' }}>ابدأ خلال دقائق وشاهد النتائج</p>
        </FadeUp>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
          {[
            { num: '01', icon: '🔗', title: 'اربط LinkedIn', desc: 'اتصال آمن عبر OAuth الرسمي بنقرة واحدة' },
            { num: '02', icon: '🎯', title: 'حدد جمهورك', desc: 'اختر من Apollo أو LinkedIn مباشرة بالفلاتر الدقيقة' },
            { num: '03', icon: '🚀', title: 'شغّل الأتمتة', desc: 'AI يعمل 24/7 بدلاً عنك ويرسل رسائل مخصصة' },
          ].map((step, i) => (
            <FadeUp key={step.num} delay={i * 0.15}>
              <div style={{ flex: '1 1 220px', maxWidth: 280, textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '2px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px' }}>
                  {step.icon}
                </div>
                <div style={{ fontSize: 12, color: '#6366F1', fontWeight: 700, marginBottom: 8, letterSpacing: '0.1em' }}>{step.num}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC', marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section style={s.section}>
        <FadeUp>
          <h2 style={{ ...s.sectionTitle, textAlign: 'center', marginBottom: 48 }}>ماذا يقول مستخدمونا</h2>
        </FadeUp>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {TESTIMONIALS.map((t, i) => (
            <FadeUp key={t.name} delay={i * 0.1}>
              <div style={{ ...s.card, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} size={16} fill="#F59E0B" style={{ color: '#F59E0B' }} />
                  ))}
                </div>
                <p style={{ fontSize: 15, color: '#CBD5E1', lineHeight: 1.8, flex: 1 }}>"{t.quote}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {t.initial}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC' }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{t.title}</div>
                  </div>
                  <Linkedin size={16} style={{ color: '#0A66C2', marginRight: 'auto' }} />
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" style={{ ...s.sectionCenter, background: 'rgba(30,41,59,0.3)' }}>
        <FadeUp>
          <h2 style={s.sectionTitle}>أسعار شفافة وبسيطة</h2>
          <p style={{ ...s.sectionSub, margin: '0 auto 32px' }}>بدون رسوم إعداد. إلغاء في أي وقت.</p>
          {/* Billing toggle */}
          <div style={{ display: 'inline-flex', background: '#1E293B', borderRadius: 12, padding: 4, marginBottom: 48, border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['monthly', 'annual'] as const).map(b => (
              <button key={b} onClick={() => setBilling(b)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Cairo', sans-serif", fontSize: 14, fontWeight: 600, transition: 'all 0.2s', background: billing === b ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'transparent', color: billing === b ? '#fff' : '#94A3B8' }}>
                {b === 'monthly' ? 'شهري' : 'سنوي — خصم 20%'}
              </button>
            ))}
          </div>
        </FadeUp>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, maxWidth: 900, margin: '0 auto' }}>
          {/* Starter */}
          <FadeUp delay={0}>
            <div style={{ ...s.card, textAlign: 'right' }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#F8FAFC', marginBottom: 4 }}>Starter</h3>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>للمبتدئين</p>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#F8FAFC', marginBottom: 24 }}>0 <span style={{ fontSize: 16, color: '#64748B' }}>ريال/شهر</span></div>
              {[['50 دعوة/شهر', true], ['رسائل يدوية', true], ['لوحة تحكم أساسية', true], ['AI للرسائل', false], ['Apollo Integration', false]].map(([f, ok]) => (
                <div key={f as string} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  {ok ? <Check size={16} style={{ color: '#10B981', flexShrink: 0 }} /> : <X size={16} style={{ color: '#475569', flexShrink: 0 }} />}
                  <span style={{ fontSize: 14, color: ok ? '#CBD5E1' : '#475569' }}>{f as string}</span>
                </div>
              ))}
              <Link href="/signup">
                <button style={{ ...s.btnGhost, width: '100%', marginTop: 24, padding: '12px' }}>ابدأ مجاناً</button>
              </Link>
            </div>
          </FadeUp>

          {/* Pro */}
          <FadeUp delay={0.1}>
            <div style={{ ...s.card, textAlign: 'right', border: '1px solid rgba(99,102,241,0.5)', boxShadow: '0 0 40px rgba(99,102,241,0.15)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 16, left: 16, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', borderRadius: 100, padding: '4px 12px', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                الأكثر شيوعاً 🔥
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#F8FAFC', marginBottom: 4 }}>Pro</h3>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>للمحترفين</p>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#F8FAFC', marginBottom: 4 }}>
                {billing === 'annual' ? '159' : '199'} <span style={{ fontSize: 16, color: '#64748B' }}>ريال/شهر</span>
              </div>
              {billing === 'annual' && <p style={{ fontSize: 12, color: '#10B981', marginBottom: 20 }}>توفر 480 ريال سنوياً</p>}
              {[['500 دعوة/شهر', true], ['AI للرسائل', true], ['Apollo Integration', true], ['تحليلات متقدمة', true], ['3 أعضاء فريق', true], ['دعم أولوي', true]].map(([f, ok]) => (
                <div key={f as string} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Check size={16} style={{ color: '#10B981', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: '#CBD5E1' }}>{f as string}</span>
                </div>
              ))}
              <Link href="/signup">
                <button style={{ ...s.btnIndigo, width: '100%', marginTop: 24, padding: '12px', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}>ابدأ الآن</button>
              </Link>
              <p style={{ fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 10 }}>ضمان استرجاع 30 يوم</p>
            </div>
          </FadeUp>

          {/* Enterprise */}
          <FadeUp delay={0.2}>
            <div style={{ ...s.card, textAlign: 'right' }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#F8FAFC', marginBottom: 4 }}>Enterprise</h3>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>للشركات الكبرى</p>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#F8FAFC', marginBottom: 24 }}>
                {billing === 'annual' ? '399' : '499'} <span style={{ fontSize: 16, color: '#64748B' }}>ريال/شهر</span>
              </div>
              {[['دعوات غير محدودة', true], ['White-label', true], ['API Access', true], ['فريق غير محدود', true], ['مدير حساب مخصص', true]].map(([f, ok]) => (
                <div key={f as string} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Check size={16} style={{ color: '#10B981', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: '#CBD5E1' }}>{f as string}</span>
                </div>
              ))}
              <Link href="/contact">
                <button style={{ ...s.btnGhost, width: '100%', marginTop: 24, padding: '12px' }}>تواصل معنا</button>
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section style={s.section}>
        <FadeUp>
          <h2 style={{ ...s.sectionTitle, textAlign: 'center', marginBottom: 48 }}>الأسئلة الشائعة</h2>
        </FadeUp>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {FAQS.map(f => <FadeUp key={f.q}><FAQItem q={f.q} a={f.a} /></FadeUp>)}
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section style={{ padding: '100px 5vw', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.15) 0%, transparent 70%)' }} />
        <FadeUp>
          <h2 style={{ ...s.sectionTitle, fontSize: 'clamp(28px, 5vw, 48px)' }}>جاهز لتضاعف شبكتك المهنية؟</h2>
          <p style={{ ...s.sectionSub, margin: '0 auto 40px' }}>انضم لآلاف المحترفين الذين يستخدمون وصل</p>
          <Link href="/signup">
            <button style={{ ...s.btnIndigo, padding: '18px 48px', fontSize: 17, boxShadow: '0 8px 40px rgba(99,102,241,0.5)', borderRadius: 12 }}>
              ابدأ تجربتك المجانية — 14 يوم <ArrowLeft size={20} style={{ display: 'inline' }} />
            </button>
          </Link>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 16 }}>بدون بطاقة ائتمان • إلغاء في أي وقت</p>
        </FadeUp>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '60px 5vw 30px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 40, marginBottom: 48 }}>
          <div>
            <span style={{ ...s.logoText, fontSize: 24, display: 'block', marginBottom: 12 }}>وصل</span>
            <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7, marginBottom: 20 }}>أتمتة تواصلك على LinkedIn وضاعف عملاءك.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              {[Twitter, Linkedin, Mail].map((Icon, i) => (
                <div key={i} style={{ width: 36, height: 36, borderRadius: 8, background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon size={16} style={{ color: '#64748B' }} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', marginBottom: 16 }}>المنتج</h4>
            {['المميزات', 'الأسعار', 'التكاملات', 'التحديثات'].map(link => (
              <div key={link} style={{ marginBottom: 10 }}><a href="#" style={{ fontSize: 14, color: '#64748B', textDecoration: 'none' }}>{link}</a></div>
            ))}
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', marginBottom: 16 }}>الشركة</h4>
            {['من نحن', 'المدونة', 'وظائف', 'اتصل بنا'].map(link => (
              <div key={link} style={{ marginBottom: 10 }}><a href="#" style={{ fontSize: 14, color: '#64748B', textDecoration: 'none' }}>{link}</a></div>
            ))}
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', marginBottom: 16 }}>القانونية</h4>
            {[['الخصوصية', '/privacy'], ['الشروط', '/terms'], ['الأمان', '/safety']].map(([label, href]) => (
              <div key={label} style={{ marginBottom: 10 }}><Link href={href}><a style={{ fontSize: 14, color: '#64748B', textDecoration: 'none' }}>{label}</a></Link></div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, textAlign: 'center', fontSize: 13, color: '#334155' }}>
          © 2026 وصل. صُنع بـ ❤️ في السعودية 🇸🇦
        </div>
      </footer>
    </div>
  );
}
