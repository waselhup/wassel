import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Upload, FileText, TrendingUp, ChevronRight } from 'lucide-react';

const HowItWorks: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const step1 = t('howItWorks.step1', { returnObjects: true }) as any;
  const step2 = t('howItWorks.step2', { returnObjects: true }) as any;
  const step3 = t('howItWorks.step3', { returnObjects: true }) as any;

  const steps = [
    {
      number: 1,
      icon: Upload,
      title: step1.title,
      description: step1.description,
    },
    {
      number: 2,
      icon: FileText,
      title: step2.title,
      description: step2.description,
    },
    {
      number: 3,
      icon: TrendingUp,
      title: step3.title,
      description: step3.description,
    },
  ];
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <section className="relative w-full py-20 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2
            className="text-4xl md:text-5xl font-bold text-text-primary mb-4"
            style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}
          >
            {t('howItWorks.title')}
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            {t('howItWorks.subtitle')}
          </p>
        </motion.div>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 relative"
        >
          <div className="absolute top-1/4 left-0 right-0 h-1 bg-gradient-to-r from-primary-600 via-secondary-500 to-transparent hidden md:block" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                variants={itemVariants}
                className="relative"
              >
                <div className={`relative z-10 bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-300 ${isArabic ? 'rtl' : ''}`}>
                  <div className="absolute -top-6 left-8 w-12 h-12 bg-gradient-to-br from-primary-600 to-secondary-500 rounded-full flex items-center justify-center text-white font-bold text-lg border-4 border-white/10">
                    {step.number}
                  </div>

                  <div className="mb-6 mt-2">
                    <div className="w-14 h-14 bg-primary-600/10 rounded-2xl flex items-center justify-center">
                      <Icon size={28} className="text-primary-600" />
                    </div>
                  </div>

                  <h3
                    className="text-xl font-bold text-text-primary mb-3"
                    style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-text-secondary leading-relaxed">
                    {step.description}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:flex absolute top-1/3 -right-4 z-20">
                    <motion.div
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <ChevronRight
                        size={24}
                        className="text-primary-600"
                      />
                    </motion.div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;