import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Linkedin,
  User,
  Target,
  ArrowRight,
  ArrowLeft,
  X,
  Check,
  Brain,
  FileText,
  Send,
  Share2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type Step = 0 | 1 | 2 | 3;

interface Props {
  onClose: () => void;
}

/**
 * OnboardingWizard — 4-step modal shown to new users on first /app visit.
 * Sets profiles.onboarded = true on completion or skip.
 */
export const OnboardingWizard: React.FC<Props> = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const isAr = i18n.language === 'ar';

  const [step, setStep] = useState<Step>(0);
  const [industry, setIndustry] = useState('');
  const [role, setRole] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);

  const totalSteps = 4;

  async function markOnboarded() {
    if (!user?.id) return onClose();
    try {
      await supabase
        .from('profiles')
        .update({
          onboarded: true,
          industry: industry || null,
          job_title: role || null,
          goal: goal || null,
        })
        .eq('id', user.id);
    } catch (e) {
      console.error('[Onboarding] Failed to mark onboarded:', e);
    }
    onClose();
  }

  async function handleNext() {
    if (step === 2) {
      setSaving(true);
      try {
        if (user?.id && (industry || role || goal)) {
          await supabase
            .from('profiles')
            .update({
              industry: industry || null,
              job_title: role || null,
              goal: goal || null,
            })
            .eq('id', user.id);
        }
      } catch (e) {
        console.error('[Onboarding] Save profile failed:', e);
      }
      setSaving(false);
    }
    if (step < (totalSteps - 1)) setStep((step + 1) as Step);
  }

  async function handleSkip() {
    await markOnboarded();
  }

  async function handleFinish(href: string) {
    await markOnboarded();
    if (typeof window !== 'undefined') {
      window.location.href = href;
    }
  }

  const industries = [
    { value: 'tech', labelAr: 'تقنية', labelEn: 'Technology' },
    { value: 'finance', labelAr: 'تمويل', labelEn: 'Finance' },
    { value: 'hr', labelAr: 'موارد بشرية', labelEn: 'HR' },
    { value: 'marketing', labelAr: 'تسويق', labelEn: 'Marketing' },
    { value: 'sales', labelAr: 'مبيعات', labelEn: 'Sales' },
    { value: 'consulting', labelAr: 'استشارات', labelEn: 'Consulting' },
    { value: 'other', labelAr: 'أخرى', labelEn: 'Other' },
  ];

  const tools = [
    {
      key: 'profile',
      icon: Brain,
      titleAr: 'حلّل بروفايلك',
      titleEn: 'Analyze your profile',
      descAr: 'احصل على تقييم شامل من 100',
      descEn: 'Get a 100-point assessment',
      href: '/app/profile-analysis',
      color: '#0A8F84',
    },
    {
      key: 'cv',
      icon: FileText,
      titleAr: 'أنشئ سيرة ذاتية',
      titleEn: 'Create a CV',
      descAr: 'مخصصة لكل وظيفة',
      descEn: 'Tailored for each job',
      href: '/app/cv',
      color: '#0EA5E9',
    },
    {
      key: 'posts',
      icon: Share2,
      titleAr: 'اكتب منشور LinkedIn',
      titleEn: 'Write a LinkedIn post',
      descAr: 'بنبرة احترافية',
      descEn: 'In a professional tone',
      href: '/app/posts',
      color: '#8B5CF6',
    },
    {
      key: 'campaigns',
      icon: Send,
      titleAr: 'ابدأ حملة',
      titleEn: 'Launch a campaign',
      descAr: 'تواصل مع جمهورك المستهدف',
      descEn: 'Reach your target audience',
      href: '/app/campaigns',
      color: '#F97316',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 9999,
        fontFamily: 'Cairo, Inter, sans-serif',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: '#fff',
          borderRadius: 24,
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
          position: 'relative',
        }}
      >
        <button
          onClick={handleSkip}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 16,
            insetInlineEnd: 16,
            width: 36,
            height: 36,
            borderRadius: 12,
            background: '#F3F4F6',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6B7280',
            zIndex: 2,
          }}
        >
          <X size={18} />
        </button>

        <div
          style={{
            padding: '24px 28px 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: 4,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 4,
                  background: i <= step ? '#0A8F84' : '#E5E7EB',
                  transition: 'background 200ms',
                }}
              />
            ))}
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#9CA3AF',
              fontWeight: 700,
              marginTop: 8,
            }}
          >
            {isAr ? `الخطوة ${step + 1} من ${totalSteps}` : `Step ${step + 1} of ${totalSteps}`}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              style={{ padding: '32px 28px 28px' }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, #0A8F84 0%, #0EA5E9 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <Sparkles size={36} color="#fff" />
              </div>
              <h2
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: '#1F2937',
                  margin: '0 0 10px',
                  letterSpacing: '-0.5px',
                }}
              >
                {isAr ? 'مرحباً بك في وصّل!' : 'Welcome to Wassel!'}
              </h2>
              <p
                style={{
                  fontSize: 15,
                  color: '#6B7280',
                  lineHeight: 1.7,
                  margin: '0 0 20px',
                }}
              >
                {isAr
                  ? 'حصلت على 1000 توكن مجاني للبدء. خلال دقيقتين، سنرشدك لأهم أدوات وصّل لتحقق أقصى استفادة.'
                  : "You got 1000 free tokens to start. In 2 minutes, we'll show you Wassel's most powerful tools."}
              </p>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(10,143,132,0.08), rgba(14,165,233,0.08))',
                  borderRadius: 14,
                  padding: '18px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: '#0A8F84',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 20,
                  }}
                >
                  1K
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1F2937' }}>
                    {isAr ? 'رصيدك الحالي: 1000 توكن' : 'Your balance: 1,000 tokens'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                    {isAr ? 'كافي لـ 30+ تحليل و 100+ منشور' : 'Enough for 30+ analyses and 100+ posts'}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              style={{ padding: '32px 28px 28px' }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: '#0077B5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <Linkedin size={36} color="#fff" />
              </div>
              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: '#1F2937',
                  margin: '0 0 10px',
                }}
              >
                {isAr ? 'لنبدأ بتحليل بروفايلك' : "Let's analyze your profile"}
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: '#6B7280',
                  lineHeight: 1.7,
                  margin: '0 0 20px',
                }}
              >
                {isAr
                  ? 'يمكنك تحليل أي بروفايل LinkedIn (بما فيه بروفايلك) للحصول على تقييم احترافي شامل.'
                  : 'You can analyze any LinkedIn profile (including yours) to get a comprehensive professional assessment.'}
              </p>
              <div
                style={{
                  background: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1F2937', marginBottom: 8 }}>
                  {isAr ? 'ماذا ستحصل عليه:' : "What you'll get:"}
                </div>
                <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 13, color: '#6B7280', lineHeight: 1.9 }}>
                  <li>{isAr ? 'تقييم شامل من 100 نقطة' : 'Score out of 100'}</li>
                  <li>{isAr ? 'نقاط القوة والضعف' : 'Strengths and weaknesses'}</li>
                  <li>{isAr ? 'خطة عمل قابلة للتنفيذ' : 'Actionable improvement plan'}</li>
                </ul>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              style={{ padding: '32px 28px 28px' }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: '#8B5CF6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <User size={36} color="#fff" />
              </div>
              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: '#1F2937',
                  margin: '0 0 10px',
                }}
              >
                {isAr ? 'أخبرنا عن نفسك' : 'Tell us about yourself'}
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: '#6B7280',
                  lineHeight: 1.7,
                  margin: '0 0 18px',
                }}
              >
                {isAr ? 'نستخدم هذه المعلومات لتخصيص اقتراحاتنا.' : "We use this to personalize your experience."}
              </p>

              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#374151',
                    marginBottom: 6,
                  }}
                >
                  {isAr ? 'القطاع' : 'Industry'}
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #E5E7EB',
                    fontSize: 14,
                    background: '#F9FAFB',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                >
                  <option value="">{isAr ? 'اختر القطاع...' : 'Select industry...'}</option>
                  {industries.map((ind) => (
                    <option key={ind.value} value={ind.value}>
                      {isAr ? ind.labelAr : ind.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#374151',
                    marginBottom: 6,
                  }}
                >
                  {isAr ? 'دورك الوظيفي' : 'Your role'}
                </label>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={isAr ? 'مثال: مدير منتج' : 'e.g. Product Manager'}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #E5E7EB',
                    fontSize: 14,
                    background: '#F9FAFB',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#374151',
                    marginBottom: 6,
                  }}
                >
                  {isAr ? 'هدفك من وصّل' : 'Your goal with Wassel'}
                </label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder={isAr ? 'مثال: زيادة عدد العملاء B2B' : 'e.g. Reach more B2B clients'}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #E5E7EB',
                    fontSize: 14,
                    background: '#F9FAFB',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              style={{ padding: '32px 28px 28px' }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, #F97316, #DC2626)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <Target size={36} color="#fff" />
              </div>
              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: '#1F2937',
                  margin: '0 0 10px',
                }}
              >
                {isAr ? 'جاهز للبدء؟' : 'Ready to start?'}
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: '#6B7280',
                  lineHeight: 1.7,
                  margin: '0 0 18px',
                }}
              >
                {isAr ? 'اختر أداة لتجربتها الآن:' : 'Pick a tool to try right now:'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.key}
                      onClick={() => handleFinish(tool.href)}
                      style={{
                        background: '#fff',
                        border: '1.5px solid #E5E7EB',
                        borderRadius: 14,
                        padding: 16,
                        textAlign: 'start',
                        cursor: 'pointer',
                        transition: 'all 150ms',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = tool.color;
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = `0 6px 16px ${tool.color}33`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#E5E7EB';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: tool.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 10,
                        }}
                      >
                        <Icon size={18} color="#fff" />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1F2937', marginBottom: 3 }}>
                        {isAr ? tool.titleAr : tool.titleEn}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>
                        {isAr ? tool.descAr : tool.descEn}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 28px 24px',
            gap: 10,
          }}
        >
          <button
            onClick={handleSkip}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {isAr ? 'تخطي الآن' : 'Skip for now'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && step < 3 && (
              <button
                onClick={() => setStep((step - 1) as Step)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '11px 16px',
                  borderRadius: 12,
                  background: '#F3F4F6',
                  color: '#374151',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {isAr ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
                {isAr ? 'السابق' : 'Back'}
              </button>
            )}
            {step < 3 && (
              <button
                onClick={handleNext}
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '11px 20px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #0A8F84 0%, #0EA5E9 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  boxShadow: '0 6px 16px rgba(10,143,132,0.25)',
                  fontFamily: 'inherit',
                }}
              >
                {isAr ? 'التالي' : 'Next'}
                {isAr ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingWizard;
