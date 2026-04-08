import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Sparkles, Send, Rocket, CheckCircle2 } from 'lucide-react';

const Features: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const phase1 = t('features.phase1', { returnObjects: true }) as any;
  const phase2 = t('features.phase2', { returnObjects: true }) as any;
  const phase3 = t('features.phase3', { returnObjects: true }) as any;

  const features = [
    {
      icon: Sparkles,
      title: phase1.title,
      description: phase1.description,
      items: phase1.features || [],
      color: 'from-blue-500 to-purple-500',
    },
    {
      icon: Send,
      title: phase2.title,
      description: phase2.description,
      items: phase2.features || [],
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: Rocket,
      title: phase3.title,
      description: phase3.description,
      items: phase3.features || [],
      color: 'from-pink-500 to-red-500',
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
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  };

  return (
    <section id="features" className="relative w-full py-20 md:py-32">
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
            {t('features.title')}
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            {t('features.subtitle')}
          </p>
        </motion.div>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className={`grid grid-cols-1 md:grid-cols-3 gap-8 ${isArabic ? 'rtl' : ''}`}
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ y: -12 }}
                className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity duration-300 pointer-events-none`}
                />

                <div className="relative mb-6">
                  <div className={`bg-gradient-to-br ${feature.color} p-3 rounded-2xl w-fit`}>
                    <Icon size={32} className="text-white" />
                  </div>
                </div>

                <div className="relative">
                  <h3
                    className="text-xl md:text-2xl font-bold text-text-primary mb-3"
                    style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-text-secondary mb-6 leading-relaxed">
                    {feature.description}
                  </p>

                  <ul className="space-y-3">
                    {feature.items.map((item: string, itemIndex: number) => (
                      <li key={itemIndex} className="flex items-start gap-3">
                        <CheckCircle2
                          size={20}
                          className="text-primary-500 mt-0.5 flex-shrink-0"
                        />
                        <span className="text-text-secondary text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="absolute top-6 right-6 opacity-10 text-6xl font-bold text-primary-600">
                  {index + 1}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;