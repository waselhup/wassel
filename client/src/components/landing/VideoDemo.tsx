import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, User, BarChart2, MessageSquare } from 'lucide-react';

const VideoDemo: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [step, setStep] = useState(0);
  const [typedText, setTypedText] = useState('');

  const steps = [
    { icon: User, label: isArabic ? 'أضف ملفك الشخصي' : 'Add Your Profile', color: '#0A8F84' },
    { icon: BarChart2, label: isArabic ? 'الذكاء الاصطناعي يحلل' : 'AI Analyzes', color: '#0A8F84' },
    { icon: MessageSquare, label: isArabic ? 'أرسل رسائل مخصصة' : 'Send Custom Messages', color: '#C9922A' },
  ];

  const messageText = isArabic
    ? 'مرحباً أحمد، أعجبني ملفك المهني في مجال الهندسة...'
    : 'Hello Ahmed, I was impressed by your engineering profile...';

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % 3);
      setTypedText('');
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (step === 2) {
      let i = 0;
      const typing = setInterval(() => {
        if (i < messageText.length) {
          setTypedText(messageText.substring(0, i + 1));
          i++;
        } else {
          clearInterval(typing);
        }
      }, 40);
      return () => clearInterval(typing);
    }
  }, [step, messageText]);

  return (
    <section className="relative w-full py-20 md:py-28 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-4xl font-bold text-center text-text-primary mb-16"
          style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}
        >
          {isArabic ? 'شاهد كيف تعمل وصّل' : 'See How Wassel Works'}
        </motion.h2>

        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Animated Player */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative w-full lg:w-3/5 rounded-2xl overflow-hidden"
            style={{ background: '#0B1220', border: '1px solid rgba(10,143,132,0.2)' }}
          >
            <div className="aspect-video flex items-center justify-center p-8 relative">
              {/* Decorative circles */}
              <div className="absolute top-4 right-4 w-20 h-20 rounded-full opacity-10" style={{ background: '#0A8F84' }} />
              <div className="absolute bottom-4 left-4 w-16 h-16 rounded-full opacity-10" style={{ background: '#C9922A' }} />

              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div
                    key="step0"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className="text-center"
                  >
                    <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(10,143,132,0.2)' }}>
                      <User size={36} style={{ color: '#0A8F84' }} />
                    </div>
                    <p className="text-white text-lg font-semibold mb-2" style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}>
                      {isArabic ? 'أحمد محمد' : 'Ahmed Mohammed'}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: '#C9922A' }} />
                      <span className="text-sm" style={{ color: '#C9922A' }}>
                        {isArabic ? 'نقاط لينكدإن: 87/100' : 'LinkedIn Score: 87/100'}
                      </span>
                    </div>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-xs space-y-3"
                  >
                    {[85, 72, 91, 68].map((val, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                            {[
                              isArabic ? 'العنوان' : 'Headline',
                              isArabic ? 'الملخص' : 'Summary',
                              isArabic ? 'الخبرة' : 'Experience',
                              isArabic ? 'المهارات' : 'Skills'
                            ][i]}
                          </span>
                          <span style={{ color: '#0A8F84' }}>{val}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: val + '%' }}
                            transition={{ duration: 1, delay: i * 0.2 }}
                            className="h-full rounded-full"
                            style={{ background: i === 2 ? '#C9922A' : '#0A8F84' }}
                          />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-sm"
                  >
                    <div className="rounded-xl p-4" style={{ background: 'rgba(10,143,132,0.1)', border: '1px solid rgba(10,143,132,0.2)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare size={16} style={{ color: '#C9922A' }} />
                        <span className="text-xs" style={{ color: '#C9922A' }}>
                          {isArabic ? 'رسالة مخصصة بالذكاء الاصطناعي' : 'AI-Personalized Message'}
                        </span>
                      </div>
                      <p className="text-white text-sm leading-relaxed" style={{ fontFamily: isArabic ? 'Cairo' : 'Inter', direction: isArabic ? 'rtl' : 'ltr', minHeight: '3rem' }}>
                        {typedText}
                        <span className="animate-pulse" style={{ color: '#C9922A' }}>|</span>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Step Indicators */}
          <div className="w-full lg:w-2/5 space-y-6">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === i;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: isArabic ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.15 }}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${isArabic ? 'flex-row-reverse text-right' : ''}`}
                  style={{
                    background: isActive ? 'rgba(10,143,132,0.1)' : 'transparent',
                    border: isActive ? '1px solid rgba(10,143,132,0.3)' : '1px solid transparent',
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${s.color}20` }}
                  >
                    <Icon size={22} style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="text-text-primary font-semibold" style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}>
                      {s.label}
                    </p>
                    <div className="mt-2 h-1 rounded-full w-24" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      {isActive && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 3.5, ease: 'linear' }}
                          className="h-full rounded-full"
                          style={{ background: s.color }}
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoDemo;
