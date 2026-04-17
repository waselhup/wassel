import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { UserPlus, Wand2, Sparkles } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

export default function HowItWorksTimeline() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const steps = [
    {
      n: '01',
      icon: UserPlus,
      title: isAr ? 'سجّل بسرعة' : 'Sign up fast',
      desc: isAr
        ? 'حساب جديد في ثوانٍ عبر Google أو البريد الإلكتروني. تحصل على 1,000 توكن مجاناً.'
        : 'Create your account in seconds with Google or email. 1,000 free tokens included.',
    },
    {
      n: '02',
      icon: Wand2,
      title: isAr ? 'اختر أداتك' : 'Choose a tool',
      desc: isAr
        ? 'حلّل بروفايلك، أو طوّر سيرتك الذاتية، أو اكتب منشوراً، أو ابدأ حملة تواصل.'
        : 'Analyze your profile, refine your résumé, write a post, or launch a thoughtful outreach campaign.',
    },
    {
      n: '03',
      icon: Sparkles,
      title: isAr ? 'حقّق نتائج' : 'See results',
      desc: isAr
        ? 'نتائج فورية مدعومة بنماذج Claude — تقييمات، سير ذاتية، ورسائل مخصصة لكل جهة.'
        : 'Instant results powered by Claude — scores, tailored CVs, and per-recipient messages.',
    },
  ];

  return (
    <section id="how" style={{ padding: '100px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, ease }}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              color: '#0F766E',
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            {isAr ? 'آلية العمل' : 'How it works'}
          </div>
          <h2
            style={{
              fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
              fontSize: 'clamp(30px, 4vw, 44px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: '#0B1220',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {isAr ? 'ثلاث خطوات. دقائق قليلة.' : 'Three steps. A few minutes.'}
          </h2>
        </motion.div>

        <div
          className="landing-timeline"
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
          }}
        >
          {/* Connecting line (desktop) */}
          <div
            aria-hidden
            className="timeline-line"
            style={{
              position: 'absolute',
              top: 28,
              insetInlineStart: '16.66%',
              insetInlineEnd: '16.66%',
              height: 2,
              backgroundImage: 'repeating-linear-gradient(90deg, rgba(15,118,110,0.3) 0 6px, transparent 6px 12px)',
            }}
          />

          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, ease, delay: 0.1 * i }}
              style={{ position: 'relative', textAlign: 'center' }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#0F766E',
                  color: '#fff',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: '0 8px 20px -6px rgba(15,118,110,0.45), inset 0 1px 0 rgba(255,255,255,0.2)',
                  position: 'relative',
                }}
              >
                <s.icon size={20} />
                <span
                  style={{
                    position: 'absolute',
                    top: -6,
                    insetInlineEnd: -6,
                    background: '#fff',
                    color: '#0F766E',
                    fontSize: 10,
                    fontWeight: 900,
                    padding: '2px 6px',
                    borderRadius: 6,
                    border: '1px solid rgba(15,118,110,0.25)',
                  }}
                >
                  {s.n}
                </span>
              </div>
              <h3
                style={{
                  fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#0B1220',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
                  fontSize: 14,
                  color: '#475569',
                  lineHeight: 1.6,
                  maxWidth: 280,
                  margin: '8px auto 0',
                }}
              >
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .landing-timeline { grid-template-columns: 1fr !important; }
          .timeline-line { display: none !important; }
        }
      `}</style>
    </section>
  );
}
