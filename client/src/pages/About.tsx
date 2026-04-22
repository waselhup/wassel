import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { WasselLogo } from '../components/WasselLogo';

export default function About() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const font = isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif';

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: font,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '4rem 1.5rem 6rem',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: '3rem',
            textDecoration: 'none',
            color: 'var(--text)',
          }}
        >
          <WasselLogo size={28} />
          <span style={{ fontWeight: 600, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
            {isRTL ? 'وصل' : 'Wassel'}
          </span>
        </Link>

        <h1
          style={{
            fontSize: 'clamp(2rem, 4vw, 2.6rem)',
            fontWeight: 500,
            letterSpacing: '-0.03em',
            color: 'var(--text)',
            marginBottom: '1.75rem',
            lineHeight: 1.15,
          }}
        >
          {isRTL ? 'من نحن' : 'About'}
        </h1>

        {isRTL ? (
          <>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--text-body)', marginBottom: '1.25rem' }}>
              وصل منصة سعودية مدعومة بالذكاء الاصطناعي، مصمَّمة لمساعدة المحترفين في السوق السعودي
              والخليجي على تطوير حضورهم المهني على LinkedIn — من تحليل البروفايل وصياغة السيرة الذاتية
              إلى إنشاء المحتوى وإدارة حملات التواصل.
            </p>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--text-body)', marginBottom: '1.25rem' }}>
              نؤمن بأن كل محترف سعودي يستحق أدوات ذكية تفهم لغته وسوقه وسياقه الثقافي.
            </p>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-dim)', marginBottom: '3rem' }}>
              تأسست وصل في الأحساء، المنطقة الشرقية، المملكة العربية السعودية.
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--text-body)', marginBottom: '1.25rem' }}>
              Wassel is a Saudi AI-powered platform built to help professionals across the Saudi
              and GCC markets grow their LinkedIn presence — from profile analysis and CV creation
              to content generation and outreach campaigns.
            </p>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--text-body)', marginBottom: '1.25rem' }}>
              We believe every Saudi professional deserves intelligent tools that understand their
              language, market, and cultural context.
            </p>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-dim)', marginBottom: '3rem' }}>
              Founded in Al-Ahsa, Eastern Province, Saudi Arabia.
            </p>
          </>
        )}

        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '0.6rem 1.1rem',
            background: 'var(--brand)',
            color: 'white',
            borderRadius: 10,
            fontSize: '0.9rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {isRTL ? (
            <>
              <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} />
              الرجوع للرئيسية
            </>
          ) : (
            <>
              <ArrowLeft size={16} />
              Back to home
            </>
          )}
        </Link>
      </div>
    </div>
  );
}
