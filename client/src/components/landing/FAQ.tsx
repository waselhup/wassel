import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

const FAQ: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = t('faq.items', { returnObjects: true }) as any[];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3,
      },
    }),
  };

  return (
    <section id="faq" className="relative w-full py-20 md:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
            {t('faq.title')}
          </h2>
          <p className="text-lg text-text-secondary">
            {t('faq.subtitle')}
          </p>
        </motion.div>
        <div className={`space-y-4 ${isArabic ? 'rtl' : ''}`}>
          {faqs?.map((faq: any, index: number) => (
            <motion.div
              key={index}
              custom={index}
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <motion.button
                onClick={() => toggleFAQ(index)}
                className="w-full group"
              >
                <div className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-6 transition-all duration-300 text-left">
                  <div className="flex items-center justify-between">
                    <h3
                      className="text-lg font-semibold text-text-primary group-hover:text-primary-600 transition-colors"
                      style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}
                    >
                      {faq.question}
                    </h3>
                    <motion.div
                      animate={{
                        rotate: openIndex === index ? 180 : 0,
                      }}
                      transition={{ duration: 0.3 }}
                      className="flex-shrink-0 ml-4"
                    >
                      {openIndex === index ? (
                        <Minus size={24} className="text-primary-600" />
                      ) : (
                        <Plus size={24} className="text-text-secondary" />
                      )}
                    </motion.div>
                  </div>
                </div>
              </motion.button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-white/[0.02] border-x border-b border-white/10 rounded-b-2xl p-6 -mt-2 pt-4">
                      <p className="text-text-secondary leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 text-center bg-gradient-to-r from-primary-600/10 to-secondary-500/10 border border-white/10 rounded-3xl p-8"
        >
          <h3
            className="text-2xl font-bold text-text-primary mb-4"
            style={{ fontFamily: isArabic ? 'Cairo' : 'Inter' }}
          >
            {isArabic
              ? 'هل لديك سؤال آخر؟'
              : "Can't find what you're looking for?"}
          </h3>
          <p className="text-text-secondary mb-6 max-w-2xl mx-auto">
            {isArabic
              ? 'تواصل معنا مباشرة وسنساعدك في أي استفسار'
              : 'Contact our support team and we will get back to you within 24 hours.'}
          </p>
          <button className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors duration-300">
            {isArabic ? 'تواصل معنا' : 'Contact Support'}
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;