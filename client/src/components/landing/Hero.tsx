import React from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Hero: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const isArabic = i18n.language === 'ar';

  const stats = t('hero.stats', { returnObjects: true }) as any[];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  };
  return (
    <section className="relative w-full pt-20 pb-20 md:pt-32 md:pb-32 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-primary-400/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <motion.div variants={itemVariants} className="text-center mb-12">
          <h1
            className="text-4xl md:text-6xl font-bold text-text-primary mb-6 leading-tight"
            style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}
          >
            {t('hero.title')}
          </h1>
        </motion.div>

        <motion.div variants={itemVariants} className="text-center mb-12">
          <p className="text-lg md:text-xl text-text-secondary max-w-3xl mx-auto leading-relaxed">
            {t('hero.subtitle')}
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className={`flex flex-col sm:flex-row gap-4 justify-center mb-20 ${isArabic ? 'sm:flex-row-reverse' : ''}`}
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="lg"
              className="bg-primary-600 hover:bg-primary-700 text-white text-lg h-12 px-8"
              onClick={() => navigate('/signup')}
            >
              {t('hero.cta_primary')}
              <ArrowRight className={`ml-2 ${isArabic ? 'ml-2 mr-0' : ''}`} size={20} />
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="lg"
              variant="outline"
              className="text-primary-600 border-primary-600 hover:bg-primary-50 text-lg h-12 px-8"
            >
              {t('hero.cta_secondary')}
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${isArabic ? 'rtl' : ''}`}
        >
          {stats?.map((stat: any, index: number) => (
            <motion.div
              key={index}
              whileHover={{ y: -8 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-all duration-300"
            >
              <h3
                className="text-3xl md:text-4xl font-bold text-primary-600 mb-2"
                style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}
              >
                {stat.number}
              </h3>
              <p className="text-text-primary font-semibold mb-1">{stat.label}</p>
              <p className="text-text-secondary text-sm">{stat.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;