import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const steps = [
  { id: 0, labelAr: 'أضف ملفك الشخصي', labelEn: 'Add Your Profile', icon: '👤', color: '#0A8F84' },
  { id: 1, labelAr: 'الذكاء يحلل ملفك', labelEn: 'AI Analyzes', icon: '🔍', color: '#0A8F84' },
  { id: 2, labelAr: 'أرسل رسائل مخصصة', labelEn: 'Send Custom Messages', icon: '✉️', color: '#C9922A' },
];

const msgAr = 'مرحباً أحمد، لاحظت اهتمامك بتطوير مسيرتك المهنية في قطاع التقنية...';
const msgEn = 'Hello Ahmed, I noticed your interest in developing your career in the tech sector...';

const VideoDemo: React.FC = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState('');
  const [bars, setBars] = useState([0, 0, 0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => (s + 1) % 3);
      setTyped('');
      setBars([0, 0, 0]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (step === 1) {
      setTimeout(() => setBars([92, 85, 78]), 300);
    }
    if (step === 2) {
      const msg = isAr ? msgAr : msgEn;
      let i = 0;
      const t = setInterval(() => {
        setTyped(msg.substring(0, i));
        i++;
        if (i > msg.length) clearInterval(t);
      }, 40);
      return () => clearInterval(t);
    }
  }, [step, isAr]);

  const barLabels = isAr
    ? ['العنوان الوظيفي', 'الخبرات', 'المهارات']
    : ['Job Title', 'Experience', 'Skills'];

  return (
    <section style={{ padding: '80px 24px', background: '#F4F7FB', textAlign: 'center' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ color: '#0A8F84', fontWeight: 900, fontSize: '12px', letterSpacing: '3px', marginBottom: '12px', fontFamily: 'Cairo, sans-serif' }}>
          {isAr ? 'كيف تعمل المنصة' : 'HOW IT WORKS'}
        </p>
        <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#0B1220', marginBottom: '48px', fontFamily: isAr ? 'Cairo, sans-serif' : 'Inter, sans-serif' }}>
          {isAr ? 'شاهد كيف تعمل وصّل' : 'See How Wassel Works'}
        </h2>

        <div style={{ background: '#0B1220', borderRadius: '16px', padding: '32px', marginBottom: '32px', minHeight: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>

          {step === 0 && (
            <div key="s0" style={{ animation: 'vd-fade 0.5s ease', background: '#1E2A3B', borderRadius: '12px', padding: '24px', width: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', direction: isAr ? 'rtl' : 'ltr' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#0A8F84', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>👤</div>
                <div style={{ textAlign: isAr ? 'right' : 'left' }}>
                  <div style={{ color: '#fff', fontWeight: 900, fontFamily: 'Cairo, sans-serif' }}>{isAr ? 'أحمد الزهراني' : 'Ahmed Al-Zahrani'}</div>
                  <div style={{ color: '#6E809A', fontSize: '12px', fontFamily: 'Cairo, sans-serif' }}>{isAr ? 'مدير مبيعات | أرامكو' : 'Sales Manager | Aramco'}</div>
                </div>
              </div>
              <div style={{ background: '#0A8F84', borderRadius: '8px', padding: '8px 16px', textAlign: 'center' }}>
                <span style={{ color: '#fff', fontWeight: 900, fontFamily: 'Cairo, sans-serif', fontSize: '14px' }}>{isAr ? 'تحليل الملف الشخصي ✓' : 'Profile Analyzed ✓'}</span>
              </div>
            </div>
          )}

          {step === 1 && (
            <div key="s1" style={{ width: '280px', animation: 'vd-fade 0.5s ease' }}>
              <div style={{ color: '#C9922A', fontWeight: 900, marginBottom: '16px', fontFamily: 'Cairo, sans-serif' }}>{isAr ? 'جاري التحليل...' : 'Analyzing...'}</div>
              {barLabels.map((label, i) => (
                <div key={i} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9AAAB8', fontSize: '12px', marginBottom: '4px', fontFamily: 'Cairo, sans-serif', direction: isAr ? 'rtl' : 'ltr' }}>
                    <span>{label}</span>
                    <span>{[92, 85, 78][i]}%</span>
                  </div>
                  <div style={{ background: '#1E2A3B', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ width: bars[i] + '%', height: '100%', background: '#0A8F84', borderRadius: '4px', transition: 'width 1s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div key="s2" style={{ width: '300px', animation: 'vd-fade 0.5s ease' }}>
              <div style={{ background: '#1E2A3B', borderRadius: '12px', padding: '16px' }}>
                <div style={{ color: '#C9922A', fontSize: '11px', marginBottom: '8px', fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                  {isAr ? 'رسالة مخصصة بالذكاء الاصطناعي' : 'AI-Personalized Message'}
                </div>
                <div style={{ color: '#E2E8F0', fontSize: '13px', lineHeight: '1.7', fontFamily: 'Cairo, sans-serif', textAlign: isAr ? 'right' : 'left', direction: isAr ? 'rtl' : 'ltr', minHeight: '3rem' }}>
                  {typed}<span style={{ animation: 'vd-blink 1s infinite', color: '#C9922A' }}>|</span>
                </div>
              </div>
            </div>
          )}

          <div style={{ position: 'absolute', bottom: '16px', display: 'flex', gap: '8px' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: i === step ? '24px' : '8px', height: '8px', borderRadius: '4px', background: i === step ? '#C9922A' : '#374357', transition: 'all 0.3s ease' }} />
            ))}
          </div>

          <style>{`
            @keyframes vd-fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes vd-blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
          `}</style>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', direction: isAr ? 'rtl' : 'ltr' }}>
          {steps.map((s) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '10px',
              background: step === s.id ? 'rgba(10,143,132,0.1)' : '#fff',
              border: step === s.id ? '1px solid #0A8F84' : '1px solid rgba(11,18,32,0.07)',
              transition: 'all 0.3s ease'
            }}>
              <span style={{ fontSize: '18px' }}>{s.icon}</span>
              <span style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: '13px', color: step === s.id ? '#0A8F84' : '#6E809A' }}>
                {isAr ? s.labelAr : s.labelEn}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default VideoDemo;
