import React from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Pricing: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const isArabic = i18n.language === 'ar';

  const plans = t('pricing.plans', { returnObjects: true }) as any[];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
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
    <section id="pricing" className="relative w-full py-20 md:py-32">
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
            {t('pricing.title')}
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            {t('pricing.subtitle')}
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className={`grid grid-cols-1 md:grid-cols-4 gap-6 ${isArabic ? 'rtl' : ''}`}
        >
          {plans?.map((plan: any, index: number) => {
            const isPopular = plan.popular === true;
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ y: isPopular ? -16 : -8 }}
                className={`relative group rounded-3xl transition-all duration-300 ${
                  isPopular
                    ? 'md:scale-105 border-2 border-primary-600 bg-gradient-to-br from-primary-600/10 to-secondary-500/5'
                    : 'border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="backdrop-blur-sm rounded-3xl p-8 h-full flex flex-col">
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                      <div className="flex items-center gap-2 bg-primary-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                        <Zap size={16} />
                        {isArabic ? 'موصى به' : 'Recommended'}
                      </div>
                    </div>
                  )}

                  <h3
                    className="text-2xl font-bold text-text-primary mb-2"
                    style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}
                  >
                    {plan.name}
                  </h3>
                  <p className="text-text-secondary text-sm mb-6 flex-grow">
                    {plan.description}
                  </p>

                  <div className="mb-8">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-5xl font-bold text-primary-600"
                        style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}
                      >
                        {plan.price}
                      </span>
                      <span className="text-text-secondary text-sm">
                        {plan.period}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-4 mb-8 flex-grow">
                    {plan.features?.map((feature: string, featureIndex: number) => (
                      <li
                        key={featureIndex}
                        className="flex items-start gap-3"
                      >
                        <Check
                          size={20}
                          className={`mt-0.5 flex-shrink-0 ${
                            isPopular
                              ? 'text-primary-600'
                              : 'text-text-secondary/50'
                          }`}
                        />
                        <span className="text-text-secondary text-sm">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => navigate('/signup')}
                    className={`w-full h-12 font-semibold transition-all duration-300 ${
                      isPopular
                        ? 'bg-primary-600 hover:bg-primary-700 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-text-primary border border-white/10 hover:border-white/20'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;