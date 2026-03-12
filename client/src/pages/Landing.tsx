import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'wouter';

/* ============================================================
   i18n — bilingual strings (en / ar)
   ============================================================ */
const t = {
  en: {
    nav: { features: 'Features', pricing: 'Pricing', faq: 'FAQ', login: 'Login', trial: 'Start Free Trial' },
    hero: {
      h1: 'Automate Your LinkedIn Outreach.\nClose More Deals.',
      sub: 'Wassel runs your entire LinkedIn sequence — visit, connect, message, follow up — while you focus on closing.',
      cta1: 'Start Free Trial', cta2: 'Watch Demo',
      proof: 'Join 500+ sales teams, recruiters & founders',
      badge: '12 connections accepted today',
    },
    logos: 'Trusted by teams at:',
    features: {
      title: 'Everything you need to scale outreach',
      items: [
        { icon: '🎯', name: 'Smart Sequences', desc: 'Build multi-step campaigns: visit, invite, message, follow up — fully automated.' },
        { icon: '👥', name: 'Prospect Import', desc: 'Import leads directly from LinkedIn search in one click via our Chrome extension.' },
        { icon: '📊', name: 'Real-Time Analytics', desc: 'Track acceptance rates, reply rates, and funnel drop-off across every campaign.' },
        { icon: '🛡️', name: 'Safe Automation', desc: 'Built-in rate limits and human-like delays keep your LinkedIn account protected.' },
        { icon: '🔔', name: 'Connection Sync', desc: 'Auto-detects when invites are accepted and unlocks the next message instantly.' },
        { icon: '👨‍💼', name: 'Team Management', desc: 'Invite your team, manage seats, and monitor all campaigns from one admin view.' },
      ],
    },
    how: {
      title: 'Up and running in 3 steps',
      steps: [
        { num: '01', name: 'Install the Extension', desc: 'Add Wassel to Chrome. Connect your LinkedIn account in one click.' },
        { num: '02', name: 'Build Your Sequence', desc: 'Set up your visit → invite → message flow. Customize templates with personalization.' },
        { num: '03', name: 'Launch & Watch', desc: 'Start your campaign. Wassel runs automatically while you track results live.' },
      ],
    },
    pricing: {
      title: 'Simple, transparent pricing',
      sub: 'No setup fees. Cancel anytime.',
      note: 'All plans include 7-day free trial. No credit card required.',
      contact: 'Contact Us',
    },
    testimonials: { title: 'What our users say' },
    faqTitle: 'Frequently asked questions',
    cta: { h: 'Ready to scale your LinkedIn outreach?', sub: 'Start your free 7-day trial today.', btn: 'Start Free Trial →' },
    footer: { tagline: 'Automate your LinkedIn outreach.', copy: '© 2025 Wassel. All rights reserved.' },
  },
  ar: {
    nav: { features: 'المميزات', pricing: 'الأسعار', faq: 'الأسئلة', login: 'تسجيل الدخول', trial: 'ابدأ مجاناً' },
    hero: {
      h1: 'أتمتة تواصلك على لينكدإن.\nأغلق صفقات أكثر.',
      sub: 'وصل يدير تسلسل لينكدإن بالكامل — زيارة، اتصال، رسالة، متابعة — بينما تركز أنت على الإغلاق.',
      cta1: 'ابدأ مجاناً', cta2: 'شاهد العرض',
      proof: 'انضم لأكثر من 500 فريق مبيعات وتوظيف',
      badge: '12 اتصال تم قبوله اليوم',
    },
    logos: 'موثوق من فرق في:',
    features: {
      title: 'كل ما تحتاجه لتوسيع تواصلك',
      items: [
        { icon: '🎯', name: 'تسلسلات ذكية', desc: 'أنشئ حملات متعددة الخطوات: زيارة، دعوة، رسالة، متابعة — مؤتمتة بالكامل.' },
        { icon: '👥', name: 'استيراد العملاء', desc: 'استورد العملاء المحتملين من بحث لينكدإن بنقرة واحدة عبر إضافة كروم.' },
        { icon: '📊', name: 'تحليلات فورية', desc: 'تتبع معدلات القبول والرد وانخفاض القمع عبر كل حملة.' },
        { icon: '🛡️', name: 'أتمتة آمنة', desc: 'حدود مدمجة وتأخيرات بشرية تحافظ على حسابك محمياً.' },
        { icon: '🔔', name: 'مزامنة الاتصال', desc: 'يكتشف تلقائياً قبول الدعوات ويفتح الرسالة التالية فوراً.' },
        { icon: '👨‍💼', name: 'إدارة الفريق', desc: 'ادعُ فريقك، أدِر المقاعد، وراقب جميع الحملات من لوحة واحدة.' },
      ],
    },
    how: {
      title: 'جاهز في 3 خطوات',
      steps: [
        { num: '01', name: 'ثبّت الإضافة', desc: 'أضف وصل إلى كروم. اربط حساب لينكدإن بنقرة واحدة.' },
        { num: '02', name: 'ابنِ تسلسلك', desc: 'أعد تدفق الزيارة → الدعوة → الرسالة. خصّص القوالب.' },
        { num: '03', name: 'أطلق وراقب', desc: 'ابدأ حملتك. وصل يعمل تلقائياً بينما تتابع النتائج.' },
      ],
    },
    pricing: {
      title: 'أسعار بسيطة وشفافة',
      sub: 'بدون رسوم إعداد. إلغاء في أي وقت.',
      note: 'جميع الخطط تشمل 7 أيام تجربة مجانية. بدون بطاقة ائتمان.',
      contact: 'تواصل معنا',
    },
    testimonials: { title: 'ماذا يقول مستخدمونا' },
    faqTitle: 'الأسئلة الشائعة',
    cta: { h: 'مستعد لتوسيع تواصلك على لينكدإن؟', sub: 'ابدأ تجربتك المجانية لمدة 7 أيام اليوم.', btn: 'ابدأ مجاناً ←' },
    footer: { tagline: 'أتمتة تواصلك على لينكدإن.', copy: '© 2025 وصل. جميع الحقوق محفوظة.' },
  },
};

