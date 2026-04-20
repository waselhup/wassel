import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Brain, FileText, Share2, BarChart3, ArrowRight } from 'lucide-react';
import { useState } from 'react';

const ease = [0.16, 1, 0.3, 1] as const;

function SectionHeader() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, ease }}
      style={{ maxWidth: 720, marginBottom: 48 }}
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
        {isAr ? 'الخدمات' : 'Product'}
      </div>
      <h2
        style={{
          fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
          fontSize: 'clamp(32px, 4vw, 48px)',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: '#0B1220',
          lineHeight: 1.1,
          margin: 0,
        }}
      >
        {isAr ? 'كل ما تحتاجه لنمو مسارك' : 'Everything for your career growth'}
      </h2>
      <p
        style={{
          fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
          fontSize: 17,
          color: '#475569',
          lineHeight: 1.6,
          marginTop: 14,
        }}
      >
        {isAr
          ? 'خدمات ذكية مصممة بعناية، تعمل معاً لدعم حضورك المهني.'
          : 'Carefully designed services working together to support your professional presence.'}
      </p>
    </motion.div>
  );
}

function ScoreMeter() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  return (
    <div
      style={{
        marginTop: 22,
        background: '#fff',
        border: '1px solid rgba(15,23,42,0.06)',
        borderRadius: 12,
        padding: 16,
      }}
    >
      {[
        { label: isAr ? 'العنوان' : 'Headline', pct: 92 },
        { label: isAr ? 'النبذة' : 'Summary', pct: 78 },
        { label: isAr ? 'الخبرة' : 'Experience', pct: 85 },
      ].map((row, i) => (
        <div key={i} style={{ marginBottom: i < 2 ? 10 : 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#64748B',
              fontWeight: 600,
              marginBottom: 4,
              fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
            }}
          >
            <span>{row.label}</span>
            <span style={{ fontFamily: 'Inter, sans-serif', color: '#0F766E' }}>{row.pct}%</span>
          </div>
          <div style={{ height: 6, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${row.pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.0, delay: 0.3 + i * 0.1, ease }}
              style={{ height: '100%', background: 'linear-gradient(90deg, #0F766E, #14B8A6)' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function LargeCard({
  icon: Icon,
  iconBg,
  title,
  desc,
  route,
  children,
  colStart,
  colSpan,
}: {
  icon: any;
  iconBg: string;
  title: string;
  desc: string;
  route: string;
  children?: React.ReactNode;
  colStart?: number;
  colSpan?: number;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [hover, setHover] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, ease }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        gridColumn: colStart ? `${colStart} / span ${colSpan || 1}` : undefined,
        background: '#fff',
        border: hover ? '1px solid rgba(15,118,110,0.4)' : '1px solid rgba(15,23,42,0.08)',
        borderRadius: 20,
        padding: 32,
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hover
          ? '0 20px 40px -20px rgba(15,118,110,0.22)'
          : '0 2px 4px rgba(15,23,42,0.03)',
        transition: 'transform 200ms ease-out, box-shadow 200ms ease-out, border-color 200ms ease-out',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0F766E',
          marginBottom: 20,
        }}
      >
        <Icon size={24} />
      </div>
      <h3
        style={{
          fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#0B1220',
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
          fontSize: 15,
          color: '#475569',
          lineHeight: 1.6,
          marginTop: 10,
          marginBottom: 0,
        }}
      >
        {desc}
      </p>
      {children}
      <Link
        href={route}
        style={{
          marginTop: 'auto',
          paddingTop: 20,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          color: '#0F766E',
          textDecoration: 'none',
        }}
      >
        {isAr ? 'استكشف' : 'Explore'}
        <ArrowRight size={13} style={{ transform: isAr ? 'rotate(180deg)' : undefined, transition: 'transform 200ms', marginInlineStart: hover ? 4 : 0 }} />
      </Link>
    </motion.div>
  );
}

function SmallCard({
  icon: Icon,
  title,
  desc,
  route,
  colStart,
  colSpan,
}: {
  icon: any;
  title: string;
  desc: string;
  route: string;
  colStart?: number;
  colSpan?: number;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [hover, setHover] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, ease }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        gridColumn: colStart ? `${colStart} / span ${colSpan || 1}` : undefined,
        background: '#fff',
        border: hover ? '1px solid rgba(15,118,110,0.4)' : '1px solid rgba(15,23,42,0.08)',
        borderRadius: 20,
        padding: 28,
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hover ? '0 14px 30px -16px rgba(15,118,110,0.2)' : '0 2px 4px rgba(15,23,42,0.03)',
        transition: 'transform 200ms ease-out, box-shadow 200ms ease-out, border-color 200ms ease-out',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'rgba(15,118,110,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0F766E',
          marginBottom: 16,
        }}
      >
        <Icon size={18} />
      </div>
      <h3
        style={{
          fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#0B1220',
          margin: 0,
          lineHeight: 1.25,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
          fontSize: 14,
          color: '#475569',
          lineHeight: 1.55,
          marginTop: 6,
          marginBottom: 0,
        }}
      >
        {desc}
      </p>
      <Link
        href={route}
        style={{
          marginTop: 'auto',
          paddingTop: 18,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
          fontSize: 12.5,
          fontWeight: 700,
          color: '#0F766E',
          textDecoration: 'none',
        }}
      >
        {isAr ? 'استكشف' : 'Explore'}
        <ArrowRight size={12} style={{ transform: isAr ? 'rotate(180deg)' : undefined }} />
      </Link>
    </motion.div>
  );
}

export default function BentoFeatures() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  return (
    <section id="features" style={{ padding: '100px 24px', background: 'linear-gradient(180deg, #fff 0%, #F8FAFC 100%)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionHeader />

        <div
          className="landing-bento"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          <LargeCard
            colStart={1}
            colSpan={2}
            icon={Brain}
            iconBg="linear-gradient(135deg, rgba(15,118,110,0.12), rgba(20,184,166,0.08))"
            title={isAr ? 'تحليل البروفايل المهني' : 'Profile analysis'}
            desc={isAr
              ? 'تحليل متعمق لبروفايل LinkedIn مع تقييم من 100 وخطة تطوير واضحة خطوة بخطوة.'
              : 'In-depth LinkedIn profile review with a 100-point score and a clear, actionable growth plan.'}
            route="/app/profile-analysis"
          >
            <ScoreMeter />
          </LargeCard>

          <SmallCard
            colStart={3}
            icon={FileText}
            title={isAr ? 'تخصيص السيرة الذاتية' : 'CV Tailor'}
            desc={isAr ? 'سيرة احترافية لكل فرصة بمعايير السوق السعودي.' : 'A polished CV tailored to every opportunity.'}
            route="/app/cv"
          />

          <SmallCard
            colStart={1}
            colSpan={2}
            icon={Share2}
            title={isAr ? 'منشورات LinkedIn' : 'LinkedIn Posts'}
            desc={isAr ? 'محتوى احترافي يجذب التفاعل ويبني سمعتك.' : 'Thoughtful posts that build your reputation.'}
            route="/app/posts"
          />
          <SmallCard
            icon={BarChart3}
            title={isAr ? 'التحليلات' : 'Analytics'}
            desc={isAr ? 'تتبع تقدمك وقياس نتائج جهودك.' : 'Track your progress and measure outcomes.'}
            route="/app/analytics"
          />
        </div>
      </div>

      {/* responsive overrides */}
      <style>{`
        @media (max-width: 768px) {
          .landing-bento { grid-template-columns: 1fr !important; }
          .landing-bento > * { grid-column: auto !important; }
        }
      `}</style>
    </section>
  );
}
