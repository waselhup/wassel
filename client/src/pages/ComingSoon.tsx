import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import { Send, Sparkles, UserCheck, FileText, PenSquare, ArrowRight } from 'lucide-react';

interface FeatureInfo {
  icon: any;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  eta: string;
}

const FEATURE_INFO: Record<string, FeatureInfo> = {
  campaigns: {
    icon: Send,
    titleAr: 'التواصل المهني قريباً',
    titleEn: 'Smart outreach coming soon',
    descAr:
      'نعمل على ميزة متقدّمة لأتمتة التواصل المهني على LinkedIn بالذكاء الاصطناعي — مع احترام كامل لحدود المنصة وبجودة محادثات حقيقية.',
    descEn:
      'We are crafting a thoughtful AI-powered outreach experience — one that respects platform limits and reads like a real conversation.',
    eta: 'Q3 2026',
  },
};

export default function ComingSoon() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const isAr = i18n.language === 'ar';

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const feature = params.get('feature') || 'campaigns';
  const info = FEATURE_INFO[feature] || FEATURE_INFO.campaigns;
  const Icon = info.icon;
  const title = isAr ? info.titleAr : info.titleEn;
  const desc = isAr ? info.descAr : info.descEn;

  return (
    <DashboardLayout>
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '64px 24px',
          textAlign: 'center',
          fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
        }}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #0A8F84 0%, #0F766E 100%)',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 28px -10px rgba(15,118,110,0.5)',
          }}
        >
          <Icon size={40} color="#fff" />
        </div>

        <div
          style={{
            display: 'inline-block',
            background: '#FEF3C7',
            color: '#B45309',
            padding: '6px 16px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 900,
            marginBottom: 16,
            letterSpacing: 0.3,
          }}
        >
          {t('common.comingSoon', isAr ? 'قريباً' : 'Coming soon')}
        </div>

        <h1
          style={{
            fontSize: 30,
            fontWeight: 800,
            color: '#0B1220',
            margin: '0 0 12px',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: '#475569',
            lineHeight: 1.7,
            maxWidth: 560,
            margin: '0 auto 28px',
          }}
        >
          {desc}
        </p>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(15,118,110,0.08)',
            color: '#0F766E',
            padding: '10px 18px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 800,
            border: '1px solid rgba(15,118,110,0.18)',
            marginBottom: 40,
          }}
        >
          <Sparkles size={14} />
          {isAr ? `متوقع: ${info.eta}` : `Expected: ${info.eta}`}
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 20,
            padding: 24,
            textAlign: isAr ? 'right' : 'left',
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: '#0B1220',
              margin: '0 0 16px',
            }}
          >
            {isAr ? 'في هذه الأثناء، جرّب:' : 'In the meantime, try:'}
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <CrossSellCard
              icon={UserCheck}
              title={t('nav.profileAnalysis', isAr ? 'تحليل البروفايل' : 'Profile analysis')}
              desc={isAr ? 'تقييم أكاديمي متعمق' : 'Deep academic review'}
              onClick={() => setLocation('/app/profile-analysis')}
              isAr={isAr}
            />
            <CrossSellCard
              icon={FileText}
              title={t('nav.cv', isAr ? 'السيرة الذاتية' : 'CV Tailor')}
              desc={isAr ? 'سيرة مُحسَّنة لكل فرصة' : 'CV tailored per role'}
              onClick={() => setLocation('/app/cv')}
              isAr={isAr}
            />
            <CrossSellCard
              icon={PenSquare}
              title={t('nav.posts', isAr ? 'المنشورات' : 'Posts')}
              desc={isAr ? 'منشورات LinkedIn ذكية' : 'Smart LinkedIn posts'}
              onClick={() => setLocation('/app/posts')}
              isAr={isAr}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function CrossSellCard({
  icon: Icon,
  title,
  desc,
  onClick,
  isAr,
}: {
  icon: any;
  title: string;
  desc: string;
  onClick: () => void;
  isAr: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 16,
        border: '1px solid rgba(15,23,42,0.08)',
        borderRadius: 14,
        background: '#fff',
        cursor: 'pointer',
        textAlign: isAr ? 'right' : 'left',
        transition: 'all 180ms',
        fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#0F766E';
        e.currentTarget.style.background = 'rgba(15,118,110,0.04)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(15,23,42,0.08)';
        e.currentTarget.style.background = '#fff';
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'rgba(15,118,110,0.08)',
          color: '#0F766E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        }}
      >
        <Icon size={16} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0B1220', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748B' }}>{desc}</div>
      <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#0F766E', fontSize: 11, fontWeight: 800 }}>
        {isAr ? 'ابدأ' : 'Start'}
        <ArrowRight size={11} style={{ transform: isAr ? 'rotate(180deg)' : undefined }} />
      </div>
    </button>
  );
}