const pricingPlans = [
  {
    name: 'Starter', price: '$29', period: '/month', popular: false,
    features: ['1 LinkedIn account', '500 prospects/month', '3 active campaigns', 'Basic analytics', 'Email support'],
  },
  {
    name: 'Growth', price: '$79', period: '/month', popular: true,
    features: ['3 LinkedIn accounts', '2,000 prospects/month', 'Unlimited campaigns', 'Full analytics + reply tracking', 'Priority support', 'Team seats: up to 3'],
  },
  {
    name: 'Agency', price: '$199', period: '/month', popular: false,
    features: ['10 LinkedIn accounts', 'Unlimited prospects', 'Unlimited campaigns', 'Advanced analytics', 'Dedicated support', 'Unlimited team seats', 'White-label ready'],
  },
];

const testimonials = [
  { text: 'Wassel replaced 3 hours of manual LinkedIn work every day. My acceptance rate jumped to 47%.', name: 'Sarah K.', role: 'Sales Director', color: '#7c3aed' },
  { text: 'Best LinkedIn automation tool I\'ve used. Simple, safe, and it actually works.', name: 'Mohammed A.', role: 'Founder', color: '#ec4899' },
  { text: 'We onboarded our entire sales team in a day. The sequence builder is incredibly intuitive.', name: 'Lisa T.', role: 'Head of Recruiting', color: '#22c55e' },
];

const faqs = [
  { q: 'Is Wassel safe for my LinkedIn account?', a: 'Yes. Wassel uses human-like delays and respects LinkedIn\'s daily limits (max 80 invites/day). Your account stays protected.' },
  { q: 'Do I need to keep my browser open?', a: 'The Chrome extension needs to be active for automation to run. Many users keep it running in the background during work hours.' },
  { q: 'Can I cancel anytime?', a: 'Absolutely. No contracts, no cancellation fees. Cancel from your dashboard in one click.' },
  { q: 'What\'s included in the free trial?', a: 'Full access to all Growth plan features for 7 days. No credit card required to start.' },
  { q: 'Does Wassel work for recruiting too?', a: 'Yes. Recruiters use Wassel to automate candidate outreach, follow-ups, and pipeline management on LinkedIn.' },
];

const logos = ['Notion', 'Stripe', 'Linear', 'Vercel', 'Supabase', 'Figma'];

/* ============================================================
   Scroll animation hook
   ============================================================ */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, style: { opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(30px)', transition: 'opacity 0.7s ease, transform 0.7s ease' } as React.CSSProperties };
}

/* ============================================================
   LANDING PAGE
   ============================================================ */
export default function Landing() {
  const [lang, setLang] = useState<'en' | 'ar'>(() => (localStorage.getItem('wassel_lang') as 'en' | 'ar') || 'en');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const s = t[lang];
  const isRtl = lang === 'ar';

  const toggleLang = useCallback(() => {
    const next = lang === 'en' ? 'ar' : 'en';
    setLang(next);
    localStorage.setItem('wassel_lang', next);
  }, [lang]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenu(false);
  };

  // Section reveal hooks
  const hero$ = useScrollReveal();
  const logos$ = useScrollReveal();
  const feat$ = useScrollReveal();
  const how$ = useScrollReveal();
  const price$ = useScrollReveal();
  const test$ = useScrollReveal();
  const faq$ = useScrollReveal();
  const ctaBan$ = useScrollReveal();

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>

      {/* ======================================================
          SECTION 1: NAVBAR
          ====================================================== */}
      <nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{ background: 'rgba(10, 10, 18, 0.8)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--gradient-primary)' }}>W</div>
              <span className="text-lg font-extrabold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>assel</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollTo('features')} className="text-sm hover:opacity-80 transition" style={{ color: 'var(--text-secondary)' }}>{s.nav.features}</button>
            <button onClick={() => scrollTo('pricing')} className="text-sm hover:opacity-80 transition" style={{ color: 'var(--text-secondary)' }}>{s.nav.pricing}</button>
            <button onClick={() => scrollTo('faq')} className="text-sm hover:opacity-80 transition" style={{ color: 'var(--text-secondary)' }}>{s.nav.faq}</button>
            <button onClick={toggleLang} className="text-xs px-2.5 py-1 rounded-md transition" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
              {lang === 'en' ? 'العربية' : 'EN'}
            </button>
            <Link href="/login">
              <button className="text-sm px-4 py-2 rounded-lg transition" style={{ border: '1px solid var(--border-accent)', color: 'var(--accent-secondary)' }}>{s.nav.login}</button>
            </Link>
            <Link href="/signup">
              <button className="text-sm px-5 py-2 rounded-lg font-semibold text-white" style={{ background: 'var(--gradient-primary)', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}>
                {s.nav.trial}
              </button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}>
            <div className="space-y-1.5">
              <div className="w-5 h-0.5 rounded" style={{ background: 'var(--text-secondary)' }}></div>
              <div className="w-5 h-0.5 rounded" style={{ background: 'var(--text-secondary)' }}></div>
              <div className="w-4 h-0.5 rounded" style={{ background: 'var(--text-secondary)' }}></div>
            </div>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden px-4 pb-4 space-y-2" style={{ background: 'rgba(10, 10, 18, 0.95)' }}>
            <button onClick={() => scrollTo('features')} className="block w-full text-left px-3 py-2 rounded text-sm" style={{ color: 'var(--text-secondary)' }}>{s.nav.features}</button>
            <button onClick={() => scrollTo('pricing')} className="block w-full text-left px-3 py-2 rounded text-sm" style={{ color: 'var(--text-secondary)' }}>{s.nav.pricing}</button>
            <button onClick={() => scrollTo('faq')} className="block w-full text-left px-3 py-2 rounded text-sm" style={{ color: 'var(--text-secondary)' }}>{s.nav.faq}</button>
            <button onClick={toggleLang} className="block w-full text-left px-3 py-2 rounded text-sm" style={{ color: 'var(--text-muted)' }}>{lang === 'en' ? 'العربية' : 'English'}</button>
            <div className="flex gap-2 pt-2">
              <Link href="/login"><button className="flex-1 text-sm py-2 rounded-lg" style={{ border: '1px solid var(--border-accent)', color: 'var(--accent-secondary)' }}>{s.nav.login}</button></Link>
              <Link href="/signup"><button className="flex-1 text-sm py-2 rounded-lg font-semibold text-white" style={{ background: 'var(--gradient-primary)' }}>{s.nav.trial}</button></Link>
            </div>
          </div>
        )}
      </nav>

      {/* ======================================================
          SECTION 2: HERO
          ====================================================== */}
      <section ref={hero$.ref} style={hero$.style} className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6" style={{ fontFamily: "'Syne', sans-serif", whiteSpace: 'pre-line' }}>
            {s.hero.h1}
          </h1>
          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {s.hero.sub}
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/signup">
              <button className="px-8 py-3.5 rounded-xl text-base font-semibold text-white transition-all hover:scale-105" style={{ background: 'var(--gradient-primary)', boxShadow: '0 0 30px rgba(124,58,237,0.3)' }}>
                {s.hero.cta1}
              </button>
            </Link>
            <button className="px-8 py-3.5 rounded-xl text-base font-medium transition-all" style={{ border: '1px solid var(--border-accent)', color: 'var(--accent-secondary)' }}>
              ▶ {s.hero.cta2}
            </button>
          </div>

          {/* Social proof */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <div className="flex -space-x-2">
              {['#7c3aed', '#ec4899', '#22c55e', '#f59e0b', '#3b82f6'].map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: c, borderColor: 'var(--bg-base)' }}>
                  {['SK', 'MA', 'LT', 'JW', 'DR'][i]}
                </div>
              ))}
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {s.hero.proof} &nbsp;⭐ <span style={{ color: 'var(--warning)' }}>4.9/5</span>
            </p>
          </div>

          {/* Mock dashboard preview */}
          <div className="max-w-3xl mx-auto">
            <div className="relative p-6 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(12px)' }}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-0">
                {[
                  { icon: '👁', label: 'Visit', done: true },
                  { icon: '🤝', label: 'Invite', done: true },
                  { icon: '💬', label: 'Message', done: false },
                  { icon: '↩️', label: 'Follow Up', done: false },
                ].map((step, i) => (
                  <div key={i} className="flex items-center">
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)' }}>
                      <span className="text-lg">{step.icon}</span>
                      <span className="text-sm font-medium">{step.label}</span>
                      {step.done && <span className="text-xs" style={{ color: 'var(--success)' }}>✓</span>}
                    </div>
                    {i < 3 && <div className="hidden sm:block w-6 h-px mx-1" style={{ background: 'var(--border-accent)' }}></div>}
                  </div>
                ))}
              </div>
              {/* Floating badge */}
              <div className="absolute -top-3 right-4 sm:right-8 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--success)' }}>
                🟢 {s.hero.badge}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gradient divider */}
      <div className="h-px max-w-4xl mx-auto" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.3), transparent)' }}></div>

      {/* ======================================================
          SECTION 3: LOGOS BAR
          ====================================================== */}
      <section ref={logos$.ref} style={logos$.style} className="py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-8" style={{ color: 'var(--text-muted)' }}>{s.logos}</p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {logos.map((name) => (
              <span key={name} className="text-lg sm:text-xl font-bold tracking-wide" style={{ color: 'rgba(255,255,255,0.12)', fontFamily: "'Syne', sans-serif" }}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px max-w-4xl mx-auto" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.2), transparent)' }}></div>

      {/* ======================================================
          SECTION 4: FEATURES
          ====================================================== */}
      <section id="features" ref={feat$.ref} style={feat$.style} className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>{s.features.title}</h2>
          <div className="h-1 w-16 mx-auto rounded-full mb-14" style={{ background: 'var(--gradient-primary)' }}></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {s.features.items.map((f, i) => (
              <div key={i} className="p-6 rounded-xl transition-all hover:scale-[1.02]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(12px)' }}>
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>{f.name}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px max-w-4xl mx-auto" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.2), transparent)' }}></div>

      {/* ======================================================
          SECTION 5: HOW IT WORKS
          ====================================================== */}
      <section ref={how$.ref} style={how$.style} className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>{s.how.title}</h2>
          <div className="h-1 w-16 mx-auto rounded-full mb-14" style={{ background: 'var(--gradient-primary)' }}></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-px" style={{ backgroundImage: 'repeating-linear-gradient(90deg, var(--accent-primary) 0, var(--accent-primary) 8px, transparent 8px, transparent 16px)' }}></div>

            {s.how.steps.map((step, i) => (
              <div key={i} className="text-center relative z-10">
                <div className="w-12 h-12 rounded-full mx-auto mb-5 flex items-center justify-center text-sm font-bold text-white" style={{ background: 'var(--gradient-primary)' }}>
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.name}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px max-w-4xl mx-auto" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.2), transparent)' }}></div>

      {/* ======================================================
          SECTION 6: PRICING
          ====================================================== */}
      <section id="pricing" ref={price$.ref} style={price$.style} className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-2" style={{ fontFamily: "'Syne', sans-serif" }}>{s.pricing.title}</h2>
          <p className="text-center text-sm mb-12" style={{ color: 'var(--text-muted)' }}>{s.pricing.sub}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className="relative p-7 rounded-2xl transition-all"
                style={{
                  background: 'var(--bg-card)',
                  border: plan.popular ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  backdropFilter: 'blur(12px)',
                  transform: plan.popular ? 'scale(1.03)' : 'none',
                  boxShadow: plan.popular ? '0 0 40px rgba(124,58,237,0.2)' : 'none',
                }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white" style={{ background: 'var(--gradient-primary)' }}>
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold" style={{ fontFamily: "'Syne', sans-serif" }}>{plan.price}</span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--success)' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.name === 'Agency' ? '/contact' : '/signup'}>
                  <button
                    className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: plan.popular ? 'var(--gradient-primary)' : 'transparent',
                      border: plan.popular ? 'none' : '1px solid var(--border-accent)',
                      color: plan.popular ? 'white' : 'var(--accent-secondary)',
                      boxShadow: plan.popular ? '0 0 20px rgba(124,58,237,0.3)' : 'none',
                    }}
                  >
                    {plan.name === 'Agency' ? s.pricing.contact : s.nav.trial}
                  </button>
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-xs mt-8" style={{ color: 'var(--text-muted)' }}>{s.pricing.note}</p>
        </div>
      </section>

      <div className="h-px max-w-4xl mx-auto" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.2), transparent)' }}></div>

      {/* ======================================================
          SECTION 7: TESTIMONIALS
          ====================================================== */}
      <section ref={test$.ref} style={test$.style} className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>{s.testimonials.title}</h2>
          <div className="h-1 w-16 mx-auto rounded-full mb-14" style={{ background: 'var(--gradient-primary)' }}></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((tm, i) => (
              <div key={i} className="p-6 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(12px)' }}>
                <div className="flex gap-0.5 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => <span key={s} style={{ color: 'var(--warning)' }}>★</span>)}
                </div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>"{tm.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: tm.color }}>
                    {tm.name.split(' ').map(w => w[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{tm.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tm.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px max-w-4xl mx-auto" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.2), transparent)' }}></div>

      {/* ======================================================
          SECTION 8: FAQ
          ====================================================== */}
      <section id="faq" ref={faq$.ref} style={faq$.style} className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>{s.faqTitle}</h2>
          <div className="h-1 w-16 mx-auto rounded-full mb-12" style={{ background: 'var(--gradient-primary)' }}></div>

          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{f.q}</span>
                  <span className="text-lg transition-transform ml-3" style={{ color: 'var(--accent-secondary)', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px max-w-4xl mx-auto" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.2), transparent)' }}></div>

      {/* ======================================================
          SECTION 9: CTA BANNER
          ====================================================== */}
      <section ref={ctaBan$.ref} style={ctaBan$.style} className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center p-10 sm:p-14 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-accent)', backdropFilter: 'blur(12px)', boxShadow: '0 0 60px rgba(124,58,237,0.1)' }}>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3" style={{ fontFamily: "'Syne', sans-serif" }}>{s.cta.h}</h2>
          <p className="text-base mb-8" style={{ color: 'var(--text-secondary)' }}>{s.cta.sub}</p>
          <Link href="/signup">
            <button className="px-10 py-4 rounded-xl text-base font-semibold text-white transition-all hover:scale-105" style={{ background: 'var(--gradient-primary)', boxShadow: '0 0 30px rgba(124,58,237,0.4)' }}>
              {s.cta.btn}
            </button>
          </Link>
        </div>
      </section>

      {/* ======================================================
          SECTION 10: FOOTER
          ====================================================== */}
      <footer className="py-14 px-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Logo column */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: 'var(--gradient-primary)' }}>W</div>
                <span className="text-base font-extrabold" style={{ fontFamily: "'Syne', sans-serif" }}>assel</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.footer.tagline}</p>
            </div>

            {/* Product */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Product</p>
              <ul className="space-y-2">
                {['Features', 'Pricing', 'FAQ', 'Changelog'].map(l => (
                  <li key={l}><button onClick={() => scrollTo(l.toLowerCase())} className="text-xs hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>{l}</button></li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Company</p>
              <ul className="space-y-2">
                {[{ l: 'About', h: '/about' }, { l: 'Blog', h: '#' }, { l: 'Careers', h: '#' }, { l: 'Contact', h: '/contact' }].map(i => (
                  <li key={i.l}><Link href={i.h} className="text-xs hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>{i.l}</Link></li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Legal</p>
              <ul className="space-y-2">
                <li><Link href="/privacy" className="text-xs hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-xs hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.footer.copy}</p>
            <button onClick={toggleLang} className="text-[10px] mt-2 sm:mt-0 hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
              {lang === 'en' ? 'EN | العربية' : 'العربية | EN'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
